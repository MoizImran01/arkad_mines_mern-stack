import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { AdminAuthContext } from '../../context/AdminAuthContext';
import './Analytics.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Helper function for formatting numbers
const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return Math.round(num).toLocaleString();
};

const formatCurrency = (num) => {
  if (num === undefined || num === null) return 'PKR 0';
  return 'PKR ' + num.toLocaleString('en-PK', { maximumFractionDigits: 0 });
};

// Improved Bar Chart with better sizing
const BarChart = ({ data, dataKey, nameKey, fill, height = 300, expanded = false }) => {
  if (!data || data.length === 0) return <div className="no-data">No data available</div>;
  
  const maxValue = Math.max(...data.map(d => d[dataKey]));
  const padding = expanded ? 80 : 60;
  const fontSize = expanded ? 14 : 12;
  const barWidth = Math.min(expanded ? 60 : 50, (400 - padding * 2) / data.length - 10);
  
  return (
    <svg viewBox={`0 0 500 ${height}`} className="chart-svg bar-chart">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <g key={i}>
          <line
            x1={padding}
            y1={height - padding - (height - padding * 2) * ratio}
            x2={500 - padding}
            y2={height - padding - (height - padding * 2) * ratio}
            stroke="#dee2e6"
            strokeDasharray="4"
          />
          <text
            x={padding - 10}
            y={height - padding - (height - padding * 2) * ratio + 4}
            textAnchor="end"
            fontSize={fontSize}
            fill="#495057"
            fontWeight="500"
          >
            {formatNumber(maxValue * ratio)}
          </text>
        </g>
      ))}
      
      {/* Bars */}
      {data.map((item, index) => {
        const barHeight = maxValue > 0 ? (item[dataKey] / maxValue) * (height - padding * 2) : 0;
        const x = padding + (index * (barWidth + 15)) + 20;
        
        return (
          <g key={index} className="bar-group">
            <defs>
              <linearGradient id={`barGradient${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={fill} stopOpacity="1"/>
                <stop offset="100%" stopColor={fill} stopOpacity="0.7"/>
              </linearGradient>
            </defs>
            <rect
              x={x}
              y={height - padding - barHeight}
              width={barWidth}
              height={Math.max(barHeight, 2)}
              fill={`url(#barGradient${index})`}
              rx="4"
              className="bar"
            />
            {/* Value on top of bar */}
            <text
              x={x + barWidth / 2}
              y={height - padding - barHeight - 8}
              textAnchor="middle"
              fontSize={fontSize - 1}
              fill="#495057"
              fontWeight="600"
            >
              {formatNumber(item[dataKey])}
            </text>
            <text
              x={x + barWidth / 2}
              y={height - padding + 20}
              textAnchor="middle"
              fontSize={fontSize}
              fill="#495057"
              fontWeight="500"
            >
              {item[nameKey]}
            </text>
            <title>{`${item[nameKey]}: ${formatNumber(item[dataKey])}`}</title>
          </g>
        );
      })}
    </svg>
  );
};

