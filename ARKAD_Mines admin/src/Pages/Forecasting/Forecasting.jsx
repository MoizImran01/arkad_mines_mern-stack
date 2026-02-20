import React, { useState, useEffect, useCallback } from 'react';
import './Forecasting.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Brain,
  RefreshCw,
  Package,
  Clock,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Search
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const attachActualStock = async (forecasts) => {
  try {
    // Fetch all stones from database
    const stonesResponse = await axios.get(`${API_URL}/api/stones/list`);
    const stones = stonesResponse.data.stones_data || [];
    
    // Create a map for quick lookup: stoneName_subcategory -> stock quantity
    const stockMap = new Map();
    stones.forEach((stone) => {
      const key = `${stone.stoneName}_${stone.subcategory}`.toLowerCase();
      const availableStock = (stone.stockQuantity || 0) - (stone.quantityDelivered || 0);
      stockMap.set(key, Math.max(0, availableStock)); // Ensure non-negative
    });
    
    // Attach actual stock to forecasts
    return forecasts.map((item) => {
      const key = `${item.stoneName}_${item.subcategory}`.toLowerCase();
      const currentStock = stockMap.get(key) ?? 0; // Default to 0 if not found
      return {
        ...item,
        current_stock: currentStock,
      };
    });
  } catch (error) {
    console.error('Error fetching stock data:', error);
    // Fallback: return forecasts with 0 stock if fetch fails
    return forecasts.map((item) => ({
      ...item,
      current_stock: 0,
    }));
  }
};

const fmt = (n) => Number(n).toFixed(2);

const CategoryBadge = ({ category }) => {
  const cls = category === 'Marble' ? 'marble' : 'granite';
  return <span className={`category-badge ${cls}`}>{category}</span>;
};

const StatusPill = ({ currentStock, reorderPoint }) => {
  const needsReorder = currentStock <= reorderPoint;
  const cls = needsReorder ? 'reorder' : 'healthy';
  return (
    <span className={`status-pill ${cls}`}>
      <span className={`status-dot ${cls}`} />
      {needsReorder ? 'Reorder Needed' : 'Healthy'}
    </span>
  );
};

const KpiCard = ({ icon: Icon, label, value, subtitle, accent }) => (
  <div className="kpi-card">
    <div className="kpi-card-inner">
      <div className="kpi-card-text">
        <p className="kpi-label">{label}</p>
        <p className="kpi-value">{value}</p>
        {subtitle && <p className="kpi-subtitle">{subtitle}</p>}
      </div>
      <div className={`kpi-icon-box ${accent}`}>
        <Icon />
      </div>
    </div>
    <div className="kpi-card-bar" />
  </div>
);

const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton-card-inner">
      <div className="skeleton-card-lines">
        <div className="skeleton-line w-24" />
        <div className="skeleton-line w-20" />
        <div className="skeleton-line w-32" />
      </div>
      <div className="skeleton-icon" />
    </div>
  </div>
);

const SkeletonRow = () => (
  <tr className="skeleton-row">
    {Array.from({ length: 9 }).map((_, i) => (
      <td key={i}>
        <div className="skeleton-cell" style={{ width: `${50 + Math.random() * 50}%` }} />
      </td>
    ))}
  </tr>
);

