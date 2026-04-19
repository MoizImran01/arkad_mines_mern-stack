import React, { useState, useRef, useEffect, useCallback } from 'react';
import './Dispatch.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Html5Qrcode } from 'html5-qrcode';
import {
  FiPackage, FiCheckCircle, FiXCircle, FiSearch,
  FiGrid, FiCamera, FiType, FiHash
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

const PAYMENT_LABEL = {
  pending: 'UNPAID',
  payment_in_progress: 'PARTIAL / IN PROGRESS',
  fully_paid: 'FULLY PAID',
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

    //Warn the admin if the selected order isn't fully paid yet
    const selectedOrder = blockOrders.find((o) => o.orderNumber === selectedOrderNumber);
    if (selectedOrder && selectedOrder.paymentStatus !== 'fully_paid') {
      const label = PAYMENT_LABEL[selectedOrder.paymentStatus] || 'NOT FULLY PAID';
      const proceed = window.confirm(
        `⚠️ Payment warning\n\n` +
        `Order ${selectedOrder.orderNumber} is currently: ${label}.\n\n` +
        `This order has NOT been fully paid yet. Are you sure you want to dispatch this block?\n\n` +
        `Click OK to dispatch anyway, or Cancel to review the payment first.`
      );
      if (!proceed) return;
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
