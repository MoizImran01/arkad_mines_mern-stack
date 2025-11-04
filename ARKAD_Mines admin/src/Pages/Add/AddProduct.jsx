import React, { useState } from 'react';
import './AddProduct.css';
import { assets } from '../../assets/assets';
import axios from 'axios';
import { toast } from 'react-toastify';

export const AddProduct = () => {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  const [productDetails, setProductDetails] = useState({
    name: "",
    dimensions: "",
    category: "granite",
    subcategory: "top_stripe",
    price: ""
  });

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
    formData.append("name", productDetails.name);
    formData.append("dimensions", productDetails.dimensions);
    formData.append("price", Number(productDetails.price));
    formData.append("category", productDetails.category);
    formData.append("subcategory", productDetails.subcategory);
    formData.append("image", imageFile);

    try {
      const response = await axios.post("http://localhost:4000/api/stones/add", formData);
      if (response.data.success) {
        setProductDetails({
          name: "",
          dimensions: "",
          category: "granite",
          subcategory: "top_stripe",
          price: ""
        });
        setImageFile(null);
        setImagePreview(null);
        toast.success(response.data.message);
      } else {
        toast.error(response.data.message);
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
            <img src={imagePreview || assets.upload_area} alt="Stone preview" />
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
            name='name'
            placeholder='e.g., Premium White Marble'
            onChange={handleDetailChange}
            value={productDetails.name}
          />
        </div>

        <div className="add-product-dimensions flex-col">
          <p>Stone Dimensions</p>
          <input
            type='text'
            name='dimensions'
            placeholder='e.g., 60x40 cm'
            onChange={handleDetailChange}
            value={productDetails.dimensions}
          />
        </div>

        <div className="add-category-price">
          <div className="add-category flex-col">
            <p>Category</p>
            <select
              name='category'
              onChange={handleDetailChange}
              value={productDetails.category}
            >
             <option value="granite">Chatral White</option> 
             <option value="marble">Cheeta White</option> 
             <option value="limestone">Pradeso</option> 
             <option value="crushed_stone">Tiger Gray</option> 
             <option value="quartzite">Imperial White</option> 
             <option value="industrial_sand">Fantasy</option> 
             <option value="sandstone">Sado Pink</option> 
             <option value="slate">Jebrana</option> 
             <option value="industrial_sand">Gray</option>
            <option value="sandstone">Black</option>
              <option value="slate">Sado Gray</option>
            </select>
          </div>

          <div className="add-subcategory flex-col">
            <p>Subcategory</p>
            <select
              name='subcategory'
              onChange={handleDetailChange}
              value={productDetails.subcategory}
            >
              <option value="top_stripe">Top Stripe</option>
              <option value="top_plain">Top Plain</option>
              <option value="bottom_stripe">Bottom Stripe</option>
              <option value="bottom_plain">Bottom Plain</option>
            </select>
          </div>

          <div className="add-price flex-col">
            <p>Price per Unit</p>
            <input
              type='number'
              name='price'
              placeholder='e.g., 150.00'
              onChange={handleDetailChange}
              value={productDetails.price}
            />
          </div>
        </div>

        <button type='submit' className='add-product-btn'>Add Stone</button>
      </form>
    </div>
  );
};
