import React from 'react'
import './List.css'
import { useState } from 'react'
import { toast } from 'react-toastify';
import { useEffect } from 'react';
import axios from 'axios'
const List = () => {

//state to store the list of food items fetched from the backend
const [list, setList] = useState([]);

//function to fetch the list of food items from the backend API
const fetchList = async ()=>{
    try{
    //make GET request to fetch all food items
    const response = await axios.get("http://localhost:4000/api/food/list");
    //check if the request was successful
    if(response.data.success)
    {
        console.log("food list fetched successfully", response)
        //update state with the fetched food data
        setList(response.data.food_data)
    }
    else
    {
        //show error toast if backend returns success: false
        toast.error("Error fetching food list")
    }
    }
    catch(error)
    {
        //handle network errors or server errors
        console.log("error fetching food list", error);
        toast.error("Error fetching food list")
    }
}

//function to remove a specific food item by its ID
const removeFoodItem = async (foodID)=>{
    try{
        //send POST request to remove endpoint with the food ID
        const response = await axios.post("http://localhost:4000/api/food/remove", {id: foodID})
         console.log("food item removed with id: ", foodID)
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
            toast.error(`Error removing food with ID ${foodID}`)
         }
    }
    catch(error)
    {
        //handle errors during the removal process
        console.log(`Error removing food with ID ${foodID}. The error is: ${error}`)
    }
   

}

//useEffect to fetch the food list when component mounts
useEffect(()=>{
    fetchList();
}, [])
  return (
    <div className='list add flex-col'>
        <p>All Food List</p>
        <div className="list-table">
            {/*table header row with column titles*/}
            <div className="list-table-format title">
                <b>Image</b>
                <b>Name</b>
                <b>Category</b>
                <b>Price</b>
                <b>Action</b>
            </div>
       {/*map through the list array to render each food item*/}
       {list.map((item, index) => {
  return (
    //wrapper div for each row with unique key for React rendering
    <div key={index} className="list-row-wrapper">
      <div className="list-table-format">
        {/*display food image from backend server*/}
        <img src={'http://localhost:4000/images/' + item.image} alt='' />
        <p>{item.name}</p>
        <p>{item.category}</p>
        <p>${item.price}</p>
        {/*clickable X to remove this food item*/}
        <p onClick={()=>{removeFoodItem(item._id)}}>X</p>
      </div>
      {/*add horizontal line between rows except after the last item*/}
      {index !== list.length - 1 && <hr className="row-separator" />}
    </div>
  );
})}

        </div>
    </div>
  )
}

export default List