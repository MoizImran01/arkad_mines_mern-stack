import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Navbar from './Components/Navbar/Navbar'
import LoginPopup from './Components/LoginPopup/LoginPopup'
import Home from './Pages/Home/Home'
import Products from './Pages/Products/Products'
import ProtectedRoute from './Components/ProtectedRoute/ProtectedRoute'
import {Route} from 'react-router-dom'
import { Routes } from 'react-router-dom'

function App() {
const [showLogin, setShowLogin] = useState(false);

  return (
    <>
    {showLogin?<LoginPopup setShowLogin={setShowLogin}/>: <></>}

      <div className='app'>
      <Navbar setShowLogin={setShowLogin}/>
      <Routes>
        <Route path='/' element={<Home/>}/>
        <Route 
          path='/products' 
          element={
            <ProtectedRoute setShowLogin={setShowLogin}>
              <Products/>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
      </>
     
  )
}

export default App
