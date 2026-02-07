import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import '../Dashboard.css';
import { motion } from 'framer-motion';

const MaterialPreferenceChart = ({ preferences }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [animatedData, setAnimatedData] = useState([]);

  const getCategoryData = () => {
    if (!preferences) {
      return [];
    }

    const categories = [
      preferences.category1,
      preferences.category2,
      preferences.category3,
      preferences.category4,
      preferences.category5,
    ]
      .filter(cat => cat && typeof cat === 'object' && cat.value > 0)
      .map(cat => ({
        name: cat.name || 'Unknown',
        value: cat.value || 0,
      }));

    return categories;
  };

  const COLORS = [
    '#536438', // Primary green
    '#6b8248', // Primary light green
    '#3a471f', // Primary dark green
    '#2d8659', // Accent green
    '#4a7c59', // Medium green
    '#5a8a5a', // Light green
    '#3a5f3a', // Forest green
    '#7a9a6a', // Sage green
  ];

  useEffect(() => {
    const targetData = getCategoryData();

    if (targetData.length === 0) {
      setAnimatedData([]);
      return;
    }

    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setAnimatedData(
        targetData.map(item => ({
          ...item,
          value: Math.round(item.value * easedProgress),
        }))
      );

      if (currentStep >= steps) {
        clearInterval(interval);
        setAnimatedData(targetData);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [preferences]);

  const totalValue = animatedData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : 0;
      return (
        <div style={{
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          fontSize: '14px',
        }}>
          <div style={{ fontWeight: '600', marginBottom: '4px' }}>{data.name}</div>
          <div style={{ fontSize: '12px', color: '#d1d5db' }}>
            {percentage}% of purchases
          </div>
          <div style={{ fontSize: '12px', color: '#d1d5db', marginTop: '2px' }}>
            Value: {data.value}%
          </div>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.05) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
        style={{ pointerEvents: 'none' }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-xl border border-gray-100 dashboard-compact-card"
    >
      <div className="dashboard-compact-header">
        <div>
          <h2 className="dashboard-compact-title">Material preferences</h2>
          <p className="dashboard-compact-subtitle">Breakdown by category</p>
        </div>
      </div>
      
      {animatedData.length === 0 ? (
        <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
          <p>No category data available</p>
        </div>
      ) : (
        <>
          <div className="w-full" style={{ height: '260px', minHeight: '260px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={animatedData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomLabel}
                  outerRadius={120}
                  innerRadius={60}
                  fill="#8884d8"
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                  animationEasing="ease-out"
                  onMouseEnter={(data, index) => setSelectedCategory(index)}
                  onMouseLeave={() => setSelectedCategory(null)}
                >
                  {animatedData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      style={{
                        filter: selectedCategory === index ? 'brightness(1.2)' : 'brightness(1)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        stroke: selectedCategory === index ? '#ffffff' : 'none',
                        strokeWidth: selectedCategory === index ? 3 : 0,
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            {animatedData.map((item, index) => {
              const percentage = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : 0;
              const isSelected = selectedCategory === index;
              
              return (
                <motion.div
                  key={index}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer"
                  style={{
                    background: isSelected ? '#f3f4f6' : 'transparent',
                    border: `2px solid ${isSelected ? COLORS[index % COLORS.length] : 'transparent'}`,
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={() => setSelectedCategory(index)}
                  onMouseLeave={() => setSelectedCategory(null)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      backgroundColor: COLORS[index % COLORS.length],
                      transition: 'all 0.3s ease',
                      transform: isSelected ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: '600', color: '#111827', fontSize: '14px' }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {percentage}% • {item.value}% value
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </motion.div>
  );
};

export default MaterialPreferenceChart;
