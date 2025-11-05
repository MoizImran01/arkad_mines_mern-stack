import React from 'react'
import './List.css'
import { useState } from 'react'
import { toast } from 'react-toastify';
import { useEffect } from 'react';
import axios from 'axios'

const List = () => {
  //state to store the list of stone items fetched from the backend
  const [list, setList] = useState([]);
  //state for QR code modal
  const [qrModal, setQrModal] = useState({ isOpen: false, qrCodeImage: null, qrCodeId: null, stoneName: null });

  //function to fetch the list of stone items from the backend API
  const fetchList = async ()=>{
      try{
      //make GET request to fetch all stone items
      const response = await axios.get("http://localhost:4000/api/stones/list");
      //check if the request was successful
      if(response.data.success)
      {
          console.log("Stone list fetched successfully", response)
          //update state with the fetched stone data
          setList(response.data.stones_data)
      }
      else
      {
          //show error toast if backend returns success: false
          toast.error("Error fetching stone list")
      }
      }
      catch(error)
      {
          //handle network errors or server errors
          console.log("error fetching stone list", error);
          toast.error("Error fetching stone list")
      }
  }

  //function to remove a specific stone item by its ID
  const removeStoneItem = async (stoneID)=>{
      try{
          //send POST request to remove endpoint with the stone ID
          const response = await axios.post("http://localhost:4000/api/stones/remove", {id: stoneID})
           console.log("Stone item removed with id: ", stoneID)
           //check if removal was successful
           if(response.data.success)
           {
              //show success message and refresh the list
              toast.success(response.data.message)
              await fetchList()
           }
           else
           {
              //show error if backend indicates failure
              toast.error(`Error removing stone with ID ${stoneID}`)
           }
      }
      catch(error)
      {
          //handle errors during the removal process
          console.log(`Error removing stone with ID ${stoneID}. The error is: ${error}`)
      }
  }

  //useEffect to fetch the stone list when component mounts
  useEffect(()=>{
      fetchList();
  }, [])
  
  return (
    <div className='list add flex-col'>
        <p>All Stone Products List</p>
        <div className="list-table">
            {/*table header row with column titles*/}
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
            
            {/*map through the list array to render each stone item*/}
            {list.map((item, index) => {
              return (
                //wrapper div for each row with unique key for React rendering
                <div key={index} className="list-row-wrapper">
                  <div className="list-table-format">
                    {/*display stone image from backend server*/}
                    <img src={'http://localhost:4000/images/' + item.image} alt={item.stoneName} />
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
                          src={'http://localhost:4000/images/' + item.qrCodeImage} 
                          alt="QR Code" 
                          className="qr-code-thumbnail"
                          title={`Click to view QR Code: ${item.qrCode}`}
                          onClick={() => setQrModal({
                            isOpen: true,
                            qrCodeImage: 'http://localhost:4000/images/' + item.qrCodeImage,
                            qrCodeId: item.qrCode,
                            stoneName: item.stoneName
                          })}
                        />
                      ) : (
                        <span className="no-qr">N/A</span>
                      )}
                    </div>
                    {/*clickable X to remove this stone item*/}
                    <p onClick={()=>{removeStoneItem(item._id)}} className="remove-btn">X</p>
                  </div>
                  {/*add horizontal line between rows except after the last item*/}
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