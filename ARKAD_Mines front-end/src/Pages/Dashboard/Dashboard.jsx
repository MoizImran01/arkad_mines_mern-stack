import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import PurchaseTimeline from './Components/PurchaseTimeline';
import MaterialPreferenceChart from './Components/MaterialPreferenceChart';
import TopStonesPanel from './Components/TopStonesPanel';
import DashboardSkeleton from './Components/DashboardSkeleton';
import './Dashboard.css';

// Client dashboard: orders, quotes, purchase timeline, material preferences, top stones.
const Dashboard = () => {
  const { token, url } = useContext(StoreContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) return;

      try {
        setLoading(true);
        setError(null);

        const [ordersRes, quotesRes] = await Promise.all([
          axios.get(`${url}/api/orders/my`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${url}/api/quotes/my`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { quotations: [] } })),
        ]);

        const userOrders = ordersRes.data.success ? ordersRes.data.orders || [] : [];
        setOrders(userOrders);

        const userQuotes = quotesRes.data?.quotations || quotesRes.data?.data || [];
        setQuotations(Array.isArray(userQuotes) ? userQuotes : []);

        let stonesMap = new Map();
        try {
          const stonesResponse = await axios.get(`${url}/api/stones/list`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (stonesResponse.data.success && stonesResponse.data.stones_data) {
            stonesResponse.data.stones_data.forEach((stone) => {
              if (stone._id) stonesMap.set(stone._id.toString(), stone.category);
              if (stone.stoneName) stonesMap.set(stone.stoneName.toLowerCase(), stone.category);
            });
          }
        } catch (stonesErr) {
          console.warn('Could not fetch stones for categories:', stonesErr);
        }

        const calculatedAnalytics = calculateAnalytics(userOrders, stonesMap);
        setAnalytics(calculatedAnalytics);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [token, url]);

  const calculateAnalytics = (orders, stonesMap = new Map()) => {
    if (!orders || orders.length === 0) {
      return {
        purchaseTimeline: [],
        materialPreferences: {
          category1: { name: 'Category 1', value: 0 },
          category2: { name: 'Category 2', value: 0 },
          category3: { name: 'Category 3', value: 0 },
          category4: { name: 'Category 4', value: 0 },
          category5: { name: 'Category 5', value: 0 },
        },
        topStones: [],
        totalSpent: 0,
        outstandingBalance: 0,
      };
    }

    const stoneCounts = {};
    const stoneDetails = {};

    orders.forEach((order) => {
      order.items?.forEach((item) => {
        const stoneName = item.stoneName || 'Unknown';
        if (!stoneCounts[stoneName]) {
          stoneCounts[stoneName] = { quantity: 0, totalPrice: 0 };
        }
        stoneCounts[stoneName].quantity += item.quantity || 0;
        stoneCounts[stoneName].totalPrice += item.totalPrice || 0;
        if (!stoneDetails[stoneName]) {
          stoneDetails[stoneName] = {
            name: stoneName,
            image: item.image,
            category: item.category && String(item.category).trim() ? item.category.trim() : '',
          };
        }
      });
    });

    const purchaseTimeline = orders
      .filter((o) => o.createdAt)
      .map((o) => {
        const d = new Date(o.createdAt);
        return {
          date: d,
          dateString: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          month: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          stones: o.items?.map((i) => ({ name: i.stoneName, quantity: i.quantity })) || [],
          totalValue: o.financials?.grandTotal || 0,
        };
      })
      .sort((a, b) => a.date - b.date);

    const materialPreferences = calculateMaterialPreferences(orders, stonesMap);

    const topStones = Object.entries(stoneCounts)
      .map(([name, data]) => ({
        name,
        purchases: orders.filter((o) => o.items?.some((i) => i.stoneName === name)).length,
        quantity: data.quantity,
        totalValue: data.totalPrice,
        image: stoneDetails[name]?.image,
        category: stoneDetails[name]?.category,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);

    let totalSpent = 0;
    let outstandingBalance = 0;
    orders.forEach((o) => {
      totalSpent += o.totalPaid || 0;
      outstandingBalance += o.outstandingBalance || 0;
    });

    return {
      purchaseTimeline,
      materialPreferences,
      topStones,
      totalSpent,
      outstandingBalance,
    };
  };

  const calculateMaterialPreferences = (orders, stonesMap) => {
    const categoryCounts = {};
    const categoryValues = {};
    let totalQuantity = 0;

    orders.forEach((order) => {
      order.items?.forEach((item) => {
        let category = 'Unknown';
        if (item.stone) {
          const id = typeof item.stone === 'object' ? item.stone._id?.toString() : item.stone.toString();
          category = stonesMap.get(id) || category;
        }
        if (category === 'Unknown' && item.stoneName) category = stonesMap.get(item.stoneName.toLowerCase()) || category;
        if (category === 'Unknown' && item.category) category = item.category;
        if (category === 'Unknown') category = item.stoneName || 'Unknown';

        const qty = item.quantity || 0;
        const val = item.totalPrice || 0;
        if (!categoryCounts[category]) {
          categoryCounts[category] = 0;
          categoryValues[category] = 0;
        }
        categoryCounts[category] += qty;
        categoryValues[category] += val;
        totalQuantity += qty;
      });
    });

    const sorted = Object.entries(categoryCounts)
      .filter(([c]) => c !== 'Unknown')
      .map(([category, quantity]) => ({
        category,
        quantity,
        value: categoryValues[category] || 0,
        percentage: totalQuantity > 0 ? Math.round((quantity / totalQuantity) * 100) : 0,
      }))
      .sort((a, b) => (b.value || b.quantity) - (a.value || a.quantity))
      .slice(0, 5);

    const preferences = {};
    sorted.forEach((item, i) => {
      preferences[`category${i + 1}`] = { name: item.category, value: item.percentage };
    });
    for (let i = sorted.length; i < 5; i++) {
      preferences[`category${i + 1}`] = { name: `Category ${i + 1}`, value: 0 };
    }
    return preferences;
  };

  const pendingQuotesCount = quotations.filter(
    (q) => q.status && ['draft', 'submitted', 'adjustment_required', 'revision_requested', 'issued'].includes(q.status)
  ).length;

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
  const formatMoney = (n) => (n != null ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00');

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="dashboard-error">
        <p>{error}</p>
        <button type="button" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-inner">
        <header className="dashboard-header">
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">Your orders, quotes, and insights</p>
        </header>

        <section className="dashboard-stats">
          <div className="dashboard-stat-card">
            <span className="dashboard-stat-value">{orders.length}</span>
            <span className="dashboard-stat-label">Total orders</span>
          </div>
          <div className="dashboard-stat-card">
            <span className="dashboard-stat-value">{formatMoney(analytics?.totalSpent)}</span>
            <span className="dashboard-stat-label">Total paid</span>
          </div>
          <div className="dashboard-stat-card">
            <span className="dashboard-stat-value">{formatMoney(analytics?.outstandingBalance)}</span>
            <span className="dashboard-stat-label">Outstanding</span>
          </div>
          <div className="dashboard-stat-card">
            <span className="dashboard-stat-value">{pendingQuotesCount}</span>
            <span className="dashboard-stat-label">Pending quotes</span>
          </div>
        </section>

        <section className="dashboard-actions">
          <button type="button" className="dashboard-action-btn" onClick={() => navigate('/request-quote')}>
            Request a quote
          </button>
          <button type="button" className="dashboard-action-btn secondary" onClick={() => navigate('/orders')}>
            View all orders
          </button>
          <button type="button" className="dashboard-action-btn secondary" onClick={() => navigate('/products')}>
            Browse products
          </button>
          {pendingQuotesCount > 0 && (
            <button type="button" className="dashboard-action-btn secondary" onClick={() => navigate('/quotations')}>
              View quotations ({pendingQuotesCount})
            </button>
          )}
        </section>

        {orders.length > 0 && (
          <section className="dashboard-section dashboard-card-wrap">
            <PurchaseTimeline orders={orders} />
          </section>
        )}

        {analytics && orders.length > 0 && (
          <section className="dashboard-section dashboard-card-wrap">
            <MaterialPreferenceChart preferences={analytics.materialPreferences} />
          </section>
        )}

        {analytics?.topStones?.length > 0 && (
          <section className="dashboard-section dashboard-card-wrap">
            <TopStonesPanel stones={analytics.topStones} />
          </section>
        )}

        {(!analytics || (orders.length === 0 && quotations.length === 0)) && (
          <section className="dashboard-empty">
            <h3>No activity yet</h3>
            <p>Request a quote or browse products to get started.</p>
            <button type="button" className="dashboard-action-btn" onClick={() => navigate('/products')}>
              Browse products
            </button>
          </section>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
