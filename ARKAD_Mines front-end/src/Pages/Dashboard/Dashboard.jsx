import React, { useState, useEffect, useContext, useMemo } from 'react';
import { StoreContext } from '../../context/StoreContext';
import axios from 'axios';
import StonePersonalityCard from './Components/StonePersonalityCard';
import PurchaseTimeline from './Components/PurchaseTimeline';
import MaterialPreferenceChart from './Components/MaterialPreferenceChart';
import TopStonesPanel from './Components/TopStonesPanel';
import DashboardSkeleton from './Components/DashboardSkeleton';
import './Dashboard.css';

const Dashboard = () => {
  const { token, url } = useContext(StoreContext);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!token) return;
      
      try {
        setLoading(true);
        setError(null);

        const ordersResponse = await axios.get(`${url}/api/orders/my`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (ordersResponse.data.success) {
          const userOrders = ordersResponse.data.orders || [];
          setOrders(userOrders);

          let stonesMap = new Map();
          try {
            const stonesResponse = await axios.get(`${url}/api/stones/list`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (stonesResponse.data.success && stonesResponse.data.stones_data) {
              stonesResponse.data.stones_data.forEach(stone => {
                if (stone._id) stonesMap.set(stone._id.toString(), stone.category);
                if (stone.stoneName) stonesMap.set(stone.stoneName.toLowerCase(), stone.category);
              });
              
              const categories = [...new Set(stonesResponse.data.stones_data.map(stone => stone.category).filter(Boolean))];
              setAvailableCategories(categories);
            }
          } catch (stonesErr) {
            console.warn('Could not fetch stones for categories:', stonesErr);
          }

          const calculatedAnalytics = calculateAnalytics(userOrders, stonesMap);
          setAnalytics(calculatedAnalytics);
        }
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
        personality: 'Classic & Timeless',
        purchaseTimeline: [],
        materialPreferences: {
          category1: { name: 'Category 1', value: 0 },
          category2: { name: 'Category 2', value: 0 },
          category3: { name: 'Category 3', value: 0 },
          category4: { name: 'Category 4', value: 0 },
          category5: { name: 'Category 5', value: 0 },
        },
        topStones: [],
      };
    }

    const stoneCounts = {};
    const stoneDetails = {};
    
    orders.forEach(order => {
      order.items?.forEach(item => {
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
            category: item.category || 'Unknown',
          };
        }
      });
    });

    const personality = determinePersonality(stoneCounts, stoneDetails);

    const purchaseTimeline = orders
      .filter(order => order.createdAt)
      .map(order => {
        const orderDate = new Date(order.createdAt);
        return {
          date: orderDate,
          dateString: orderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          month: orderDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          stones: order.items?.map(item => ({
            name: item.stoneName,
            quantity: item.quantity,
          })) || [],
          totalValue: order.financials?.grandTotal || 0,
        };
      })
      .sort((a, b) => a.date - b.date);

    const materialPreferences = calculateMaterialPreferences(orders, stonesMap);

    const topStones = Object.entries(stoneCounts)
      .map(([name, data]) => ({
        name,
        purchases: orders.filter(order => 
          order.items?.some(item => item.stoneName === name)
        ).length,
        quantity: data.quantity,
        totalValue: data.totalPrice,
        image: stoneDetails[name]?.image,
        category: stoneDetails[name]?.category,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);

    return {
      personality,
      purchaseTimeline,
      materialPreferences,
      topStones,
    };
  };

  const determinePersonality = (stoneCounts, stoneDetails) => {
    const stoneNames = Object.keys(stoneCounts);
    const darkKeywords = ['black', 'dark', 'charcoal', 'granite', 'basalt'];
    const lightKeywords = ['white', 'light', 'marble', 'quartz', 'luminous'];
    const classicKeywords = ['classic', 'traditional', 'timeless'];

    let darkCount = 0;
    let lightCount = 0;
    let classicCount = 0;

    stoneNames.forEach(name => {
      const lowerName = name.toLowerCase();
      if (darkKeywords.some(kw => lowerName.includes(kw))) darkCount++;
      if (lightKeywords.some(kw => lowerName.includes(kw))) lightCount++;
      if (classicKeywords.some(kw => lowerName.includes(kw))) classicCount++;
    });

    if (darkCount > lightCount && darkCount > classicCount) {
      return 'Bold & Industrial';
    } else if (lightCount > darkCount) {
      return 'Luminous & Contemporary';
    } else {
      return 'Classic & Timeless';
    }
  };

  const calculateMaterialPreferences = (orders, stonesMap) => {
    const categoryCounts = {};
    const categoryValues = {};
    let totalValue = 0;
    let totalQuantity = 0;

    orders.forEach(order => {
      order.items?.forEach(item => {
        let category = 'Unknown';
        
        if (item.stone) {
          const stoneId = typeof item.stone === 'object' ? item.stone._id?.toString() : item.stone.toString();
          category = stonesMap.get(stoneId) || category;
        }
        
        if (category === 'Unknown' && item.stoneName) {
          category = stonesMap.get(item.stoneName.toLowerCase()) || category;
        }
        
        if (category === 'Unknown' && item.category) {
          category = item.category;
        }
        
        if (category === 'Unknown') {
          category = item.stoneName || 'Unknown';
        }

        const quantity = item.quantity || 0;
        const value = item.totalPrice || 0;

        if (!categoryCounts[category]) {
          categoryCounts[category] = 0;
          categoryValues[category] = 0;
        }
        categoryCounts[category] += quantity;
        categoryValues[category] += value;
        totalQuantity += quantity;
        totalValue += value;
      });
    });

    const sortedCategories = Object.entries(categoryCounts)
      .filter(([category]) => category !== 'Unknown')
      .map(([category, quantity]) => ({
        category,
        quantity,
        value: categoryValues[category] || 0,
        percentage: totalQuantity > 0 ? Math.round((quantity / totalQuantity) * 100) : 0,
      }))
      .sort((a, b) => (b.value || b.quantity) - (a.value || a.quantity))
      .slice(0, 5);

    const preferences = {};
    sortedCategories.forEach((item, index) => {
      preferences[`category${index + 1}`] = {
        name: item.category,
        value: item.percentage,
      };
    });

    for (let i = sortedCategories.length; i < 5; i++) {
      preferences[`category${i + 1}`] = {
        name: `Category ${i + 1}`,
        value: 0,
      };
    }

    return preferences;
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  console.log('Dashboard Analytics:', analytics);
  console.log('Orders:', orders);
  console.log('Loading:', loading);
  console.log('Error:', error);

  return (
    <div className="dashboard-container" style={{ minHeight: '100vh', background: 'linear-gradient(to bottom right, #f9fafb, #ffffff, #f9fafb)', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem', textAlign: 'left' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '700', color: '#111827', marginBottom: '0.75rem', background: 'linear-gradient(to right, #536438, #6b8248)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            Your Stone Profile
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#4b5563' }}>
            Insights based on your purchase history
          </p>
          {analytics && orders.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#536438', borderRadius: '50%' }}></span>
                {orders.length} Total Order{orders.length !== 1 ? 's' : ''}
              </span>
              {analytics.topStones && analytics.topStones.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: '#6b8248', borderRadius: '50%' }}></span>
                  {analytics.topStones.length} Favorite Stone{analytics.topStones.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </header>

        {analytics && orders.length > 0 ? (
          <div style={{ marginBottom: '3rem' }}>
            <StonePersonalityCard personality={analytics.personality || 'Classic & Timeless'} />
          </div>
        ) : analytics && (
          <div style={{ marginBottom: '3rem', background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <StonePersonalityCard personality="Classic & Timeless" />
          </div>
        )}

        {analytics && analytics.purchaseTimeline && analytics.purchaseTimeline.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <PurchaseTimeline timeline={analytics.purchaseTimeline} />
          </div>
        )}

        {analytics && orders.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <MaterialPreferenceChart preferences={analytics.materialPreferences} />
          </div>
        )}

        {analytics && analytics.topStones && analytics.topStones.length > 0 && (
          <div style={{ marginBottom: '3rem' }}>
            <TopStonesPanel stones={analytics.topStones} />
          </div>
        )}

        {(!analytics || (analytics.purchaseTimeline.length === 0 && analytics.topStones.length === 0)) && (
          <div className="text-center py-16 bg-white rounded-2xl shadow-lg">
            <div className="max-w-md mx-auto">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No purchase history yet
              </h3>
              <p className="text-gray-500 mb-6">
                Your stone profile will appear here once you make your first purchase.
              </p>
              <a
                href="/products"
                className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
              >
                Browse Products
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
