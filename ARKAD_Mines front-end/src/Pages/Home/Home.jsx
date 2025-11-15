import React, { useState } from 'react'
import './Home.css'
import { Header } from '../../Components/Header/Header';
const Home = () => {
  const [category, setCategory] = useState("All");
  return (
    <div className='home'>
        <Header/>
     
    </div>
  )
}

export default Home