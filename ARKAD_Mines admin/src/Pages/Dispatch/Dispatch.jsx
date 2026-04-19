import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Dispatch.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Html5Qrcode } from 'html5-qrcode';
import {
  FiInfo, FiXCircle, FiSearch,
  FiGrid, FiCamera, FiType, FiHash
} from 'react-icons/fi';
import Pagination from '../../../../shared/Pagination.jsx';

const API_URL = import.meta.env.VITE_API_URL ?? '';
const ORDERS_PER_PAGE = 10;


const normalizeQrValue = (rawValue) => {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('{')) return raw;
  try {
    const parsed = JSON.parse(raw);
    return String(parsed.blockId || parsed.qrCode || '').trim() || raw;
  } catch {
    return raw;
  }
};

const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://via.placeholder.com/100?text=No+QR';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  return `${API_URL}/images/${imagePath}`;
};

const authHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const STATUS_LABEL = {
  draft: 'PENDING',
  confirmed: 'CONFIRMED',
  dispatched: 'DISPATCHED',
  delivered: 'DELIVERED',
  cancelled: 'CANCELLED',
};

const PAYMENT_LABEL = {
  pending: 'UNPAID',
  payment_in_progress: 'PARTIAL / IN PROGRESS',
  fully_paid: 'FULLY PAID',
};


