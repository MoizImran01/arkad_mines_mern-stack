import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { StoreContext } from '../../context/StoreContext';
import { useContext } from 'react';
import {
  FiArrowLeft,
  FiZoomIn,
  FiZoomOut,
  FiPackage,
  FiMapPin,
  FiFileText,
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
} from 'react-icons/fi';
import './ItemDetail.css';

const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { url, token, addItemToQuote } = useContext(StoreContext);

  const [stone, setStone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageZoom, setImageZoom] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const fetchStone = async () => {
      if (!id) {
        setError('Invalid item ID');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await axios.get(`${url}/api/stones/${id}`);
        
        if (response.data.success) {
          setStone(response.data.stone);
        } else {
          setError(response.data.message || 'Failed to load item details');
        }
      } catch (err) {
        console.error('Error fetching stone:', err);
        setError(err.response?.data?.message || 'Unable to load item details');
      } finally {
        setLoading(false);
      }
    };

    fetchStone();
  }, [id, url]);

  const handleImageClick = () => {
    setImageZoom(!imageZoom);
    setZoomLevel(1);
  };

  const handleZoomIn = (e) => {
    e.stopPropagation();
    setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e) => {
    e.stopPropagation();
    setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  };

  const formatCategory = (category) => {
    if (!category) return 'N/A';
    return category.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatSubcategory = (subcategory) => {
    if (!subcategory) return 'N/A';
    return subcategory.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getStockStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('available') || statusLower === 'in stock') {
      return 'available';
    } else if (statusLower.includes('reserved')) {
      return 'reserved';
    } else if (statusLower.includes('hold')) {
      return 'hold';
    } else if (statusLower.includes('out of stock')) {
      return 'out-of-stock';
    } else {
      return 'unknown';
    }
  };

  // Get image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/800x600?text=No+Image';
    // If it's already a full URL (Cloudinary), return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Otherwise, construct local URL for legacy images
    return `${url}/images/${imagePath}`;
  };

  if (loading) {
    return (
      <div className="item-detail-container">
        <div className="loading-state">
          <FiRefreshCw className="spin" />
          <p>Loading item details...</p>
        </div>
      </div>
    );
  }

  if (error || !stone) {
    return (
      <div className="item-detail-container">
        <div className="error-state">
          <FiAlertCircle />
          <h3>Unable to Load Item</h3>
          <p>{error || 'Item not found'}</p>
          <button className="primary-btn" onClick={() => navigate('/products')}>
            <FiArrowLeft /> Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="item-detail-container">
      <button className="back-btn" onClick={() => navigate('/products')}>
        <FiArrowLeft /> Back to Catalog
      </button>

      <div className="item-detail-content">
        <div className="item-detail-main">
          <div className="item-image-section">
            <div 
              className={`item-image-wrapper ${imageZoom ? 'zoomed' : ''}`}
              onClick={handleImageClick}
            >
              <img
                src={getImageUrl(stone.image)}
                alt={stone.stoneName}
                style={{ transform: `scale(${zoomLevel})` }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/800x600?text=No+Image';
                }}
              />
              {imageZoom && (
                <div className="zoom-controls">
                  <button onClick={handleZoomIn} title="Zoom In">
                    <FiZoomIn />
                  </button>
                  <span>{Math.round(zoomLevel * 100)}%</span>
                  <button onClick={handleZoomOut} title="Zoom Out">
                    <FiZoomOut />
                  </button>
                </div>
              )}
            </div>
            {!imageZoom && (
              <p className="image-hint">Click image to zoom</p>
            )}
          </div>

          <div className="item-info-section">
            <h1>{stone.stoneName}</h1>
            
            <div className="info-section">
              <h3>Stock Status</h3>
              <div className={`stock-status ${getStockStatusColor(stone.stockAvailability)}`}>
                <span className="status-badge">
                  {stone.stockAvailability || 'Unknown'}
                </span>
              </div>
            </div>

            <div className="info-section">
              <h3>Dimensions</h3>
              <p className="dimensions">{stone.dimensions}</p>
            </div>

            <div className="info-section">
              <h3>Location</h3>
              {stone.location ? (
                <p>{stone.location}</p>
              ) : (
                <p className="no-data">Location not specified</p>
              )}
            </div>

            <div className="info-section">
              <h3>Notes</h3>
              {stone.qaNotes && (
                <div className="notes-content">
                  <strong>QA Notes:</strong>
                  <p>{stone.qaNotes}</p>
                </div>
              )}
              {stone.defects && (
                <div className="notes-content defects">
                  <strong>Defects:</strong>
                  <p>{stone.defects}</p>
                </div>
              )}
              {!stone.qaNotes && !stone.defects && (
                <p className="no-data">No notes recorded</p>
              )}
            </div>

            <div className="item-actions">
              {(stone.stockQuantity || 0) - (stone.quantityDelivered || 0) > 0 ? (
                <button
                  className="primary-btn"
                  onClick={() => {
                    addItemToQuote(stone);
                    navigate('/request-quote');
                  }}
                >
                  Request Quote
                </button>
              ) : (
                <button className="primary-btn disabled" disabled>
                  Out of Stock
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemDetail;

