import React, { useContext, useMemo } from 'react'
import './List.css'
import { useState } from 'react'
import { toast } from 'react-toastify';
import { useEffect } from 'react';
import axios from 'axios'
import { AdminAuthContext } from '../../context/AdminAuthContext';

const List = () => {
  const { token, url } = useContext(AdminAuthContext);
  const [list, setList] = useState([]);

  const [qrModal, setQrModal] = useState({ isOpen: false, qrCodeImage: null, qrCodeId: null, stoneName: null });

  // Helper function to get image URL - handles both Cloudinary URLs and legacy local images
  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/100x100?text=No+Image';
    // If it's already a full URL (Cloudinary), return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Otherwise, construct local URL for legacy images
    return `http://localhost:4000/images/${imagePath}`;
  };


  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchList = async ()=>{
      try{
      //make GET request to fetch all stone items
      const response = await axios.get(`${url}/api/stones/list`);

      if(response.data.success)
      {
          console.log("Stone list fetched successfully", response)

          setList(response.data.stones_data)
      }
      else
      {

          toast.error("Error fetching stone list")
      }
      }
      catch(error)
      {

          console.log("error fetching stone list", error);
          toast.error("Error fetching stone list")
      }
  }

  //function to remove a specific stone item by its ID
  const removeStoneItem = async (stoneID)=>{
      if (!token) {
        toast.error("Authentication required. Please log in again.");
        return;
      }
      
      try{
          const response = await axios.post(`${url}/api/stones/remove`, {id: stoneID}, { headers })
           console.log("Stone item removed with id: ", stoneID)

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

          console.log(`Error removing stone with ID ${stoneID}. The error is: ${error}`)
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
                <b>Status</b>
                <b>QR Code</b>
                <b>Action</b>
            </div>
            

            {list.map((item, index) => {
              return (

                <div key={index} className="list-row-wrapper">
                  <div className="list-table-format">

                    <img src={getImageUrl(item.image)} alt={item.stoneName} />
                    <p>{item.stoneName}</p>
                    <p>{item.category}</p>
                    <p>{item.subcategory}</p>
                    <p>{item.dimensions}</p>
                    <p>Rs {item.price} {item.priceUnit}</p>
                    <p className={`block-status ${item.status?.toLowerCase().replace(' ', '-') || 'registered'}`}>
                      {item.status || 'Registered'}
                    </p>
                    <div className="qr-code-cell">
                      {item.qrCodeImage ? (
                        <img 
                          src={getImageUrl(item.qrCodeImage)} 
                          alt="QR Code" 
                          className="qr-code-thumbnail"
                          title={`Click to view QR Code: ${item.qrCode}`}
                          onClick={() => setQrModal({
                            isOpen: true,
                            qrCodeImage: getImageUrl(item.qrCodeImage),
                            qrCodeId: item.qrCode,
                            stoneName: item.stoneName
                          })}
                        />
                      ) : (
                        <span className="no-qr">N/A</span>
                      )}
                    </div>

                    <p onClick={()=>{removeStoneItem(item._id)}} className="remove-btn">X</p>
                  </div>

                  {index !== list.length - 1 && <hr className="row-separator" />}
                </div>
              );
            })}
        </div>

        {/* QR Code Modal */}
        {qrModal.isOpen && (
          <div className="qr-modal-overlay" onClick={() => setQrModal({ isOpen: false, qrCodeImage: null, qrCodeId: null, stoneName: null })}>
            <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="qr-modal-header">
                <h3>QR Code Details</h3>
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
                <label className="qr-modal-uuid-label">QR Code UUID:</label>
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