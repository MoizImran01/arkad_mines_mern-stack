import React, { useState, useRef, useEffect } from 'react';
import './Dispatch.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiPackage, FiCheckCircle, FiXCircle, FiSearch, FiGrid, FiCamera, FiType } from 'react-icons/fi';

const Dispatch = () => {
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [blockInfo, setBlockInfo] = useState(null);
  const [showBlockInfo, setShowBlockInfo] = useState(false);
  const [scanMode, setScanMode] = useState('manual'); 
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Helper function to get image URL - handles both Cloudinary URLs and legacy local images
  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/100?text=No+QR';
    // If it's already a full URL (Cloudinary), return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Otherwise, construct local URL for legacy images
    return `http://localhost:4000/images/${imagePath}`;
  };

  //Function to search for block by QR code
  const searchBlock = async () => {

    if (!qrCode.trim()) {
      toast.error("Please enter a QR code");
      return;
    }
        const token = localStorage.getItem('adminToken');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

    if (!token) {
      toast.error('No authentication token found. Please login again.');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.get(
        `http://localhost:4000/api/stones/qr/${qrCode}`,
        { headers }
      );
      
      if (response.data.success) {
        setBlockInfo(response.data.block);
        setShowBlockInfo(true);
      } else {
        toast.error(response.data.message || "Block not found");
        setBlockInfo(null);
        setShowBlockInfo(false);
      }
    } catch (error) {
      console.error("Error searching block:", error);
      toast.error(error.response?.data?.message || "Block not found with this QR code");
      setBlockInfo(null);
      setShowBlockInfo(false);
    } finally {
      setLoading(false);
    }
  };

  // Function to dispatch block
  const dispatchBlock = async () => {
    if (!blockInfo || !qrCode) {
      toast.error("No block selected");
      return;
    }

    if (blockInfo.status === "Dispatched") {
      toast.error("This block has already been dispatched");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      if (!token) {
        toast.error('Not authenticated. Please login.');
        setLoading(false);
        return;
      }

     const response = await axios.post(
        "http://localhost:4000/api/stones/dispatch",
        { qrCode: qrCode },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
     );

      if (response.data.success) {
        toast.success(response.data.message);
        setBlockInfo({ ...blockInfo, status: "Dispatched", stockAvailability: "Out of Stock" });
        setQrCode('');
        setTimeout(() => {
          setShowBlockInfo(false);
          setBlockInfo(null);
        }, 2000);
      } else {
        toast.error(response.data.message || "Failed to dispatch block");
      }
    } catch (error) {
      console.error("Error dispatching block:", error);
      toast.error(error.response?.data?.message || "Error dispatching block");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      searchBlock();
    }
  };

  //Handle camera scanning using browser's built-in QR code scanner
  const startCameraScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment' 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Camera access denied. Please use manual entry.");
      setScanMode('manual');
    }
  };

  const stopCameraScan = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  // Handle QR code detection from camera using HTML5 QR code scanner
  useEffect(() => {
    if (showCamera && videoRef.current) {

      const video = videoRef.current;
      

      if ('BarcodeDetector' in window) {
        const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
        
        const detectQR = async () => {
          try {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes.length > 0) {
              const detectedCode = barcodes[0].rawValue;
              setQrCode(detectedCode);
              stopCameraScan();
              toast.success("QR code detected!");

              setTimeout(async () => {
                if (detectedCode.trim()) {
                  try {
                    setLoading(true);
                    const response = await axios.get(`http://localhost:4000/api/stones/qr/${detectedCode}`);
                    if (response.data.success) {
                      setBlockInfo(response.data.block);
                      setShowBlockInfo(true);
                    }
                  } catch (error) {
                    toast.error("Block not found with this QR code");
                  } finally {
                    setLoading(false);
                  }
                }
              }, 500);
            }
          } catch (err) {
            
          }
        };

        const interval = setInterval(detectQR, 500);
        return () => clearInterval(interval);
      } else {

        toast.info("Your browser doesn't support automatic QR detection. Please use manual entry.");
      }
    }

    return () => {
      if (showCamera) {
        stopCameraScan();
      }
    };

  }, [showCamera]);


  useEffect(() => {
    return () => {
      stopCameraScan();
    };
  }, []);

  return (
    <div className="dispatch-container">
      <div className="dispatch-header">
        <h1><FiPackage className="header-icon" /> Dispatch Block</h1>
        <p>Scan or enter QR code to dispatch a registered block</p>
      </div>

      <div className="dispatch-search-section">
        <div className="scan-mode-toggle">
          <button
            className={`mode-btn ${scanMode === 'manual' ? 'active' : ''}`}
            onClick={() => {
              setScanMode('manual');
              stopCameraScan();
            }}
          >
            <FiType /> Manual Entry
          </button>
          <button
            className={`mode-btn ${scanMode === 'camera' ? 'active' : ''}`}
            onClick={() => {
              setScanMode('camera');
              startCameraScan();
            }}
          >
            <FiCamera /> Camera Scan
          </button>
        </div>

        <div className="instructions-box">
          <p><strong>How to enter QR code:</strong></p>
          <ul>
            <li><strong>Manual Entry:</strong> Type or paste the QR code ID from the printed label</li>
            <li><strong>Camera Scan:</strong> Click "Camera Scan" and point your camera at the QR code</li>
            <li><strong>Tip:</strong> You can find the QR code ID in the "List Items" page under the QR Code column</li>
          </ul>
        </div>

        {scanMode === 'manual' ? (
          <div className="search-box">
            <FiGrid className="search-icon" />
            <input
              type="text"
              placeholder="Enter QR code ID (UUID) or scan QR code..."
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              onKeyPress={handleKeyPress}
              className="qr-input"
              disabled={loading}
              autoFocus
            />
            <button 
              className="search-btn"
              onClick={searchBlock}
              disabled={loading || !qrCode.trim()}
            >
              {loading ? "Searching..." : <><FiSearch /> Search Block</>}
            </button>
          </div>
        ) : (
          <div className="camera-scan-container">
            {showCamera ? (
              <div className="camera-view">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="camera-video"
                />
                <div className="camera-overlay">
                  <div className="scan-frame"></div>
                  <p>Point camera at QR code</p>
                </div>
                <button 
                  className="stop-camera-btn"
                  onClick={() => {
                    stopCameraScan();
                    setScanMode('manual');
                  }}
                >
                  <FiXCircle /> Stop Camera
                </button>
              </div>
            ) : (
              <div className="camera-placeholder">
                <FiCamera className="camera-icon" />
                <p>Click "Camera Scan" to start scanning</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Block Information Display */}
      {showBlockInfo && blockInfo && (
        <div className="block-info-card">
          <div className="block-info-header">
            <h3>Block Information</h3>
            <span className={`status-badge ${blockInfo.status.toLowerCase().replace(' ', '-')}`}>
              {blockInfo.status}
            </span>
          </div>

          <div className="block-details">
            <div className="detail-row">
              <span className="detail-label">Stone Name:</span>
              <span className="detail-value">{blockInfo.stoneName}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Dimensions:</span>
              <span className="detail-value">{blockInfo.dimensions}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Category:</span>
              <span className="detail-value">{blockInfo.category}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Grade:</span>
              <span className="detail-value">{blockInfo.grade || "Standard"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Stock Availability:</span>
              <span className="detail-value">{blockInfo.stockAvailability}</span>
            </div>
            {blockInfo.qrCodeImage && (
              <div className="detail-row qr-preview">
                <span className="detail-label">QR Code:</span>
                <div className="qr-preview-image">
                  <img 
                    src={getImageUrl(blockInfo.qrCodeImage)} 
                    alt="QR Code" 
                  />
                </div>
              </div>
            )}
          </div>

          <div className="dispatch-actions">
            {blockInfo.status !== "Dispatched" ? (
              <button
                className="dispatch-btn"
                onClick={dispatchBlock}
                disabled={loading}
              >
                <FiCheckCircle /> Mark as Dispatched
              </button>
            ) : (
              <div className="already-dispatched">
                <FiCheckCircle className="dispatched-icon" />
                <span>This block has already been dispatched</span>
              </div>
            )}
            <button
              className="cancel-btn"
              onClick={() => {
                setShowBlockInfo(false);
                setBlockInfo(null);
                setQrCode('');
              }}
            >
              <FiXCircle /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dispatch;

