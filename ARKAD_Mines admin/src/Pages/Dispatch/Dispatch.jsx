import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Dispatch.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Html5Qrcode } from 'html5-qrcode';
import {
  FiPackage, FiCheckCircle, FiXCircle, FiSearch,
  FiGrid, FiCamera, FiType, FiHash, FiChevronDown, FiChevronUp
} from 'react-icons/fi';

const API_URL = import.meta.env.VITE_API_URL ?? '';


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


const Dispatch = () => {
  const [qrCode, setQrCode]                           = useState('');
  const [loading, setLoading]                         = useState(false);
  const [blockInfo, setBlockInfo]                     = useState(null);
  const [blockOrders, setBlockOrders]                 = useState([]);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState('');
  const [scanMode, setScanMode]                       = useState('manual');
  const [cameraActive, setCameraActive]               = useState(false);
  const [cameraError, setCameraError]                 = useState('');

  const [showOrderSearch, setShowOrderSearch]     = useState(false);
  const [orderSearch, setOrderSearch]             = useState('');
  const [orderOptions, setOrderOptions]           = useState([]);
  const [orderDropdownOpen, setOrderDropdownOpen] = useState(false);

  const html5QrcodeRef   = useRef(null);
  const scanLockedRef    = useRef(false);
  const orderDebounceRef = useRef(null);
  const orderDropdownRef = useRef(null);


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

  useEffect(() => {
    const handler = (e) => {
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(e.target)) {
        setOrderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);


  const fetchOrderSuggestions = useCallback(async (term) => {
    try {
      const res = await axios.get(`${API_URL}/api/orders/admin/search-order-numbers`, {
        headers: authHeaders(),
        params: { search: term, limit: 30 },
      });
      if (res.data.success) setOrderOptions(res.data.orders || []);
    } catch {
      setOrderOptions([]);
    }
  }, []);

  useEffect(() => {
    if (showOrderSearch && orderOptions.length === 0) fetchOrderSuggestions('');
  }, [showOrderSearch]);

  useEffect(() => {
    if (!showOrderSearch) return;
    clearTimeout(orderDebounceRef.current);
    orderDebounceRef.current = setTimeout(() => fetchOrderSuggestions(orderSearch), 300);
    return () => clearTimeout(orderDebounceRef.current);
  }, [orderSearch, showOrderSearch, fetchOrderSuggestions]);


  const searchBlock = async (inputQrCode = qrCode) => {
    const code = normalizeQrValue(inputQrCode);
    if (!code) { toast.error('Please enter a QR code'); return; }

    const token = localStorage.getItem('adminToken');
    if (!token) { toast.error('No authentication token. Please login again.'); return; }

    try {
      setLoading(true);
      setBlockInfo(null);
      setBlockOrders([]);
      setSelectedOrderNumber('');

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
        const pendingOrders = (ordersRes.data.orders || []).filter((o) => !o.fullyDispatched);
        setBlockOrders(pendingOrders);
        if (pendingOrders.length === 1) setSelectedOrderNumber(pendingOrders[0].orderNumber);
        if (pendingOrders.length === 0) {
          toast.info('All orders for this block are already fully dispatched.');
        }
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


  const dispatchBlock = async () => {
    if (!qrCode || !selectedOrderNumber) {
      toast.error('QR code and order are required');
      return;
    }
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      if (!token) { toast.error('Not authenticated. Please login.'); return; }

      const response = await axios.post(
        `${API_URL}/api/orders/admin/dispatch-by-qr`,
        { qrCode: qrCode.trim(), orderNumber: selectedOrderNumber.trim() },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );

      if (response.data.success) {
        toast.success(response.data.message || 'Dispatched successfully!');
        resetAll();
      } else {
        toast.error(response.data.message || 'Failed to dispatch block');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error dispatching block');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = () => {
    setBlockInfo(null);
    setBlockOrders([]);
    setSelectedOrderNumber('');
    setQrCode('');
    setOrderSearch('');
    scanLockedRef.current = false;
  };


  return (
    <div className="dispatch-container">
      <div className="dispatch-header">
        <h1><FiPackage className="header-icon" /> Dispatch Block</h1>
        <p>Scan or enter a QR code — matching pending orders appear automatically</p>
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
          <p><strong>How to dispatch a block:</strong></p>
          <ul>
            <li><strong>Step 1 — QR code:</strong> Type the QR code ID manually, or tap <em>Camera Scan</em> to use your phone camera.</li>
            <li><strong>Step 2 — Pick order:</strong> All pending orders for this block appear. Select the correct one.</li>
            <li><strong>Step 3:</strong> Tap <em>Mark as Dispatched</em>.</li>
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

        {/* ── "Search by Order Number" accordion ── */}
        <div className="order-search-accordion">
          <button
            className="accordion-toggle"
            onClick={() => setShowOrderSearch((v) => !v)}
          >
            <FiHash />
            <span>Search by Order Number</span>
            {showOrderSearch ? <FiChevronUp className="acc-chevron" /> : <FiChevronDown className="acc-chevron" />}
          </button>

          {showOrderSearch && (
            <div className="accordion-body" ref={orderDropdownRef}>
              <p className="accordion-hint">
                Know the order number already? Search and select it here — it will be pre-selected when the block loads.
              </p>
              <div className="order-search-box">
                <FiSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Type order number or buyer name…"
                  value={orderSearch}
                  onChange={(e) => { setOrderSearch(e.target.value); setOrderDropdownOpen(true); }}
                  onFocus={() => setOrderDropdownOpen(true)}
                  className="qr-input"
                />
                <FiChevronDown className={`dropdown-chevron ${orderDropdownOpen ? 'open' : ''}`} />
              </div>

              {orderDropdownOpen && (
                <div className="order-dropdown">
                  {orderOptions.length === 0 ? (
                    <div className="order-dropdown-empty">No orders found</div>
                  ) : (
                    orderOptions.map((o) => (
                      <button
                        key={o.orderNumber}
                        className={`order-dropdown-item ${selectedOrderNumber === o.orderNumber ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedOrderNumber(o.orderNumber);
                          setOrderSearch(o.orderNumber);
                          setOrderDropdownOpen(false);
                        }}
                      >
                        <span className="ddi-number">{o.orderNumber}</span>
                        <span className="ddi-meta">
                          {o.buyerName}
                          <span className={`order-status-chip status-${o.status}`}>
                            {STATUS_LABEL[o.status] || o.status}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {selectedOrderNumber && !blockInfo && (
                <div className="order-prefill-notice">
                  <FiCheckCircle className="pfn-icon" />
                  <span>Order <strong>{selectedOrderNumber}</strong> pre-selected. Now scan or enter the QR code above.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Block info + pending orders ── */}
      {blockInfo && (
        <div className="block-info-card">
          <div className="block-info-header">
            <h3>Block Information</h3>
            <span className={`status-badge ${blockInfo.status.toLowerCase().replace(' ', '-')}`}>
              {blockInfo.status}
            </span>
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

          {/* ── Pending orders for this block ── */}
          <div className="order-picker-section">
            <h4 className="order-picker-title">
              <FiHash /> Pending Orders for this Block
            </h4>

            {blockOrders.length === 0 ? (
              <div className="no-orders-notice">
                No pending orders found for this block. All orders may already be fully dispatched, or the block hasn't been assigned to a confirmed order yet.
              </div>
            ) : (
              <div className="order-list">
                {blockOrders.map((order) => (
                  <label
                    key={order.orderNumber}
                    className={`order-option ${selectedOrderNumber === order.orderNumber ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="orderNumber"
                      value={order.orderNumber}
                      checked={selectedOrderNumber === order.orderNumber}
                      onChange={() => setSelectedOrderNumber(order.orderNumber)}
                    />
                    <div className="order-option-body">
                      <div className="order-option-top">
                        <span className="order-option-number">{order.orderNumber}</span>
                        <span className={`order-status-chip status-${order.status}`}>
                          {STATUS_LABEL[order.status] || order.status}
                        </span>
                      </div>
                      <div className="order-option-meta">
                        <span>{order.buyerName}</span>
                        <span className="order-option-qty">
                          {order.quantityDispatched}/{order.orderedQuantity} dispatched · {order.remainingQuantity} remaining
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="dispatch-actions">
            {blockInfo.status !== 'Dispatched' ? (
              <button
                className="dispatch-btn"
                onClick={dispatchBlock}
                disabled={loading || !selectedOrderNumber}
                title={!selectedOrderNumber ? 'Select an order above first' : ''}
              >
                <FiCheckCircle /> {loading ? 'Dispatching…' : 'Mark as Dispatched'}
              </button>
            ) : (
              <div className="already-dispatched">
                <FiCheckCircle className="dispatched-icon" />
                <span>This block has already been fully dispatched</span>
              </div>
            )}
            <button className="cancel-btn" onClick={resetAll}>
              <FiXCircle /> Cancel
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

export default Dispatch;
