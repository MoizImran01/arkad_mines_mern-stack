import React from 'react'
import './List.css'
import { useState } from 'react'
import { toast } from 'react-toastify';
import { useEffect } from 'react';
import axios from 'axios'

const List = () => {
  //state to store the list of stone items fetched from the backend
  const [list, setList] = useState([]);

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
                <b>Stock Status</b>
                <b>Quantity</b>
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
                    <p className={`stock-status ${item.stockAvailability?.toLowerCase().replace(' ', '-')}`}>
                      {item.stockAvailability}
                    </p>
                    <p>{item.stockQuantity || 'N/A'}</p>
                    {/*clickable X to remove this stone item*/}
                    <p onClick={()=>{removeStoneItem(item._id)}} className="remove-btn">X</p>
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