const BlockInfo = () => {
  const [qrCode, setQrCode]             = useState('');
  const [loading, setLoading]           = useState(false);
  const [blockInfo, setBlockInfo]       = useState(null);
  const [blockOrders, setBlockOrders]   = useState([]);
  const [scanMode, setScanMode]         = useState('manual');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState('');
  const [currentPage, setCurrentPage]   = useState(1);

  const html5QrcodeRef = useRef(null);
  const scanLockedRef  = useRef(false);


  const stopCamera = useCallback(async () => {
    if (html5QrcodeRef.current) {
      try {
        const state = html5QrcodeRef.current.getState();
        if (state === 2 || state === 3) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch {
      }
      html5QrcodeRef.current = null;
    }
    setCameraActive(false);
    scanLockedRef.current = false;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    await stopCamera();

    try {
      const scanner = new Html5Qrcode('qr-reader-box');
      html5QrcodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
        async (decodedText) => {
          if (scanLockedRef.current) return;
          scanLockedRef.current = true;

          const code = normalizeQrValue(decodedText);
          if (!code) { scanLockedRef.current = false; return; }

          toast.success('QR code scanned!');
          await stopCamera();
          setScanMode('manual');
          setQrCode(code);
          await searchBlock(code);
        },
        () => { /* scan failure — keep trying, ignore */ }
      );

      setCameraActive(true);
    } catch (err) {
      html5QrcodeRef.current = null;
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
        setCameraError('Camera permission denied. Please allow camera access and try again.');
      } else if (msg.toLowerCase().includes('https') || msg.toLowerCase().includes('secure')) {
        setCameraError('Camera requires a secure (HTTPS) connection. See the testing guide below.');
      } else {
        setCameraError('Could not start camera. Try manual entry or check camera permissions.');
      }
      setScanMode('manual');
    }
  }, [stopCamera]);

  useEffect(() => {
    if (scanMode !== 'camera') stopCamera();
  }, [scanMode, stopCamera]);

  useEffect(() => () => { stopCamera(); }, [stopCamera]);


  const searchBlock = async (inputQrCode = qrCode) => {
    const code = normalizeQrValue(inputQrCode);
    if (!code) { toast.error('Please enter a QR code'); return; }

    const token = localStorage.getItem('adminToken');
    if (!token) { toast.error('No authentication token. Please login again.'); return; }

    try {
      setLoading(true);
      setBlockInfo(null);
      setBlockOrders([]);
      setCurrentPage(1);

      const [blockRes, ordersRes] = await Promise.all([
        axios.get(`${API_URL}/api/stones/qr/${encodeURIComponent(code)}`, { headers: authHeaders() }),
        axios.get(`${API_URL}/api/orders/admin/orders-by-block/${encodeURIComponent(code)}`, { headers: authHeaders() }),
      ]);

      if (!blockRes.data.success) {
        toast.error(blockRes.data.message || 'Block not found');
        return;
      }

      setQrCode(code);
      setBlockInfo(blockRes.data.block);

      if (ordersRes.data.success) {
        setBlockOrders(ordersRes.data.orders || []);
      }
    } catch (error) {
      const status = error?.response?.status;
      const msg    = error?.response?.data?.message;
      if (status === 404) toast.error(msg || 'Block not found with this QR code');
      else if (status === 401 || status === 403) toast.error('Session expired. Please login again.');
      else if (!error?.response) toast.error('Cannot reach backend. Check server status.');
      else toast.error(msg || 'Failed to search block. Please try again.');
      setBlockInfo(null);
      setBlockOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setBlockInfo(null);
    setBlockOrders([]);
    setQrCode('');
    setCurrentPage(1);
    scanLockedRef.current = false;
  };

  const totalOrders = blockOrders.length;
  const pageStart = (currentPage - 1) * ORDERS_PER_PAGE;
  const paginatedOrders = blockOrders.slice(pageStart, pageStart + ORDERS_PER_PAGE);


  return (
    <div className="dispatch-container">
      <div className="dispatch-header">
        <h1><FiInfo className="header-icon" /> Block Information</h1>
        <p>Scan or enter a QR code to view block details and related orders</p>
      </div>

      <div className="dispatch-search-section">

        {/* ── Manual / Camera toggle ── */}
        <div className="scan-mode-toggle">
          <button
            className={`mode-btn ${scanMode === 'manual' ? 'active' : ''}`}
            onClick={() => setScanMode('manual')}
          >
            <FiType /> Manual Entry
          </button>
          <button
            className={`mode-btn ${scanMode === 'camera' ? 'active' : ''}`}
            onClick={() => {
              setScanMode('camera');
            }}
          >
            <FiCamera /> Camera Scan
          </button>
        </div>

        <div className="instructions-box">
          <p><strong>How to look up a block:</strong></p>
          <ul>
            <li><strong>Manual:</strong> Type the QR code ID (UUID) and press <em>Search Block</em>.</li>
            <li><strong>Camera:</strong> Tap <em>Camera Scan</em> and point your device at the QR code.</li>
            <li>Block details and any related orders will appear below.</li>
          </ul>
        </div>

        {/* ── Manual input ── */}
        {scanMode === 'manual' && (
          <div className="search-box">
            <FiGrid className="search-icon" />
            <input
              type="text"
              placeholder="Enter QR code ID (UUID)…"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchBlock()}
              className="qr-input"
              disabled={loading}
              autoFocus
            />
            <button
              className="search-btn"
              onClick={() => searchBlock()}
              disabled={loading || !qrCode.trim()}
            >
              {loading ? 'Searching…' : <><FiSearch /> Search Block</>}
            </button>
          </div>
        )}

        {/* ── Camera scan ── */}
        {scanMode === 'camera' && (
          <CameraScanner
            onStart={startCamera}
            onStop={() => { stopCamera(); setScanMode('manual'); }}
            cameraActive={cameraActive}
            cameraError={cameraError}
          />
        )}
      </div>

      {/* ── Block info + related orders ── */}
      {blockInfo && (
        <div className="block-info-card">
          <div className="block-info-header">
            <h3>Block Information</h3>
          </div>

          <div className="block-details">
            {[
              ['Stone Name',         blockInfo.stoneName],
              ['Dimensions',         blockInfo.dimensions],
              ['Category',           blockInfo.category],
              ['Grade',              blockInfo.grade || 'Standard'],
              ['Stock Availability', blockInfo.stockAvailability],
            ].map(([label, value]) => (
              <div className="detail-row" key={label}>
                <span className="detail-label">{label}:</span>
                <span className="detail-value">{value}</span>
              </div>
            ))}

            {blockInfo.qrCodeImage && (
              <div className="detail-row qr-preview">
                <span className="detail-label">QR Code:</span>
                <div className="qr-preview-image">
                  <img src={getImageUrl(blockInfo.qrCodeImage)} alt="QR Code" />
                </div>
              </div>
            )}
          </div>

          {/* ── Orders linked to this block ── */}
          <div className="order-picker-section">
            <h4 className="order-picker-title">
              <FiHash /> Orders for this Block
            </h4>

            {blockOrders.length === 0 ? (
              <div className="no-orders-notice">
                No orders found for this block yet.
              </div>
            ) : (
              <div className="order-list">
                {paginatedOrders.map((order) => (
                  <div key={order.orderNumber} className="order-option">
                    <div className="order-option-body">
                      <div className="order-option-top">
                        <span className="order-option-number">{order.orderNumber}</span>
                        <span className={`order-status-chip status-${order.status}`}>
                          {STATUS_LABEL[order.status] || order.status}
                        </span>
                        <span
                          className={`order-status-chip payment-${order.paymentStatus || 'pending'}`}
                          style={{
                            backgroundColor:
                              order.paymentStatus === 'fully_paid' ? '#d1fae5' :
                              order.paymentStatus === 'payment_in_progress' ? '#fef3c7' : '#fee2e2',
                            color:
                              order.paymentStatus === 'fully_paid' ? '#065f46' :
                              order.paymentStatus === 'payment_in_progress' ? '#92400e' : '#991b1b',
                            marginLeft: '6px',
                          }}
                          title="Payment status"
                        >
                          {PAYMENT_LABEL[order.paymentStatus] || 'UNPAID'}
                        </span>
                      </div>
                      <div className="order-option-meta">
                        <span>{order.buyerName}</span>
                        <span className="order-option-qty">
                          {order.quantityDispatched}/{order.orderedQuantity} dispatched · {order.remainingQuantity} remaining
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalOrders > ORDERS_PER_PAGE && (
              <Pagination
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                totalItems={totalOrders}
                itemsPerPage={ORDERS_PER_PAGE}
                label="orders"
              />
            )}
          </div>

          {/* ── Clear ── */}
          <div className="dispatch-actions">
            <button className="cancel-btn" onClick={resetAll}>
              <FiXCircle /> Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


const CameraScanner = ({ onStart, onStop, cameraActive, cameraError }) => {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      onStart();
    }
    return () => { startedRef.current = false; };
  }, []); //run once on mount

  return (
    <div className="camera-scan-container">
      {cameraError ? (
        <div className="camera-error-box">
          <FiXCircle className="camera-error-icon" />
          <p>{cameraError}</p>
        </div>
      ) : (
        <>
          {/* html5-qrcode renders the video feed directly inside this div */}
          <div id="qr-reader-box" className="qr-reader-box" />
          {!cameraActive && (
            <div className="camera-starting">
              <div className="camera-spinner" />
              <p>Starting camera…</p>
            </div>
          )}
        </>
      )}
      <button className="stop-camera-btn" onClick={onStop}>
        <FiXCircle /> Stop Camera
      </button>
    </div>
  );
};

export default BlockInfo;
