import React from 'react';
import { motion } from 'framer-motion';

const StonePersonalityCard = ({ personality }) => {
  const personalityConfig = {
    'Bold & Industrial': {
      gradient: 'from-gray-800 via-gray-700 to-gray-900',
      textColor: 'text-gray-100',
      description: 'Your selections favor strong, dramatic materials that make a statement.',
    },
    'Classic & Timeless': {
      gradient: 'from-stone-600 via-stone-500 to-stone-700',
      textColor: 'text-stone-50',
      description: 'You prefer elegant, enduring materials that stand the test of time.',
    },
    'Luminous & Contemporary': {
      gradient: 'from-gray-200 via-gray-100 to-gray-300',
      textColor: 'text-gray-800',
      description: 'Your choices reflect a modern aesthetic with bright, refined materials.',
    },
  };

  const config = personalityConfig[personality] || personalityConfig['Classic & Timeless'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative"
    >
      <motion.div
        className="relative bg-white rounded-2xl p-8 md:p-10 shadow-xl overflow-hidden border border-gray-100"
        style={{
          background: 'white',
          borderRadius: '1rem',
          padding: '2rem 2.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          border: '1px solid #f3f4f6',
        }}
        whileHover={{ y: -4, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, 
              rgba(83, 100, 56, 0.1) 0%, 
              rgba(107, 130, 72, 0.2) 50%, 
              rgba(83, 100, 56, 0.1) 100%)`,
            padding: '2px',
          }}
          animate={{
            background: [
              'linear-gradient(135deg, rgba(83, 100, 56, 0.1) 0%, rgba(107, 130, 72, 0.2) 50%, rgba(83, 100, 56, 0.1) 100%)',
              'linear-gradient(225deg, rgba(107, 130, 72, 0.2) 0%, rgba(83, 100, 56, 0.1) 50%, rgba(107, 130, 72, 0.2) 100%)',
              'linear-gradient(135deg, rgba(83, 100, 56, 0.1) 0%, rgba(107, 130, 72, 0.2) 50%, rgba(83, 100, 56, 0.1) 100%)',
            ],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          <div className="bg-white rounded-2xl h-full w-full" />
        </motion.div>

        <div className="relative z-10" style={{ position: 'relative', zIndex: 10 }}>
          <div className="mb-4 flex items-center gap-2" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary-light rounded-full" style={{ width: '4px', height: '2rem', background: 'linear-gradient(to bottom, #536438, #6b8248)', borderRadius: '9999px' }}></div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wide" style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Material Personality
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight" style={{ fontSize: 'clamp(1.875rem, 5vw, 3rem)', fontWeight: '700', color: '#111827', marginBottom: '1rem', lineHeight: '1.2' }}>
            {personality}
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed max-w-2xl" style={{ color: '#4b5563', fontSize: '1.125rem', lineHeight: '1.75', maxWidth: '42rem' }}>
            {config.description}
          </p>
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: '1.25rem', height: '1.25rem', color: '#536438' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Based on your purchase patterns</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default StonePersonalityCard;
