import React, { useState } from 'react';
import './AddProduct.css';
import { assets } from '../../assets/assets';
import axios from 'axios';
import { toast } from 'react-toastify';

export const AddProduct = () => {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const [productDetails, setProductDetails] = useState({
    stoneName: "",
    dimensions: "",
    price: "",
    priceUnit: "per sqm",
    category: "chatral_white",
    subcategory: "slabs",
    stockAvailability: "In Stock",
    stockQuantity: "",
    location: "",
    notes: ""
  });
  const [qrCodeImage, setQrCodeImage] = useState(null);
  const [qrCodeId, setQrCodeId] = useState(null);
  const [showQRCode, setShowQRCode] = useState(false);

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImagePreview(URL.createObjectURL(file));
      setImageFile(file);
    }
  };

  const handleDetailChange = (event) => {
    const { name, value } = event.target;
    setProductDetails(prevDetails => ({ ...prevDetails, [name]: value }));
  };

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append("stoneName", productDetails.stoneName);
    formData.append("dimensions", productDetails.dimensions);
    formData.append("price", Number(productDetails.price));
    formData.append("priceUnit", productDetails.priceUnit);
    formData.append("category", productDetails.category);
    formData.append("subcategory", productDetails.subcategory);
    formData.append("stockAvailability", productDetails.stockAvailability);
    formData.append("stockQuantity", Number(productDetails.stockQuantity));
    formData.append("location", productDetails.location);
    formData.append("qaNotes", productDetails.notes);
    formData.append("image", imageFile);

    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        toast.error('No authentication token found. Please login again.');
        return;
      }
      const response = await axios.post("http://localhost:4000/api/stones/add", formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.data.success) {
        // Show QR code if generated - now uses Cloudinary URL directly
        if (response.data.qrCodeImage && response.data.qrCode) {
          // Check if it's already a full URL (Cloudinary) or legacy local path
          const qrImageUrl = response.data.qrCodeImage.startsWith('http') 
            ? response.data.qrCodeImage 
            : `http://localhost:4000/images/${response.data.qrCodeImage}`;
          setQrCodeImage(qrImageUrl);
          setQrCodeId(response.data.qrCode);
          setShowQRCode(true);
        }
        setProductDetails({
          stoneName: "",
          dimensions: "",
          price: "",
          priceUnit: "per sqm",
          category: "chatral_white",
          subcategory: "slabs",
          stockAvailability: "In Stock",
          stockQuantity: "",
          location: "",
          notes: ""
        });
        setImageFile(null);
        setImagePreview(null);
        toast.success(response.data.message + " QR code generated!");
      } else {
        toast.error(response.data.message);
        setQrCodeImage(null);
        setQrCodeId(null);
      }
    } catch (error) {
      console.error("Error adding stone:", error);
      toast.error("Failed to add stone");
    }
  };

  return (
    <div className='add-product'>
      <form className="flex-col" onSubmit={onSubmitHandler}>
        <div className="add-img-upload flex-col">
          <p className='upload-image'>Upload Stone Image</p>
          <label htmlFor="image">
            <img src={imagePreview || assets.upload_area} alt="Upload stone product image" />
          </label>
          <input
            type="file"
            id="image"
            hidden
            required
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>

        <div className="add-product-name flex-col">
          <p>Stone Name</p>
          <input
            type='text'
            name='stoneName'
            placeholder='e.g., Premium White Marble, Absolute Black Granite'
            onChange={handleDetailChange}
            value={productDetails.stoneName}
          />
        </div>

        <div className="add-product-dimensions flex-col">
          <p>Stone Dimensions</p>
          <input
            type='text'
            name='dimensions'
            placeholder='e.g., 3000x2000x20mm, Slabs, Blocks'
            onChange={handleDetailChange}
            value={productDetails.dimensions}
          />
        </div>

        <div className="add-category-price">
          <div className="add-category flex-col">
            <p>Stone Category</p>
            <select
              name='category'
              onChange={handleDetailChange}
              value={productDetails.category}
            >
              <option value="chatral_white">Chatral White</option> 
              <option value="cheeta_white">Cheeta White</option> 
              <option value="pradeso">Pradeso</option> 
              <option value="tiger_gray">Tiger Gray</option> 
              <option value="imperial_white">Imperial White</option> 
              <option value="fantasy">Fantasy</option> 
              <option value="sado_pink">Sado Pink</option> 
              <option value="jebrana">Jebrana</option> 
              <option value="gray">Gray</option>
              <option value="black">Black</option>
              <option value="sado_gray">Sado Gray</option>
            </select>
          </div>

          <div className="add-subcategory flex-col">
            <p>Product Type</p>
            <select
              name='subcategory'
              onChange={handleDetailChange}
              value={productDetails.subcategory}
            >
              <option value="slabs">Slabs</option>
              <option value="tiles">Tiles</option>
              <option value="blocks">Blocks</option>
              <option value="crushed">Crushed Stone</option>
              <option value="top_stripe">Top Stripe</option>
              <option value="top_plain">Top Plain</option>
              <option value="bottom_stripe">Bottom Stripe</option>
              <option value="bottom_plain">Bottom Plain</option>
            </select>
          </div>

          <div className="add-price flex-col">
            <p>Price</p>
            <input
              type='number'
              name='price'
              placeholder='e.g., 150.00'
              onChange={handleDetailChange}
              value={productDetails.price}
            />
          </div>

          <div className="add-price-unit flex-col">
            <p>Price Unit</p>
            <select
              name='priceUnit'
              onChange={handleDetailChange}
              value={productDetails.priceUnit}
            >
              <option value="per sqm">Per SQM</option>
              <option value="per ton">Per Ton</option>
              <option value="per slab">Per Slab</option>
              <option value="per block">Per Block</option>
              <option value="per cubic meter">Per Cubic Meter</option>
            </select>
          </div>
        </div>

        <div className="add-stock-info">
          <div className="add-stock-availability flex-col">
            <p>Stock Status</p>
            <select
              name='stockAvailability'
              onChange={handleDetailChange}
              value={productDetails.stockAvailability}
            >
              <option value="In Stock">In Stock</option>
              <option value="Low Stock">Low Stock</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Pre-order">Pre-order</option>
            </select>
          </div>

          <div className="add-stock-quantity flex-col">
            <p>Available Quantity</p>
            <input
              type='number'
              name='stockQuantity'
              placeholder='e.g., 1000'
              onChange={handleDetailChange}
              value={productDetails.stockQuantity}
            />
          </div>
        </div>

        <div className="add-product-location flex-col">
          <p>Location</p>
          <input
            type='text'
            name='location'
            placeholder='e.g., Warehouse A, Section B, Shelf 3'
            onChange={handleDetailChange}
            value={productDetails.location}
          />
        </div>

        <div className="add-product-notes flex-col">
          <p>Notes</p>
          <textarea
            name='notes'
            placeholder='e.g., QA notes, defects, or any additional information about the block'
            onChange={handleDetailChange}
            value={productDetails.notes}
            rows="4"
          />
        </div>

        <button type='submit' className='add-product-btn'>Register Block</button>
      </form>

      {/* QR Code Display Modal */}
      {showQRCode && qrCodeImage && qrCodeId && (
        <div className="qr-code-modal" onClick={() => setShowQRCode(false)}>
          <div className="qr-code-content" onClick={(e) => e.stopPropagation()}>
            <h3>Block Registered Successfully!</h3>
            <p>QR Code Generated - Print this label and attach to the block</p>
            <div className="qr-code-image-container">
              <img src={qrCodeImage} alt="QR Code" />
              <div className="qr-code-id-container">
                <p className="qr-id-label">QR Code ID (for manual entry):</p>
                <div className="qr-id-box">
                  <code className="qr-id-text">{qrCodeId}</code>
                  <button 
                    className="copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(qrCodeId);
                      toast.success("QR Code ID copied to clipboard!");
                    }}
                    title="Copy to clipboard"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            <button 
              className="print-btn"
              onClick={() => window.print()}
            >
              Print QR Code
            </button>
            <button 
              className="close-btn"
              onClick={() => {
                setShowQRCode(false);
                setQrCodeImage(null);
                setQrCodeId(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};