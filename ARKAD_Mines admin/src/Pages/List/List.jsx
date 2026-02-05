import React, { useState, useEffect } from 'react';
import './List.css';
import { toast } from 'react-toastify';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const List = () => {

  const [list, setList] = useState([]);

  const [qrModal, setQrModal] = useState({ isOpen: false, qrCodeImage: null, qrCodeId: null, stoneName: null });

  // Get image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/100x100?text=No+Image';
    // If it's already a full URL (Cloudinary), return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Otherwise, construct local URL for legacy images
    return `${API_URL}/images/${imagePath}`;
  };


  const fetchList = async ()=>{
      try{
      //make GET request to fetch all stone items
      const response = await axios.get(`${API_URL}/api/stones/list`);

      if(response.data.success)
      {
          setList(response.data.stones_data)
      }
      else
      {

          toast.error("Error fetching stone list")
      }
      }
      catch(error)
      {
          toast.error("Error fetching stone list")
      }
  }

  //function to remove a specific stone item by its ID
  const removeStoneItem = async (stoneID)=>{
      try{

          const token = localStorage.getItem('adminToken');
          
          if (!token) {
              toast.error('No authentication token found. Please login again.');
              return;
          }

          const response = await axios.post(
              `${API_URL}/api/stones/remove`, 
              { id: stoneID },
              {
                  headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                  }
              }
          )

          if(response.data.success)
          {
              toast.success(response.data.message)
              await fetchList()
          }
          else
          {
              toast.error(`Error removing stone with ID ${stoneID}`)
          }
      }
      catch(error)
      {
          toast.error(`Error removing stone with ID ${stoneID}`)
      }
  }


  useEffect(()=>{
      fetchList();
  }, [])
  
  return (
    <div className='list add flex-col'>
        <p>All Stone Products List</p>
        <div className="list-table">

            <div className="list-table-format title">
                <b>Image</b>
                <b>Stone Name</b>
                <b>Category</b>
                <b>Product Type</b>
                <b>Dimensions</b>
                <b>Price</b>
                <b>Available in Stock</b>
                <b>QR Code</b>
                <b>Action</b>
            </div>
            

            {list.map((item, index) => {
              return (

                <div key={item._id} className="list-row-wrapper">
                  <div className="list-table-format">

                    <img src={getImageUrl(item.image)} alt={item.stoneName} />
                    <p>{item.stoneName}</p>
                    <p>{item.category}</p>
                    <p>{item.subcategory}</p>
                    <p>{item.dimensions}</p>
                    <p>Rs {item.price} {item.priceUnit}</p>
                    <p className="block-stock">
                      {(item.stockQuantity || 0) - (item.quantityDelivered || 0)} pcs
                    </p>
                    <div className="qr-code-cell">
                      {item.qrCodeImage ? (
                        <button
                          type="button"
                          className="qr-code-btn"
                          title={`Click to view QR Code: ${item.qrCode}`}
                          onClick={() => setQrModal({
                            isOpen: true,
                            qrCodeImage: getImageUrl(item.qrCodeImage),
                            qrCodeId: item.qrCode,
                            stoneName: item.stoneName
                          })}
                          aria-label={`View QR code for ${item.stoneName}`}
                        >
                          <img 
                            src={getImageUrl(item.qrCodeImage)} 
                            alt={`QR Code for ${item.stoneName}`}
                            className="qr-code-thumbnail"
                          />
                        </button>
                      ) : (
                        <span className="no-qr">N/A</span>
                      )}
                    </div>

                    <button 
                      type="button"
                      onClick={()=>{removeStoneItem(item._id)}} 
                      className="remove-btn"
                      aria-label={`Remove ${item.stoneName}`}
                    >
                      X
                    </button>
                  </div>

                  {index !== list.length - 1 && <hr className="row-separator" />}
                </div>
              );
            })}
        </div>

        {/* QR Code Modal */}
        {qrModal.isOpen && (
          <div 
            className="qr-modal-overlay" 
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
          >
            <button 
              type="button"
              className="modal-backdrop-btn" 
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 1 }}
              onClick={() => setQrModal({ isOpen: false, qrCodeImage: null, qrCodeId: null, stoneName: null })}
              aria-label="Close QR modal"
            />
            <div className="qr-modal-content" role="document" style={{ position: 'relative', zIndex: 2 }}>
              <div className="qr-modal-header">
                <h3 id="qr-modal-title">QR Code Details</h3>
                <button 
                  className="qr-modal-close"
                  onClick={() => setQrModal({ isOpen: false, qrCodeImage: null, qrCodeId: null, stoneName: null })}
                >
                  ×
                </button>
              </div>
              {qrModal.stoneName && (
                <p className="qr-modal-stone-name">{qrModal.stoneName}</p>
              )}
              <div className="qr-modal-image-container">
                <img 
                  src={qrModal.qrCodeImage} 
                  alt="QR Code" 
                  className="qr-modal-image"
                />
              </div>
              <div className="qr-modal-uuid-container">
              <span className="qr-modal-uuid-label">QR Code UUID:</span>
                <div className="qr-modal-uuid-box">
                  <code className="qr-modal-uuid-text">{qrModal.qrCodeId}</code>
                  <button 
                    className="qr-modal-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(qrModal.qrCodeId);
                      toast.success("UUID copied to clipboard!");
                    }}
                    title="Copy UUID"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="qr-modal-actions">
                <button 
                  className="qr-modal-print-btn"
                  onClick={() => window.print()}
                >
                  Print QR Code
                </button>
                <button 
                  className="qr-modal-close-btn"
                  onClick={() => setQrModal({ isOpen: false, qrCodeImage: null, qrCodeId: null, stoneName: null })}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  )
}

export default List