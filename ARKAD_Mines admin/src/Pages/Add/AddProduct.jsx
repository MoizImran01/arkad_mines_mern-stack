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
    description: "",
    category: "granite",
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
    formData.append("description", productDetails.description);
    formData.append("price", Number(productDetails.price));
    formData.append("category", productDetails.category);
    formData.append("image", imageFile);
    try{
        const response = await axios.post("http://localhost:4000/api/products/add",formData);
        if(response.data.success)
        {
            setProductDetails({
            name: "",
            description: "",
            category: "granite",
            price: ""
        })
        setImageFile(null)
        setImagePreview(null)
        toast.success(response.data.message)
        }
        else{
            toast.error(response.data.message)
        }
    }
    catch(error)
    {
        console.log("Error adding product", error)
        toast.error("Failed to add product")
    }
  };

  return (
    <div className='add-product'>
      <form className="flex-col" onSubmit={onSubmitHandler}>
        <div className="add-img-upload flex-col">
          <p className='upload-image'>Upload Product Image</p>
          <label htmlFor="image">
            <img src={imagePreview || assets.upload_area} alt="Product preview" />
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
          <p>Material Name</p>
          <input
            type='text'
            name='name'
            placeholder='e.g., Premium White Marble Slab'
            onChange={handleDetailChange}
            value={productDetails.name}
          />
        </div>

        <div className="add-product-description flex-col">
          <p>Material Description</p>
          <textarea
            name='description'
            rows="6"
            placeholder='Describe the material specifications, grade, typical applications...'
            value={productDetails.description}
            onChange={handleDetailChange}
          />
        </div>

        <div className="add-category-price">
          <div className="add-category flex-col">
            <p>Material Category</p>
            <select
              name='category'
              onChange={handleDetailChange}
              value={productDetails.category}
            >
              <option value="granite">Granite</option>
              <option value="marble">Marble</option>
              <option value="limestone">Limestone</option>
              <option value="crushed_stone">Crushed Stone</option>
              <option value="quartzite">Quartzite</option>
              <option value="industrial_sand">Industrial Sand</option>
              <option value="sandstone">Sandstone</option>
              <option value="slate">Slate</option>
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

        <button type='submit' className='add-product-btn'>Add Product</button>
      </form>
    </div>
  );
};