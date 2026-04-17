import React, { useState, useEffect, useRef } from 'react';
import './List.css';
import { toast } from 'react-toastify';
import axios from 'axios';
import { FiBox, FiTrash2 } from 'react-icons/fi';
import Pagination from '../../../../shared/Pagination.jsx';

const API_URL = import.meta.env.VITE_API_URL ?? "";

const List = () => {

  const [list, setList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [qrModal, setQrModal] = useState({ isOpen: false, qrCodeImage: null, qrCodeId: null, stoneName: null });

  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/100x100?text=No+Image';
    
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    return `${API_URL}/images/${imagePath}`;
  };


  const fetchList = async ()=>{
      try{
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

  const fetchListRef = useRef(fetchList);
  fetchListRef.current = fetchList;

  useEffect(() => {
    const onLive = (e) => {
      if (e.detail?.channel === "stones") fetchListRef.current();
    };
    window.addEventListener("arkad:live", onLive);
    return () => window.removeEventListener("arkad:live", onLive);
  }, []);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, list.length]);

  const visibleList = list.filter((item) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.stoneName?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q) ||
      item.subcategory?.toLowerCase().includes(q) ||
      item.qrCode?.toLowerCase().includes(q)
    );
  });
  const totalItems = visibleList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageEnd = pageStart + ITEMS_PER_PAGE;
  const paginatedList = visibleList.slice(pageStart, pageEnd);
  
  return (
    <div className='list add flex-col'>
        <h1 className="list-title">
          <FiBox className="header-icon" />
          Stone Product List
        </h1>
        <div className="list-search-row">
          <input
            type="text"
            className="list-search-input"
            placeholder="Search by stone name, category, type or QR code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="list-table">

            <div className="list-table-format title">
                <b>#</b>
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
            

            {paginatedList.map((item, index) => {
              return (

                <div key={item._id} className="list-row-wrapper">
                  <div className="list-table-format">
                    <p>{pageStart + index + 1}</p>

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
                      className="delete-btn remove-btn"
                      aria-label={`Remove ${item.stoneName}`}
                    >
                      <FiTrash2 />
                    </button>
                  </div>

                  {index !== paginatedList.length - 1 && <hr className="row-separator" />}
                </div>
              );
            })}
            <Pagination currentPage={currentPage} setCurrentPage={setCurrentPage} totalItems={totalItems} itemsPerPage={ITEMS_PER_PAGE} label="items" />
        </div>

        {/* QR Code Modal */}
        {qrModal.isOpen && (
          <div 
            className="qr-modal-overlay" 
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-modal-title"
          >
            <div className="qr-modal-content" role="document">
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