// Improved Pie Chart that handles single items
const PieChart = ({ data, dataKey, nameKey, colors, size = 200, expanded = false }) => {
  if (!data || data.length === 0) return <div className="no-data">No data available</div>;
  
  const total = data.reduce((sum, item) => sum + (item[dataKey] || 0), 0);
  if (total === 0) return <div className="no-data">No data available</div>;
  
  const actualSize = expanded ? 300 : size;
  const centerX = actualSize / 2;
  const centerY = actualSize / 2;
  const radius = actualSize * 0.38;
  const innerRadius = radius * 0.5;
  const fontSize = expanded ? 14 : 11;
  
  // Handle single item case (100%)
  if (data.length === 1) {
    return (
      <div className="pie-chart-container">
        <svg viewBox={`0 0 ${actualSize} ${actualSize}`} className="chart-svg pie-chart">
          <circle
            cx={centerX}
            cy={centerY}
            r={radius}
            fill={colors[0]}
            stroke="#ffffff"
            strokeWidth="2"
          />
          <circle cx={centerX} cy={centerY} r={innerRadius} fill="#ffffff" />
          <text
            x={centerX}
            y={centerY - 8}
            textAnchor="middle"
            fontSize={expanded ? 20 : 16}
            fill="#495057"
            fontWeight="700"
          >
            100%
          </text>
          <text
            x={centerX}
            y={centerY + 12}
            textAnchor="middle"
            fontSize={expanded ? 12 : 10}
            fill="#6c757d"
          >
            {data[0][nameKey]}
          </text>
        </svg>
        <div className={`pie-legend ${expanded ? 'expanded' : ''}`}>
          <div className="legend-item">
            <span className="legend-color" style={{ backgroundColor: colors[0] }}></span>
            <span className="legend-text">{data[0][nameKey]}</span>
            <span className="legend-value">100%</span>
          </div>
        </div>
      </div>
    );
  }
  
  let currentAngle = -90;
  
  const slices = data.map((item, index) => {
    const percentage = (item[dataKey] / total) * 100;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const pathD = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    
    return {
      path: pathD,
      color: colors[index % colors.length],
      name: item[nameKey] || 'Unknown',
      value: item[dataKey],
      percentage: percentage.toFixed(1)
    };
  });
  
  return (
    <div className="pie-chart-container">
      <svg viewBox={`0 0 ${actualSize} ${actualSize}`} className="chart-svg pie-chart">
        {slices.map((slice, index) => (
          <g key={index} className="pie-slice">
            <path
              d={slice.path}
              fill={slice.color}
              stroke="#ffffff"
              strokeWidth="2"
            />
            <title>{`${slice.name}: ${formatNumber(slice.value)} (${slice.percentage}%)`}</title>
          </g>
        ))}
        <circle cx={centerX} cy={centerY} r={innerRadius} fill="#ffffff" />
        <text
          x={centerX}
          y={centerY + 4}
          textAnchor="middle"
          fontSize={expanded ? 14 : 11}
          fill="#6c757d"
          fontWeight="500"
        >
          Total: {formatNumber(total)}
        </text>
      </svg>
      <div className={`pie-legend ${expanded ? 'expanded' : ''}`}>
        {slices.map((slice, index) => (
          <div key={index} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: slice.color }}></span>
            <span className="legend-text">{slice.name}</span>
            <span className="legend-value">{slice.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Improved Line Chart
const LineChart = ({ data, dataKey, nameKey, stroke, height = 250, expanded = false }) => {
  if (!data || data.length === 0) return <div className="no-data">No data available</div>;
  
  const maxValue = Math.max(...data.map(d => d[dataKey]));
  const padding = expanded ? 80 : 60;
  const chartWidth = 500 - padding * 2;
  const chartHeight = height - padding * 2;
  const fontSize = expanded ? 14 : 12;
  
  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = maxValue > 0 ? height - padding - (item[dataKey] / maxValue) * chartHeight : height - padding;
    return { x, y, value: item[dataKey], name: item[nameKey] };
  });
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${points[points.length - 1]?.x || padding} ${height - padding} L ${padding} ${height - padding} Z`;
  
  return (
    <svg viewBox={`0 0 500 ${height}`} className="chart-svg line-chart">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <g key={i}>
          <line
            x1={padding}
            y1={height - padding - chartHeight * ratio}
            x2={500 - padding}
            y2={height - padding - chartHeight * ratio}
            stroke="#dee2e6"
            strokeDasharray="4"
          />
          <text
            x={padding - 10}
            y={height - padding - chartHeight * ratio + 4}
            textAnchor="end"
            fontSize={fontSize}
            fill="#495057"
            fontWeight="500"
          >
            {formatNumber(maxValue * ratio)}
          </text>
        </g>
      ))}
      
      {/* Area fill */}
      <defs>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={stroke} stopOpacity="0.05"/>
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#areaGradient)" />
      
      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Points */}
      {points.map((point, index) => (
        <g key={index}>
          <circle
            cx={point.x}
            cy={point.y}
            r={expanded ? 8 : 6}
            fill="#ffffff"
            stroke={stroke}
            strokeWidth="3"
            className="chart-point"
          />
          <title>{`${point.name}: ${formatNumber(point.value)}`}</title>
          {index % Math.ceil(data.length / 6) === 0 && (
            <text
              x={point.x}
              y={height - padding + 20}
              textAnchor="middle"
              fontSize={fontSize}
              fill="#495057"
            >
              {point.name?.substring(0, 7)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
};

// Improved Horizontal Bar Chart
const HorizontalBarChart = ({ data, dataKey, nameKey, fill, height = 300, expanded = false }) => {
  if (!data || data.length === 0) return <div className="no-data">No data available</div>;
  
  const maxValue = Math.max(...data.map(d => d[dataKey]));
  const padding = expanded ? 150 : 120;
  const fontSize = expanded ? 14 : 12;
  const barHeight = Math.min(expanded ? 40 : 35, (height - 40) / data.length - 8);
  
  return (
    <svg viewBox={`0 0 500 ${height}`} className="chart-svg horizontal-bar-chart">
      {data.map((item, index) => {
        const barWidth = maxValue > 0 ? (item[dataKey] / maxValue) * (500 - padding - 60) : 0;
        const y = 25 + index * (barHeight + 12);
        
        return (
          <g key={index} className="bar-group">
            <text
              x={padding - 10}
              y={y + barHeight / 2 + 4}
              textAnchor="end"
              fontSize={fontSize}
              fill="#495057"
              fontWeight="500"
            >
              {item[nameKey]?.substring(0, expanded ? 20 : 15)}
            </text>
            <defs>
              <linearGradient id={`hBarGradient${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={fill} stopOpacity="0.8"/>
                <stop offset="100%" stopColor={fill} stopOpacity="1"/>
              </linearGradient>
            </defs>
            <rect
              x={padding}
              y={y}
              width={Math.max(barWidth, 4)}
              height={barHeight}
              fill={`url(#hBarGradient${index})`}
              rx="4"
              className="bar"
            />
            <text
              x={padding + barWidth + 10}
              y={y + barHeight / 2 + 4}
              fontSize={fontSize}
              fill="#495057"
              fontWeight="600"
            >
              {formatNumber(item[dataKey])}
            </text>
            <title>{`${item[nameKey]}: ${formatNumber(item[dataKey])}`}</title>
          </g>
        );
      })}
    </svg>
  );
};

