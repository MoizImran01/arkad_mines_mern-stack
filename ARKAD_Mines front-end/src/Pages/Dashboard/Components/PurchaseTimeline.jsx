import React, { useState, useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';

const PurchaseTimeline = ({ timeline }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const scrollContainerRef = useRef(null);
  const containerRef = useRef(null);
  const tooltipRefs = useRef({});
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  const groupedTimeline = timeline.reduce((acc, purchase) => {
    const monthKey = purchase.month;
    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: monthKey,
        date: purchase.date,
        dateString: purchase.dateString || (purchase.date ? new Date(purchase.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''),
        purchases: [],
        totalValue: 0,
      };
    }
    acc[monthKey].purchases.push(...purchase.stones);
    acc[monthKey].totalValue += purchase.totalValue;
    return acc;
  }, {});

  const timelineData = Object.values(groupedTimeline).sort((a, b) => a.date - b.date);

  if (!timelineData || timelineData.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100" style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #f3f4f6' }}>
      <div className="mb-8 flex items-center justify-between" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2" style={{ fontSize: 'clamp(1.5rem, 4vw, 1.875rem)', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>
            Purchase Rhythm Timeline
          </h2>
          <p className="text-gray-500 text-sm" style={{ color: '#6b7280', fontSize: '0.875rem' }}>Your purchasing activity over time</p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-sm text-gray-500" style={{ display: 'none' }}>
          <span className="w-3 h-3 bg-primary rounded-full" style={{ width: '12px', height: '12px', backgroundColor: '#536438', borderRadius: '50%' }}></span>
          <span>{timelineData.length} Month{timelineData.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto pb-4"
        style={{ 
          scrollbarWidth: 'thin', 
          position: 'relative', 
          paddingTop: '140px',
          paddingBottom: '20px',
          overflowY: 'visible'
        }}
      >
        <div
          ref={containerRef}
          className="flex items-end gap-6 min-w-max px-4"
          style={{ height: '200px', position: 'relative', overflow: 'visible' }}
        >
          {timelineData.map((item, index) => {
            const isFirst = index === 0;
            const isLast = index === timelineData.length - 1;
            const isNearLeft = index < 2;
            const isNearRight = index >= timelineData.length - 2;
            
            let positionClass = 'center';
            if (isFirst || isNearLeft) {
              positionClass = 'left';
            } else if (isLast || isNearRight) {
              positionClass = 'right';
            }
            
            let tooltipStyle = {
              pointerEvents: 'none',
              bottom: '100%',
              marginBottom: '12px',
              width: '240px',
              maxHeight: '280px',
              whiteSpace: 'normal',
              wordWrap: 'break-word',
              overflowY: 'auto',
              overflowX: 'hidden',
            };
            
            let arrowStyle = {
              position: 'absolute',
              top: '100%',
              marginTop: '-4px',
            };
            
            if (positionClass === 'left') {
              tooltipStyle.left = '0%';
              tooltipStyle.right = 'auto';
              tooltipStyle.transform = 'none';
              arrowStyle.left = '20px';
              arrowStyle.transform = 'none';
            } else if (positionClass === 'right') {
              tooltipStyle.left = 'auto';
              tooltipStyle.right = '0%';
              tooltipStyle.transform = 'none';
              arrowStyle.left = 'auto';
              arrowStyle.right = '20px';
              arrowStyle.transform = 'none';
            } else {
              tooltipStyle.left = '50%';
              tooltipStyle.right = 'auto';
              tooltipStyle.transform = 'translateX(-50%)';
              arrowStyle.left = '50%';
              arrowStyle.transform = 'translateX(-50%)';
            }
            
            return (
            <motion.div
              key={item.month}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="relative flex flex-col items-center group"
              style={{ position: 'relative' }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {hoveredIndex === index && (
                <motion.div
                  ref={(el) => {
                    if (el) tooltipRefs.current[index] = el;
                  }}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bg-gray-900 text-white text-sm rounded-lg px-4 py-3 shadow-xl z-50"
                  style={tooltipStyle}
                >
                  <div className="font-semibold mb-2 text-base sticky top-0 bg-gray-900 pb-2">{item.month}</div>
                  <div className="text-xs text-gray-300 mb-2 pb-2 border-b border-gray-700">
                    Date: {item.dateString || (item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A')}
                  </div>
                  <div className="text-xs text-gray-300 mb-2">
                    {item.purchases.length} purchase{item.purchases.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-gray-300 space-y-1.5">
                    {item.purchases.map((stone, idx) => (
                      <div key={idx} className="flex justify-between gap-2 items-start">
                        <span className="font-medium flex-1 break-words">{stone.name}</span>
                        <span className="text-gray-400 whitespace-nowrap flex-shrink-0">Qty: {stone.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs font-medium mt-3 pt-2 border-t border-gray-700 sticky bottom-0 bg-gray-900">
                    Total: PKR {item.totalValue.toLocaleString()}
                  </div>
                  <div style={arrowStyle}>
                    <div className="w-2 h-2 bg-gray-900 transform rotate-45" />
                  </div>
                </motion.div>
              )}

              <motion.div
                className="w-12 h-12 rounded-full bg-gradient-to-br from-primary via-primary-light to-primary-dark shadow-md cursor-pointer relative"
                whileHover={{ scale: 1.2 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: hoveredIndex === index
                    ? 'linear-gradient(135deg, #536438 0%, #6b8248 50%, #536438 100%)'
                    : 'linear-gradient(135deg, #6b8248 0%, #536438 100%)',
                }}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent" />
              </motion.div>

              <div className="mt-3 text-xs font-medium text-gray-600 text-center">
                {item.month.split(' ')[0]}
              </div>
            </motion.div>
            );
          })}
        </div>
      </div>

      <div className="relative mt-4">
        <div className="h-0.5 bg-gray-200" />
        <div
          className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-primary-light via-primary to-primary-light"
          style={{
            width: `${Math.min(100, (timelineData.length / Math.max(timelineData.length, 12)) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
};

export default PurchaseTimeline;
