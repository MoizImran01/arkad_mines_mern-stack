import React, { useState } from 'react';
import './AddProduct.css';
import { assets } from '../../assets/assets';
import axios from 'axios';
import { toast } from 'react-toastify';

export const AddProduct = () => {
  //state for image preview URL to show selected image before upload
  const [imagePreview, setImagePreview] = useState(null);
  //state to hold the actual image file for form submission
  const [imageFile, setImageFile] = useState(null);
  //state object to manage all product form fields
  const [productDetails, setProductDetails] = useState({
    name: "",
    description: "",
    category: "granite",
    price: ""
  });

  //handles image file selection and creates preview URL
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      //create temporary URL for image preview
      setImagePreview(URL.createObjectURL(file));
      //store the actual file for later upload
      setImageFile(file);
    }
  };

  //handles changes to text inputs, selects, and textareas
  const handleDetailChange = (event) => {
    const { name, value } = event.target;
    //update specific field in productDetails while preserving others
    setProductDetails(prevDetails => ({ ...prevDetails, [name]: value }));
  };

  //handles form submission - sends product data to backend API
  const onSubmitHandler = async (event) => {
    //prevent default form submission which would reload the page
    event.preventDefault();
    //create FormData object to handle file upload with other form fields
    const formData = new FormData();
    formData.append("name", productDetails.name);
    formData.append("description", productDetails.description);
    //convert price string to number for backend processing
    formData.append("price", Number(productDetails.price));
    formData.append("category", productDetails.category);
    //append the actual image file for upload
    formData.append("image", imageFile);
    try{
        //send POST request to backend product creation endpoint
        const response = await axios.post("http://localhost:4000/api/products/add",formData);
        //check if backend successfully created the product
        if(response.data.success)
        {
            //reset form to initial state after successful submission
            setProductDetails({
            name: "",
            description: "",
            category: "granite",
            price: ""
        })
        //clear image states
        setImageFile(null)
        setImagePreview(null)
        //show success notification to user
        toast.success(response.data.message)
        }
        else{
            //show error message from backend response
            toast.error(response.data.message)
        }
    }
    catch(error)
    {
        //log full error for debugging
        console.log("Error adding product", error)
        //show user-friendly error message
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