// Chart Modal Component
const ChartModal = ({ isOpen, onClose, title, description, children }) => {
  if (!isOpen) return null;
  
  return (
    <div className="chart-modal-overlay" onClick={onClose}>
      <div className="chart-modal-content" onClick={e => e.stopPropagation()}>
        <div className="chart-modal-header">
          <h3>{title}</h3>
          <button className="chart-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="chart-modal-body">
          {children}
        </div>
        <div className="chart-modal-footer">
          <p className="chart-description">{description}</p>
        </div>
      </div>
    </div>
  );
};

// Clickable Chart Card Component
const ChartCard = ({ title, description, children, expandedContent }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <>
      <div className="chart-card clickable" onClick={() => setIsExpanded(true)}>
        <h3>{title}</h3>
        <div className="chart-content">
          {children}
        </div>
        <p className="chart-description-preview">{description}</p>
        <span className="expand-hint">Click to expand</span>
      </div>
      <ChartModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        title={title}
        description={description}
      >
        {expandedContent || children}
      </ChartModal>
    </>
  );
};

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const { token } = useContext(AdminAuthContext);
  const navigate = useNavigate();

  // Green-themed color palette
  const pieColors = ['#536438', '#73df58', '#2d8659', '#9bc930', '#17a2b8', '#6b8245', '#ffc107', '#28a745'];
  const statusColors = {
    draft: '#6c757d',
    confirmed: '#2d8659',
    processing: '#ffc107',
    shipped: '#17a2b8',
    delivered: '#28a745',
    cancelled: '#dc3545',
    submitted: '#6b8245',
    adjustment_required: '#ff9800',
    revision_requested: '#9bc930',
    issued: '#536438',
    approved: '#28a745',
    rejected: '#dc3545',
    pending: '#ffc107',
    partial: '#17a2b8',
    paid: '#28a745',
    refunded: '#dc3545'
  };

  useEffect(() => {
    fetchAnalytics();
  }, [token]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/api/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setAnalytics(response.data.data);
      } else {
        toast.error('Failed to fetch analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error(error.response?.data?.message || 'Error fetching analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="analytics-loading">
          <div className="loading-spinner"></div>
          <p>Loading analytics data...</p>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="analytics-container">
        <div className="analytics-error">
          <p>Failed to load analytics data</p>
          <button onClick={fetchAnalytics} className="retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  const { summary, topClients, mostSoldStones, monthlySales, orderStatusDistribution, 
          quotationStatusDistribution, categorySales, paymentStatusOverview, 
          weeklySalesPattern, stockStatus } = analytics;

  // Transform data for charts
  const orderStatusData = orderStatusDistribution?.map(item => ({
    name: item._id || 'Unknown',
    value: item.count
  })) || [];

  const quotationStatusData = quotationStatusDistribution?.map(item => ({
    name: item._id || 'Unknown',
    value: item.count
  })) || [];

  const paymentData = paymentStatusOverview?.map(item => ({
    name: item._id || 'Unknown',
    value: item.count,
    amount: item.totalAmount
  })) || [];

  const stockData = stockStatus?.map(item => ({
    name: item._id || 'Unknown',
    value: item.count
  })) || [];

  const categoryData = categorySales?.filter(item => item._id)?.map(item => ({
    name: item._id,
    value: item.totalRevenue
  })) || [];

  // Chart descriptions
  const chartDescriptions = {
    monthlySales: "Shows your total sales revenue month by month over the last 12 months. Helps identify seasonal trends and growth patterns.",
    topClients: "Displays your highest-value customers ranked by total purchase amount. Use this to identify and nurture key business relationships.",
    bestSelling: "Shows which stone products are most popular by quantity sold. Helps with inventory planning and marketing focus.",
    orderStatus: "Breaks down all orders by their current status (confirmed, processing, shipped, delivered, cancelled). Monitor your order pipeline.",
    quotationStatus: "Shows the distribution of quotation states. Track how many quotes are pending, approved, or rejected.",
    weeklySales: "Displays sales patterns by day of the week. Identify your busiest days to optimize staffing and operations.",
    categorySales: "Shows revenue breakdown by stone category. Understand which product categories drive the most business.",
    paymentStatus: "Overview of payment collection status across all orders. Monitor pending payments and cash flow.",
    stockAvailability: "Shows the availability status of your inventory. Track in-stock, low-stock, and out-of-stock items."
  };

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h1>Business Analytics</h1>
        <p className="analytics-subtitle">Comprehensive insights into your stone business</p>
        <button onClick={fetchAnalytics} className="refresh-btn">
          <span className="refresh-icon">↻</span> Refresh Data
        </button>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card revenue clickable" onClick={() => navigate('/orders')} title="View Orders">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <h3>Total Revenue</h3>
            <p className="card-value">{formatCurrency(summary?.totalRevenue)}</p>
            <span className={`growth-badge ${summary?.orderGrowth >= 0 ? 'positive' : 'negative'}`}>
              {summary?.orderGrowth >= 0 ? '↑' : '↓'} {Math.abs(summary?.orderGrowth || 0)}% vs last month
            </span>
          </div>
          <span className="card-link-hint">View Orders →</span>
        </div>

        <div className="summary-card orders clickable" onClick={() => navigate('/orders')} title="View Orders">
          <div className="card-icon">📦</div>
          <div className="card-content">
            <h3>Total Orders</h3>
            <p className="card-value">{summary?.totalOrders || 0}</p>
            <span className="card-label">Last 12 months</span>
          </div>
          <span className="card-link-hint">View Orders →</span>
        </div>

        <div className="summary-card quotations clickable" onClick={() => navigate('/quotes')} title="View Quotations">
          <div className="card-icon">📝</div>
          <div className="card-content">
            <h3>Quotations</h3>
            <p className="card-value">{summary?.totalQuotations || 0}</p>
            <span className="card-label">Last 12 months</span>
          </div>
          <span className="card-link-hint">View Quotes →</span>
        </div>

        <div className="summary-card customers clickable" onClick={() => navigate('/users')} title="View Customers">
          <div className="card-icon">👥</div>
          <div className="card-content">
            <h3>Total Customers</h3>
            <p className="card-value">{summary?.totalCustomers || 0}</p>
            <span className="card-label">Registered clients</span>
          </div>
          <span className="card-link-hint">View Users →</span>
        </div>

        <div className="summary-card stones clickable" onClick={() => navigate('/list')} title="View Products">
          <div className="card-icon">💎</div>
          <div className="card-content">
            <h3>Stone Products</h3>
            <p className="card-value">{summary?.totalStones || 0}</p>
            <span className="card-label">In catalog</span>
          </div>
          <span className="card-link-hint">View Products →</span>
        </div>

        <div className="summary-card conversion clickable" onClick={() => navigate('/quotes')} title="View Quotations">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>Conversion Rate</h3>
            <p className="card-value">{summary?.conversionRate || 0}%</p>
            <span className="card-label">Quote to Order</span>
          </div>
          <span className="card-link-hint">View Quotes →</span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Monthly Sales Trend */}
        <ChartCard 
          title="Monthly Sales Trend"
          description={chartDescriptions.monthlySales}
          expandedContent={
            <LineChart data={monthlySales || []} dataKey="totalSales" nameKey="month" stroke="#536438" height={350} expanded={true} />
          }
        >
          <LineChart data={monthlySales || []} dataKey="totalSales" nameKey="month" stroke="#536438" height={280} />
        </ChartCard>

        {/* Top Clients */}
        <ChartCard 
          title="Top Clients by Revenue"
          description={chartDescriptions.topClients}
          expandedContent={
            <HorizontalBarChart data={(topClients || []).slice(0, 10)} dataKey="totalPurchases" nameKey="companyName" fill="#2d8659" height={400} expanded={true} />
          }
        >
          <HorizontalBarChart data={(topClients || []).slice(0, 7)} dataKey="totalPurchases" nameKey="companyName" fill="#2d8659" height={280} />
        </ChartCard>

        {/* Most Sold Stones */}
        <ChartCard 
          title="Best Selling Stones"
          description={chartDescriptions.bestSelling}
          expandedContent={
            <HorizontalBarChart data={(mostSoldStones || []).slice(0, 10)} dataKey="totalQuantity" nameKey="stoneName" fill="#73df58" height={400} expanded={true} />
          }
        >
          <HorizontalBarChart data={(mostSoldStones || []).slice(0, 7)} dataKey="totalQuantity" nameKey="stoneName" fill="#73df58" height={280} />
        </ChartCard>

        {/* Order Status Distribution */}
        <ChartCard 
          title="Order Status Distribution"
          description={chartDescriptions.orderStatus}
          expandedContent={
            <PieChart data={orderStatusData} dataKey="value" nameKey="name" colors={orderStatusData.map(d => statusColors[d.name] || '#6c757d')} size={300} expanded={true} />
          }
        >
          <PieChart data={orderStatusData} dataKey="value" nameKey="name" colors={orderStatusData.map(d => statusColors[d.name] || '#6c757d')} size={220} />
        </ChartCard>

        {/* Quotation Status */}
        <ChartCard 
          title="Quotation Status"
          description={chartDescriptions.quotationStatus}
          expandedContent={
            <PieChart data={quotationStatusData} dataKey="value" nameKey="name" colors={quotationStatusData.map(d => statusColors[d.name] || '#6c757d')} size={300} expanded={true} />
          }
        >
          <PieChart data={quotationStatusData} dataKey="value" nameKey="name" colors={quotationStatusData.map(d => statusColors[d.name] || '#6c757d')} size={220} />
        </ChartCard>

        {/* Weekly Sales Pattern */}
        <ChartCard 
          title="Weekly Sales Pattern"
          description={chartDescriptions.weeklySales}
          expandedContent={
            <BarChart data={weeklySalesPattern || []} dataKey="totalSales" nameKey="day" fill="#6b8245" height={350} expanded={true} />
          }
        >
          <BarChart data={weeklySalesPattern || []} dataKey="totalSales" nameKey="day" fill="#6b8245" height={260} />
        </ChartCard>

        {/* Category Sales */}
        <ChartCard 
          title="Sales by Category"
          description={chartDescriptions.categorySales}
          expandedContent={
            <PieChart data={categoryData} dataKey="value" nameKey="name" colors={pieColors} size={300} expanded={true} />
          }
        >
          <PieChart data={categoryData} dataKey="value" nameKey="name" colors={pieColors} size={220} />
        </ChartCard>

        {/* Payment Status */}
        <ChartCard 
          title="Payment Status Overview"
          description={chartDescriptions.paymentStatus}
          expandedContent={
            <PieChart data={paymentData} dataKey="value" nameKey="name" colors={paymentData.map(d => statusColors[d.name] || '#6c757d')} size={300} expanded={true} />
          }
        >
          <PieChart data={paymentData} dataKey="value" nameKey="name" colors={paymentData.map(d => statusColors[d.name] || '#6c757d')} size={220} />
        </ChartCard>

        {/* Stock Status */}
        <ChartCard 
          title="Stock Availability"
          description={chartDescriptions.stockAvailability}
          expandedContent={
            <PieChart data={stockData} dataKey="value" nameKey="name" colors={['#28a745', '#ffc107', '#dc3545', '#17a2b8']} size={300} expanded={true} />
          }
        >
          <PieChart data={stockData} dataKey="value" nameKey="name" colors={['#28a745', '#ffc107', '#dc3545', '#17a2b8']} size={220} />
        </ChartCard>
      </div>

      {/* Top Clients Table */}
      <div className="data-table-section">
        <h3>Top Clients Detailed View</h3>
        <div className="table-container">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Company Name</th>
                <th>Email</th>
                <th>Total Orders</th>
                <th>Total Purchases</th>
              </tr>
            </thead>
            <tbody>
              {(topClients || []).map((client, index) => (
                <tr key={client._id || index}>
                  <td>
                    <span className={`rank-badge rank-${index + 1}`}>#{index + 1}</span>
                  </td>
                  <td>{client.companyName}</td>
                  <td>{client.email}</td>
                  <td>{client.orderCount}</td>
                  <td className="currency-cell">{formatCurrency(client.totalPurchases)}</td>
                </tr>
              ))}
              {(!topClients || topClients.length === 0) && (
                <tr>
                  <td colSpan="5" className="no-data-cell">No client data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Most Sold Stones Table */}
      <div className="data-table-section">
        <h3>Best Selling Stones Detailed View</h3>
        <div className="table-container">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Stone Name</th>
                <th>Total Quantity Sold</th>
                <th>Total Revenue</th>
                <th>Order Count</th>
              </tr>
            </thead>
            <tbody>
              {(mostSoldStones || []).map((stone, index) => (
                <tr key={stone._id || index}>
                  <td>
                    <span className={`rank-badge rank-${index + 1}`}>#{index + 1}</span>
                  </td>
                  <td>{stone.stoneName}</td>
                  <td>{stone.totalQuantity?.toLocaleString()}</td>
                  <td className="currency-cell">{formatCurrency(stone.totalRevenue)}</td>
                  <td>{stone.orderCount}</td>
                </tr>
              ))}
              {(!mostSoldStones || mostSoldStones.length === 0) && (
                <tr>
                  <td colSpan="5" className="no-data-cell">No stone sales data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
