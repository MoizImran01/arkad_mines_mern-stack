import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './ForecastingAnalytics.css';

const fmt = (n) => Number(n).toFixed(2);

const ForecastingAnalytics = ({ forecasts = [] }) => {
  // Process data for Top Forecasted Demand (Bar Chart)
  const topDemandData = useMemo(() => {
    if (!forecasts.length) return [];
    
    return forecasts
      .map((item) => ({
        name: item.sku,
        fullName: item.stoneName || item.sku,
        value: parseFloat(item.forecast_monthly_mean) || 0
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
      .reverse(); // Reverse for better bar chart display (lowest to highest)
  }, [forecasts]);

  // Process data for Safety Stock vs Reorder Point (Grouped Bar Chart)
  const safetyStockReorderPointData = useMemo(() => {
    if (!forecasts.length) return [];
    
    return forecasts
      .map((item) => {
        const safetyStock = parseFloat(item.calculated_safety_stock) || 0;
        const reorderPoint = parseFloat(item.dynamic_reorder_point) || 0;
        
        return {
          name: item.sku,
          fullName: item.stoneName || item.sku,
          safetyStock,
          reorderPoint
        };
      })
      .sort((a, b) => b.reorderPoint - a.reorderPoint)
      .slice(0, 7)
      .reverse();
  }, [forecasts]);

  // Process data for Category Purchasing Breakdown (Donut Chart)
  const categoryData = useMemo(() => {
    if (!forecasts.length) return [];
    
    const categoryMap = {};
    forecasts.forEach((item) => {
      const category = item.category || 'Other';
      const poQuantity = parseFloat(item.suggested_po_quantity) || 0;
      categoryMap[category] = (categoryMap[category] || 0) + poQuantity;
    });
    
    return Object.entries(categoryMap).map(([name, value]) => ({
      name,
      value: parseFloat(value.toFixed(2))
    }));
  }, [forecasts]);

  // Color palette for charts
  const COLORS = {
    primary: '#4f46e5', // Indigo
    safetyStock: '#f59e0b', // Amber/Yellow
    reorderPoint: '#14b8a6', // Teal/Green
    category: ['#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1']
  };

  // Custom tooltip for bar charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{data.fullName || label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="tooltip-value" style={{ color: entry.color }}>
              {entry.name}: {fmt(entry.value)} Tons
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for pie chart
  const PieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-label">{payload[0].name}</p>
          <p className="tooltip-value" style={{ color: payload[0].color }}>
            {fmt(payload[0].value)} Tons
          </p>
        </div>
      );
    }
    return null;
  };

  if (!forecasts.length) {
    return null;
  }

  return (
    <div className="forecasting-analytics">
      <h2 className="analytics-section-title">Forecasting Analytics</h2>
      
      <div className="analytics-grid">
        {/* Top Forecasted Demand - Bar Chart */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3 className="analytics-card-title">Top 7 Demand Forecasts</h3>
            <p className="analytics-card-subtitle">Highest monthly forecasted demand</p>
          </div>
          <div className="analytics-chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topDemandData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 120, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={10}
                  width={120}
                  tick={{ fontSize: 9 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="value"
                  fill={COLORS.primary}
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Safety Stock vs Reorder Point - Grouped Bar Chart */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3 className="analytics-card-title">Safety Stock & Reorder Point</h3>
            <p className="analytics-card-subtitle">Raw values for top items</p>
          </div>
          <div className="analytics-chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={safetyStockReorderPointData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 120, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={10}
                  width={120}
                  tick={{ fontSize: 9 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="square"
                  formatter={(value) => (
                    <span style={{ color: '#64748b', fontSize: '12px' }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="safetyStock"
                  fill={COLORS.safetyStock}
                  name="Safety Stock"
                  radius={[0, 8, 8, 0]}
                />
                <Bar
                  dataKey="reorderPoint"
                  fill={COLORS.reorderPoint}
                  name="Reorder Point"
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Purchasing Breakdown - Donut Chart */}
        <div className="analytics-card">
          <div className="analytics-card-header">
            <h3 className="analytics-card-title">Category Breakdown</h3>
            <p className="analytics-card-subtitle">Suggested PO volume by category</p>
          </div>
          <div className="analytics-chart-container">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  innerRadius={50}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS.category[index % COLORS.category.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => (
                    <span style={{ color: '#64748b', fontSize: '12px' }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForecastingAnalytics;
