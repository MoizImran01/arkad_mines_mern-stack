import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import Navbar from './Components/Navbar/Navbar'
import LoginPopup from './Components/LoginPopup/LoginPopup'
import Home from './Pages/Home/Home'

function App() {
const [showLogin, setShowLogin] = useState(false);

  return (
    <>
    {showLogin?<LoginPopup setShowLogin={setShowLogin}/>: <></>}

      <div>
        
         <Navbar setShowLogin={setShowLogin}/>
         <Home/>
      </div>
      </>
     
  )
}

export default App