const Forecasting = () => {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortField, setSortField] = useState('sku');
  const [sortDir, setSortDir] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await axios.get(`${API_URL}/api/forecasting/forecast`);
      const payload = response.data;
      const items = payload.forecasts || payload.data || [];

      if (!items.length) {
        toast.error('No forecast data received');
        return;
      }

      // Attach actual stock values from database
      const forecastsWithStock = await attachActualStock(items);
      setForecasts(forecastsWithStock);
      setLastUpdated(new Date());
      if (isRefresh) toast.success('Forecast data refreshed');
    } catch (err) {
      console.error('Forecast fetch error:', err);
      toast.error('Failed to fetch forecast data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalSkus = forecasts.length;
  const avgLeadTime =
    totalSkus > 0
      ? (forecasts.reduce((s, f) => s + f.current_lead_time_days, 0) / totalSkus).toFixed(1)
      : '0';
  const highRiskCount = forecasts.filter(
    (f) => (f.current_stock || 0) <= f.dynamic_reorder_point
  ).length;
  const totalPo = forecasts.reduce((s, f) => s + f.suggested_po_quantity, 0);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="sort-icon-default" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="sort-icon-active" />
    ) : (
      <ChevronDown className="sort-icon-active" />
    );
  };

  const filtered = forecasts
    .filter((f) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.sku.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.stoneName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'string') return dir * av.localeCompare(bv);
      return dir * (av - bv);
    });

  const handleMarkForPO = async (item) => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.post(
        `${API_URL}/api/stones/mark-for-po`,
        {
          sku: item.sku,
          stoneName: item.stoneName,
          subcategory: item.subcategory
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      if (response.data.success) {
        toast.success(`${item.stoneName} marked for purchase order`);
      } else {
        toast.error(response.data.message || 'Failed to mark stone for PO');
      }
    } catch (error) {
      console.error('Error marking stone for PO:', error);
      toast.error(error.response?.data?.message || 'Failed to mark stone for PO');
    }
  };

  const columns = [
    { key: 'sku', label: 'SKU' },
    { key: 'category', label: 'Category' },
    { key: 'forecast_monthly_mean', label: 'Monthly Forecast' },
    { key: 'current_lead_time_days', label: 'Lead Time' },
    { key: 'calculated_safety_stock', label: 'Safety Stock' },
    { key: 'dynamic_reorder_point', label: 'Reorder Point' },
    { key: 'current_stock', label: 'Current Stock' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions' },
  ];

  return (
    <div className="forecast-page">
      <div className="forecast-container">

        {/* Header */}
        <div className="forecast-header">
          <div className="forecast-header-left">
            <div className="forecast-title-row">
              <div className="forecast-icon-box">
                <Brain />
              </div>
              <h1 className="forecast-title">
                AI Demand Forecasting &amp; Inventory Planning
              </h1>
            </div>
            {lastUpdated && (
              <p className="forecast-timestamp">
                Last updated{' '}
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' \u00B7 '}
                {lastUpdated.toLocaleDateString()}
              </p>
            )}
          </div>

          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="forecast-refresh-btn"
          >
            {refreshing ? <Loader2 className="spin-icon" /> : <RefreshCw />}
            Refresh Data
          </button>
        </div>

        {/* KPI Cards */}
        {loading ? (
          <div className="kpi-grid">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="kpi-grid">
            <KpiCard
              icon={Package}
              label="Total SKUs Monitored"
              value={totalSkus}
              subtitle="Across all categories"
              accent="indigo"
            />
            <KpiCard
              icon={Clock}
              label="Avg. Lead Time"
              value={`${avgLeadTime} days`}
              subtitle="Weighted across suppliers"
              accent="sky"
            />
            <KpiCard
              icon={AlertTriangle}
              label="High-Risk Items"
              value={highRiskCount}
              subtitle="Below reorder point"
              accent="rose"
            />
            <KpiCard
              icon={TrendingUp}
              label="Total Suggested PO"
              value={`${fmt(totalPo)} Tons`}
              subtitle="Aggregate order volume"
              accent="emerald"
            />
          </div>
        )}

        {/* Table */}
        <div className="forecast-table-wrapper">
          <div className="forecast-table-toolbar">
            <div className="forecast-table-title-row">
              <FileText />
              <h2 className="forecast-table-title">Inventory Planning Table</h2>
              {!loading && (
                <span className="forecast-item-count">{filtered.length} items</span>
              )}
            </div>
            <div className="forecast-search-wrapper">
              <Search />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKUs, categories..."
                className="forecast-search-input"
              />
            </div>
          </div>

          <div className="forecast-table-scroll">
            <table className="forecast-table">
              <thead>
                <tr>
                  {columns.map((col) => {
                    const isSortable = col.key !== 'actions' && col.key !== 'status';
                    return (
                      <th
                        key={col.key}
                        className={isSortable ? 'sortable' : ''}
                        onClick={() => isSortable && handleSort(col.key)}
                      >
                        <span className="th-content">
                          {col.label}
                          {isSortable && <SortIcon field={col.key} />}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="forecast-empty-state">
                      <div className="forecast-empty-inner">
                        <Package />
                        <p className="empty-title">No matching items</p>
                        <p className="empty-sub">Try adjusting your search or refresh the data</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((item, idx) => {
                    const needsReorder = (item.current_stock || 0) <= item.dynamic_reorder_point;
                    return (
                      <tr key={item.sku} className={idx % 2 === 0 ? 'row-even' : 'row-odd'}>
                        <td>
                          <div>
                            <p className="sku-cell-name">{item.sku}</p>
                            <p className="sku-cell-sub">{item.stoneName}</p>
                          </div>
                        </td>
                        <td>
                          <CategoryBadge category={item.category} />
                        </td>
                        <td>
                          <span className="mono-cell">
                            {fmt(item.forecast_monthly_mean)} <span className="unit">Tons</span>
                          </span>
                        </td>
                        <td>
                          <span className="mono-cell">
                            {fmt(item.current_lead_time_days)} <span className="unit">days</span>
                          </span>
                        </td>
                        <td>
                          <span className="mono-cell">
                            {fmt(item.calculated_safety_stock)} <span className="unit">Tons</span>
                          </span>
                        </td>
                        <td>
                          <span className="mono-cell">
                            {fmt(item.dynamic_reorder_point)} <span className="unit">Tons</span>
                          </span>
                        </td>
                        <td>
                          <span className={`mono-cell ${needsReorder ? 'danger' : ''}`}>
                            {item.current_stock || 0} <span className="unit">Tons</span>
                          </span>
                        </td>
                        <td>
                          <StatusPill
                            currentStock={item.current_stock || 0}
                            reorderPoint={item.dynamic_reorder_point}
                          />
                        </td>
                        <td>
                          <button
                            onClick={() => handleMarkForPO(item)}
                            className="create-po-btn"
                          >
                            <CheckCircle2 />
                            Mark for PO
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Forecasting;
