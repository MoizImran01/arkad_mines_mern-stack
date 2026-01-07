import React from 'react'
import Navbar from './Components/Navbar/Navbar'
import Siderbar from './Components/Siderbar/Sidebar'
import {Routes, Route, Navigate} from 'react-router-dom'
import './App.css'
import List from './Pages/List/List'
import Orders from './Pages/Orders/Orders'
import { ToastContainer} from 'react-toastify';
import { AddProduct } from './Pages/Add/AddProduct'
import AdminLogin from './Pages/Login/AdminLogin'
import ProtectedRoute from './Components/ProtectedRoute/ProtectedRoute'
import { useContext } from 'react'
import { AdminAuthContext } from './context/AdminAuthContext'
import Users from './Pages/Users/Users'
import Dispatch from './Pages/Dispatch/Dispatch'
import Quotations from './Pages/Quotations/Quotations'

const App = () => {
  const { token, adminUser, loading } = useContext(AdminAuthContext);

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("Loading timeout - setting loading to false");
      }
    }, 10000); 
    
    return () => clearTimeout(timeout);
  }, [loading]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div>
      <ToastContainer/>
      <Routes>

        <Route path="/login" element={<AdminLogin />}/>
        

        <Route path="/" element={
          token && adminUser?.role === 'admin' ? (
            <Navigate to="/add" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }/>
        
        <Route path="/add" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <AddProduct/>
              </div>
            </>
          </ProtectedRoute>
        }/>
        
        <Route path="/list" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <List/>
              </div>
            </>
          </ProtectedRoute>
        }/>
        
        <Route path="/orders" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <Orders/>
              </div>
            </>
          </ProtectedRoute>
        }/>
        
        <Route path="/dispatch" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <Dispatch/>
              </div>
            </>
          </ProtectedRoute>
        }/>
        
        <Route path="/users" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <Users/>
              </div>
            </>
          </ProtectedRoute>
        }/>
        
        <Route path="/quotes" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <Quotations/>
              </div>
            </>
          </ProtectedRoute>
        }/>
      </Routes>
    </div>
  )
}

export default App