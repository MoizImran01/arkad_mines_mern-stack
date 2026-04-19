import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { StoreContext } from '../../context/StoreContext';
import { useContext } from 'react';
import {
  FiArrowLeft,
  FiAlertCircle,
  FiLoader,
} from 'react-icons/fi';
import './ItemDetail.css';
import { subscribeLive } from '../../../../shared/socketLiveRegistry.js';
import { LIVE_REST_POLL_INTERVAL_MS } from '../../../../shared/liveRestPoll.js';

/** Single product page: details, image, and add-to-quote. */
const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const pathHandledRef = useRef(false);
  const { url, token, addItemToQuote } = useContext(StoreContext);

  const [stone, setStone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isImageHovering, setIsImageHovering] = useState(false);
  const [imagePosition, setImagePosition] = useState({ x: 50, y: 50 });

  const fetchStoneRef = useRef(async () => {});

  useEffect(() => {
    const fetchStone = async (silent = false) => {
      if (!id) {
        if (!silent) {
          setError('Invalid item ID');
          setLoading(false);
        }
        return;
      }

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await axios.get(`${url}/api/stones/${encodeURIComponent(id)}`, {
          params: { _cb: Date.now() },
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        });
        if (response.data.success) {
          setStone(response.data.stone);
        } else if (!silent) {
          setError(response.data.message || 'Failed to load item details');
        }
      } catch (err) {
        console.error('Error fetching stone:', err);
        if (!silent) {
          setError(err.response?.data?.message || 'Unable to load item details');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchStoneRef.current = () => fetchStone(true);
    fetchStone(false);
  }, [id, url]);

  useEffect(() => subscribeLive('stones', () => fetchStoneRef.current()), []);

  useEffect(() => {
    const tick = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      fetchStoneRef.current();
    }, LIVE_REST_POLL_INTERVAL_MS);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchStoneRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const onFocus = () => fetchStoneRef.current();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    if (!pathHandledRef.current) {
      pathHandledRef.current = true;
      return;
    }
    fetchStoneRef.current();
  }, [location.pathname]);

  const handleImageMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setImagePosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
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

  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/800x600?text=No+Image';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    return `${url}/images/${imagePath}`;
  };

  if (loading) {
    return (
      <div className="item-detail-container">
        <div className="loading-state">
          <FiLoader className="spin" size={24} />
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
              className="item-image-wrapper"
              onMouseEnter={() => setIsImageHovering(true)}
              onMouseLeave={() => {
                setIsImageHovering(false);
                setImagePosition({ x: 50, y: 50 });
              }}
              onMouseMove={handleImageMouseMove}
            >
              <img
                src={getImageUrl(stone.image)}
                alt={stone.stoneName}
                style={{
                  transform: isImageHovering ? 'scale(1.9)' : 'scale(1)',
                  transformOrigin: `${imagePosition.x}% ${imagePosition.y}%`,
                }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/800x600?text=No+Image';
                }}
              />
              <div className={`zoom-indicator ${isImageHovering ? 'active' : ''}`}>
                Hover to zoom
              </div>
            </div>
          </div>

          <div className="item-info-section">
            <div className="item-heading-block">
              <h1 className="item-title">{stone.stoneName}</h1>
            </div>

            <div className="detail-cards-grid">
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
                <p className="dimensions">{stone.dimensions || 'N/A'}</p>
              </div>

              <div className="info-section">
                <h3>Stone Type</h3>
                <p>{stone.subcategory || 'N/A'}</p>
              </div>

              <div className="info-section">
                <h3>Stone Category</h3>
                <p>{stone.category || 'N/A'}</p>
              </div>

              <div className="info-section">
                <h3>Location</h3>
                <p>{stone.location || 'N/A'}</p>
              </div>
            </div>

            <div className="info-section notes-panel">
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
              {(stone.stockQuantity || 0) - (stone.quantityDelivered || 0) > 0 && (
                <button
                  className="primary-btn"
                  onClick={() => {
                    addItemToQuote(stone);
                    navigate('/request-quote');
                  }}
                >
                  Request Quote
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

