import React from 'react'
import './List.css'
import { useState } from 'react'
import { toast } from 'react-toastify';
import { useEffect } from 'react';
import axios from 'axios'
const List = () => {

const [list, setList] = useState([]);

const fetchList = async ()=>{
    try{
    const response = await axios.get("http://localhost:4000/api/food/list");
    if(response.data.success)
    {
        console.log("food list fetched successfully", response)
        setList(response.data.food_data)
    }
    else
    {
        toast.error("Error fetching food list")
    }
    }
    catch(error)
    {
        console.log("error fetching food list", error);
        toast.error("Error fetching food list")
    }
}

const removeFoodItem = async (foodID)=>{
    try{
        const response = await axios.post("http://localhost:4000/api/food/remove", {id: foodID})
         console.log("food item removed with id: ", foodID)
         if(response.data.success)
         {
            toast.success(response.data.message)
            await fetchList()
         }
         else
         {
            toast.error(`Error removing food with ID ${foodID}`)
         }
    }
    catch(error)
    {
        console.log(`Error removing food with ID ${foodID}. The error is: ${error}`)
    }
   

}

useEffect(()=>{
    fetchList();
}, [])
  return (
    <div className='list add flex-col'>
        <p>All Food List</p>
        <div className="list-table">
            <div className="list-table-format title">
                <b>Image</b>
                <b>Name</b>
                <b>Category</b>
                <b>Price</b>
                <b>Action</b>
            </div>
       {list.map((item, index) => {
  return (
    <div key={index} className="list-row-wrapper">
      <div className="list-table-format">
        <img src={'http://localhost:4000/images/' + item.image} alt='' />
        <p>{item.name}</p>
        <p>{item.category}</p>
        <p>${item.price}</p>
        <p onClick={()=>{removeFoodItem(item._id)}}>X</p>
      </div>
      {index !== list.length - 1 && <hr className="row-separator" />}
    </div>
  );
})}

        </div>
    </div>
  )
}

export default List