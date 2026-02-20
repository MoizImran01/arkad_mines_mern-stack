import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './ForecastTrendChart.css';

const fmt = (n) => {
  if (n === null || n === undefined) return 'N/A';
  return Number(n).toFixed(2);
};

const ForecastTrendChart = ({ forecasts = [] }) => {
  // Filter forecasts that have chart_data
  const forecastsWithChartData = useMemo(() => {
    return forecasts.filter((f) => f.chart_data && Array.isArray(f.chart_data) && f.chart_data.length > 0);
  }, [forecasts]);

  // State for selected SKU
  const [selectedSku, setSelectedSku] = useState(() => {
    return forecastsWithChartData.length > 0 ? forecastsWithChartData[0].sku : '';
  });

  // Get the selected forecast's chart data
  const selectedForecast = useMemo(() => {
    return forecastsWithChartData.find((f) => f.sku === selectedSku) || forecastsWithChartData[0];
  }, [forecastsWithChartData, selectedSku]);

  const chartData = selectedForecast?.chart_data || [];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const actualData = payload.find((p) => p.dataKey === 'actual');
      const forecastData = payload.find((p) => p.dataKey === 'forecast');
      
      // Determine if this is historical or future data
      const isHistorical = actualData?.value !== null && actualData?.value !== undefined;
      
      return (
        <div className="trend-chart-tooltip">
          <p className="tooltip-month">{label}</p>
          {isHistorical ? (
            <>
              <p className="tooltip-label" style={{ color: '#4f46e5' }}>
                Actual: <span className="tooltip-value">{fmt(actualData?.value)} Tons</span>
              </p>
              {forecastData && (
                <p className="tooltip-label" style={{ color: '#f59e0b' }}>
                  Forecast: <span className="tooltip-value">{fmt(forecastData.value)} Tons</span>
                </p>
              )}
              <p className="tooltip-note">Historical Data</p>
            </>
          ) : (
            <>
              <p className="tooltip-label" style={{ color: '#f59e0b' }}>
                Forecast: <span className="tooltip-value">{fmt(forecastData?.value)} Tons</span>
              </p>
              <p className="tooltip-note future">Future Prediction</p>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  // Custom legend formatter
  const renderLegend = (props) => {
    const { payload } = props;
    return (
      <div className="trend-chart-legend">
        {payload.map((entry, index) => (
          <div key={index} className="legend-item">
            <div
              className="legend-color"
              style={{ backgroundColor: entry.color }}
            />
            <span className="legend-label">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (forecastsWithChartData.length === 0) {
    return null;
  }

  return (
    <div className="forecast-trend-chart-card">
      <div className="trend-chart-header">
        <div className="trend-chart-title-section">
          <h3 className="trend-chart-title">AI Forecast Trendline Model</h3>
          <p className="trend-chart-subtitle">Time-series analysis of actual vs. forecasted demand</p>
        </div>
        <div className="trend-chart-selector-wrapper">
          <label htmlFor="sku-selector" className="sku-selector-label">
            Select SKU:
          </label>
          <select
            id="sku-selector"
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
            className="sku-selector"
          >
            {forecastsWithChartData.map((forecast) => (
              <option key={forecast.sku} value={forecast.sku}>
                {forecast.sku}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="trend-chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="month"
              stroke="#94a3b8"
              fontSize={12}
              tick={{ fill: '#64748b' }}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={12}
              tick={{ fill: '#64748b' }}
              label={{
                value: 'Quantity (Tons)',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#64748b', fontSize: '12px' }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual"
              stroke="#4f46e5"
              strokeWidth={3}
              dot={{ fill: '#4f46e5', r: 4 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              name="Forecast"
              stroke="#f59e0b"
              strokeWidth={2.5}
              strokeDasharray="5 5"
              dot={{ fill: '#f59e0b', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ForecastTrendChart;
