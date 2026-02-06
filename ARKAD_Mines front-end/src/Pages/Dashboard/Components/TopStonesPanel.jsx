import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

const TopStonesPanel = ({ stones }) => {
  if (!stones || stones.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100"
      style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid #f3f4f6' }}
    >
      <div className="mb-8" style={{ marginBottom: '2rem' }}>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2" style={{ fontSize: 'clamp(1.5rem, 4vw, 1.875rem)', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>
          Your Top 3 Stones
        </h2>
        <p className="text-gray-500 text-sm" style={{ color: '#6b7280', fontSize: '0.875rem' }}>Your most frequently purchased materials</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stones.map((stone, index) => (
          <StoneCard key={index} stone={stone} index={index} />
        ))}
      </div>
    </motion.div>
  );
};

const StoneCard = ({ stone, index }) => {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;
    
    const maxTilt = 8;
    const tiltX = (mouseY / rect.height) * maxTilt;
    const tiltY = (mouseX / rect.width) * -maxTilt;
    
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/300x200?text=Stone+Image';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Assuming images are served from the backend
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    return `${apiUrl}/images/${imagePath}`;
  };
  
  const imageUrl = getImageUrl(stone.image);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300"
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transformStyle: 'preserve-3d',
      }}
    >
      <div className="relative h-48 bg-gray-100 overflow-hidden">
        <img
          src={imageUrl}
          alt={stone.name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.src = 'https://via.placeholder.com/300x200?text=Stone+Image';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-900 line-clamp-2">
            {stone.name}
          </h3>
          <span className="ml-2 px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded">
            #{index + 1}
          </span>
        </div>
        
        {stone.category && (
          <p className="text-sm text-gray-500 mb-4">
            {stone.category}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Purchases:</span>
            <span className="font-semibold text-gray-900">{stone.purchases || 1}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Quantity:</span>
            <span className="font-semibold text-gray-900">{stone.quantity}</span>
          </div>
          {stone.totalValue && (
            <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
              <span className="text-gray-600">Total Value:</span>
              <span className="font-semibold text-gray-900">
                PKR {stone.totalValue.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      <motion.div
        className="absolute inset-0 bg-primary/5 opacity-0 pointer-events-none"
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
};

export default TopStonesPanel;
