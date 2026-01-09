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
  if (num === undefined || num === null) return 'PKR 0.00';
  return 'PKR ' + num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const [exportModal, setExportModal] = useState({ show: false, type: null });
  const { token } = useContext(AdminAuthContext);
  const navigate = useNavigate();

  // High-contrast color palette for pie charts
  const pieColors = ['#2d8659', '#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e'];
  
  // Distinct status colors with high contrast
  const statusColors = {
    draft: '#95a5a6',
    confirmed: '#3498db',
    processing: '#f39c12',
    shipped: '#9b59b6',
    dispatched: '#9b59b6',
    delivered: '#27ae60',
    cancelled: '#e74c3c',
    submitted: '#3498db',
    adjustment_required: '#e67e22',
    revision_requested: '#f39c12',
    issued: '#1abc9c',
    approved: '#27ae60',
    rejected: '#e74c3c',
    pending: '#f1c40f',
    payment_in_progress: '#3498db',
    fully_paid: '#27ae60',
    partial: '#e67e22',
    paid: '#27ae60',
    refunded: '#e74c3c'
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
        console.log(response.data.data);
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

  // Generate CSV data
  const generateCSVData = () => {
    if (!analytics) return '';
    
    const { summary, topClients, mostSoldStones, monthlySales, orderStatusDistribution, 
            quotationStatusDistribution, paymentStatusOverview } = analytics;

    let csv = [];
    
    // Summary Section
    csv.push('ARKAD MINES - ANALYTICS REPORT');
    csv.push(`Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    csv.push('');
    csv.push('=== SUMMARY ===');
    csv.push(`Total Revenue,${formatCurrency(summary?.forecastedRevenue)}`);
    csv.push(`Pending Payments,${formatCurrency(summary?.pendingPayments)}`);
    csv.push(`Total Orders,${summary?.totalOrders || 0}`);
    csv.push(`Total Quotations,${summary?.totalQuotations || 0}`);
    csv.push(`Total Customers,${summary?.totalCustomers || 0}`);
    csv.push(`Total Stones,${summary?.totalStones || 0}`);
    csv.push('');
    
    // Top Clients
    csv.push('=== TOP CLIENTS BY REVENUE ===');
    csv.push('Rank,Client Name,Email,Total Orders,Total Spent');
    (topClients || []).forEach((client, index) => {
      csv.push(`${index + 1},${client.companyName || 'N/A'},${client.email || 'N/A'},${client.orderCount || 0},${formatCurrency(client.totalSpent)}`);
    });
    csv.push('');
    
    // Best Selling Stones
    csv.push('=== BEST SELLING STONES ===');
    csv.push('Rank,Stone Name,Quantity Sold,Revenue,Order Count');
    (mostSoldStones || []).forEach((stone, index) => {
      csv.push(`${index + 1},${stone.stoneName},${stone.totalQuantity || 0},${formatCurrency(stone.totalRevenue)},${stone.orderCount || 0}`);
    });
    csv.push('');
    
    // Monthly Sales
    csv.push('=== MONTHLY SALES ===');
    csv.push('Month,Year,Revenue,Orders');
    (monthlySales || []).forEach(sale => {
      csv.push(`${sale._id?.month || 'N/A'},${sale._id?.year || 'N/A'},${formatCurrency(sale.totalSales)},${sale.orderCount || 0}`);
    });
    csv.push('');
    
    // Order Status
    csv.push('=== ORDER STATUS DISTRIBUTION ===');
    csv.push('Status,Count');
    (orderStatusDistribution || []).forEach(item => {
      csv.push(`${item._id || 'Unknown'},${item.count || 0}`);
    });
    csv.push('');
    
    // Quotation Status
    csv.push('=== QUOTATION STATUS DISTRIBUTION ===');
    csv.push('Status,Count');
    (quotationStatusDistribution || []).forEach(item => {
      csv.push(`${item._id || 'Unknown'},${item.count || 0}`);
    });
    csv.push('');
    
    // Payment Status
    csv.push('=== PAYMENT STATUS OVERVIEW ===');
    csv.push('Status,Count,Total Amount');
    (paymentStatusOverview || []).forEach(item => {
      csv.push(`${item._id || 'Unknown'},${item.count || 0},${formatCurrency(item.totalAmount)}`);
    });
    
    return csv.join('\n');
  };

  // Export as CSV
  const exportCSV = () => {
    const csvContent = generateCSVData();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `arkad_analytics_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV exported successfully!');
  };

  // Export as PDF
  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>ARKAD Mines Analytics Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #333; margin: 0; }
            h1 { color: #2d8659; border-bottom: 3px solid #2d8659; padding-bottom: 10px; }
            h2 { color: #536438; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
            h3 { color: #6b8245; margin-top: 20px; }
            .summary-box { display: inline-block; background: #f8f9fa; padding: 15px 25px; margin: 10px; border-radius: 8px; border-left: 4px solid #2d8659; }
            .summary-box h4 { margin: 0; color: #666; font-size: 12px; text-transform: uppercase; }
            .summary-box p { margin: 5px 0 0; font-size: 24px; font-weight: bold; color: #2d8659; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th { background: #2d8659; color: white; padding: 12px; text-align: left; }
            td { padding: 10px 12px; border-bottom: 1px solid #eee; }
            tr:nth-child(even) { background: #f9f9f9; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center; }
            .generated { color: #888; font-size: 12px; margin-bottom: 20px; }
            .action-bar { 
              position: fixed; 
              top: 0; 
              left: 0; 
              right: 0; 
              background: linear-gradient(135deg, #2d8659 0%, #1e5c3d 100%); 
              padding: 15px 30px; 
              display: flex; 
              justify-content: space-between; 
              align-items: center;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2);
              z-index: 1000;
            }
            .action-bar h3 { color: white; margin: 0; font-size: 18px; }
            .action-buttons { display: flex; gap: 12px; }
            .btn { 
              padding: 10px 24px; 
              border: none; 
              border-radius: 6px; 
              font-size: 14px; 
              font-weight: 600; 
              cursor: pointer; 
              transition: all 0.2s ease;
            }
            .btn-print { 
              background: white; 
              color: #2d8659; 
            }
            .btn-print:hover { 
              background: #f0f0f0; 
              transform: translateY(-2px);
            }
            .btn-close { 
              background: rgba(255,255,255,0.2); 
              color: white; 
              border: 1px solid rgba(255,255,255,0.3);
            }
            .btn-close:hover { 
              background: rgba(255,255,255,0.3); 
            }
            .report-content { margin-top: 80px; padding: 20px; }
            @media print { 
              .action-bar { display: none !important; } 
              .report-content { margin-top: 0; }
            }
          </style>
        </head>
        <body>
          <div class="action-bar">
            <h3>📄 Analytics Report Preview</h3>
            <div class="action-buttons">
              <button class="btn btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
              <button class="btn btn-close" onclick="window.close()">✕ Close</button>
            </div>
          </div>
          
          <div class="report-content">
            <h1>ARKAD Mines Analytics Report</h1>
            <p class="generated">Generated on: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            
            <h2>Summary Overview</h2>
            <div>

              <div class="summary-box"><h4>Total Revenue</h4><p>${formatCurrency(analytics?.summary?.forecastedRevenue)}</p></div>
              <div class="summary-box"><h4>Pending Payments</h4><p>${formatCurrency(analytics?.summary?.pendingPayments)}</p></div>
              <div class="summary-box"><h4>Total Orders</h4><p>${analytics?.summary?.totalOrders || 0}</p></div>
              <div class="summary-box"><h4>Total Quotations</h4><p>${analytics?.summary?.totalQuotations || 0}</p></div>
              <div class="summary-box"><h4>Total Customers</h4><p>${analytics?.summary?.totalCustomers || 0}</p></div>
            </div>
            
            <h2>Top Clients by Revenue</h2>
            <table>
              <tr><th>Rank</th><th>Client Name</th><th>Email</th><th>Orders</th><th>Total Spent</th></tr>
              ${(analytics?.topClients || []).map((client, i) => `
                <tr>
                  <td>#${i + 1}</td>
                  <td>${client.companyName || 'N/A'}</td>
                  <td>${client.email || 'N/A'}</td>
                  <td>${client.orderCount || 0}</td>
                  <td>${formatCurrency(client.totalSpent)}</td>
                </tr>
              `).join('')}
            </table>
            
            <h2>Best Selling Stones</h2>
            <table>
              <tr><th>Rank</th><th>Stone Name</th><th>Qty Sold</th><th>Revenue</th><th>Orders</th></tr>
              ${(analytics?.mostSoldStones || []).map((stone, i) => `
                <tr>
                  <td>#${i + 1}</td>
                  <td>${stone.stoneName}</td>
                  <td>${stone.totalQuantity?.toLocaleString() || 0}</td>
                  <td>${formatCurrency(stone.totalRevenue)}</td>
                  <td>${stone.orderCount || 0}</td>
                </tr>
              `).join('')}
            </table>
            
            <h2>Order Status Distribution</h2>
            <table>
              <tr><th>Status</th><th>Count</th></tr>
              ${(analytics?.orderStatusDistribution || []).map(item => `
                <tr><td>${item._id || 'Unknown'}</td><td>${item.count}</td></tr>
              `).join('')}
            </table>
            
            <h2>Payment Status Overview</h2>
            <table>
              <tr><th>Status</th><th>Count</th><th>Total Amount</th></tr>
              ${(analytics?.paymentStatusOverview || []).map(item => `
                <tr>
                  <td>${item._id || 'Unknown'}</td>
                  <td>${item.count}</td>
                  <td>${formatCurrency(item.totalAmount)}</td>
                </tr>
              `).join('')}
            </table>
            
            <div class="footer">
              <p>ARKAD Mines - Business Analytics Report</p>
              <p>This report was automatically generated from the ARKAD Mines Admin Dashboard</p>
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    toast.success('Report preview opened - use buttons to print or close');
  };

  // Get CSV preview
  const getCSVPreview = () => {
    const csvData = generateCSVData();
    return csvData.split('\n').slice(0, 35).join('\n') + '\n... (more data below)';
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
          <div className="card-icon">💵</div>
          <div className="card-content">
            <h3>Total Revenue</h3>
            <p className="card-value">{formatCurrency(summary?.totalRevenue)}</p>
            <span className="card-label">Fully paid orders only</span>
          </div>
          <span className="card-link-hint">View Orders →</span>
        </div>



        <div className="summary-card pending clickable" onClick={() => navigate('/orders')} title="View Orders">
          <div className="card-icon">⏳</div>
          <div className="card-content">
            <h3>Pending Payments</h3>
            <p className="card-value">{formatCurrency(summary?.pendingPayments)}</p>
            <span className="card-label">Awaiting payment</span>
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

      {/* Export Section */}
      <div className="export-section">
        <h3>Export Analytics Data</h3>
        <p className="export-description">Download your analytics data for reporting or further analysis</p>
        <div className="export-buttons">
          <button className="export-btn pdf-btn" onClick={exportPDF}>
            <span className="export-icon">📄</span>
            <div className="export-btn-content">
              <span className="export-btn-title">Export as PDF</span>
              <span className="export-btn-subtitle">Formatted report for printing</span>
            </div>
          </button>
          <button className="export-btn csv-btn" onClick={() => setExportModal({ show: true, type: 'csv' })}>
            <span className="export-icon">📊</span>
            <div className="export-btn-content">
              <span className="export-btn-title">Export as CSV</span>
              <span className="export-btn-subtitle">Raw data for spreadsheets</span>
            </div>
          </button>
        </div>
      </div>

      {/* CSV Preview Modal */}
      {exportModal.show && exportModal.type === 'csv' && (
        <div className="modal-overlay" onClick={() => setExportModal({ show: false, type: null })}>
          <div className="modal-content export-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📊 CSV Export Preview</h3>
              <button className="modal-close" onClick={() => setExportModal({ show: false, type: null })}>×</button>
            </div>
            <div className="csv-preview-container">
              <pre className="csv-preview">{getCSVPreview()}</pre>
            </div>
            <div className="modal-footer">
              <p className="preview-note">This is a preview of the first 35 lines. The full export contains all your analytics data.</p>
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setExportModal({ show: false, type: null })}>Cancel</button>
                <button className="confirm-btn" onClick={() => { exportCSV(); setExportModal({ show: false, type: null }); }}>
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;
