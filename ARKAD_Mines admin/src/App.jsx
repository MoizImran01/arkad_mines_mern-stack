import React, { useContext } from 'react';
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
import { AdminAuthContext } from './context/AdminAuthContext'
import Users from './Pages/Users/Users'
import BlockInfo from './Pages/Dispatch/Dispatch'
import Quotations from './Pages/Quotations/Quotations'
import Analytics from './Pages/Analytics/Analytics'
import Forecasting from './Pages/Forecasting/Forecasting'
import PurchaseOrdersList from './Pages/PurchaseOrders/PurchaseOrdersList'
import CreatePurchaseOrder from './Pages/PurchaseOrders/CreatePurchaseOrder'

/** Admin shell: auth gate, sidebar layout, and feature routes. */
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
      <ToastContainer position="top-right" newestOnTop />
      <Routes>

        <Route path="/login" element={<AdminLogin />}/>
        

        <Route path="/" element={
          token && (adminUser?.role === 'admin' || adminUser?.role === 'employee') ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }/>
        <Route path="/analytics" element={<Navigate to="/dashboard" replace />} />
        
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
        
        <Route path="/block-info" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <BlockInfo/>
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
        
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <Analytics/>
              </div>
            </>
          </ProtectedRoute>
        }/>
        
        <Route path="/purchase-orders" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <PurchaseOrdersList/>
              </div>
            </>
          </ProtectedRoute>
        }/>
        
        <Route path="/create-purchase-order" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <CreatePurchaseOrder/>
              </div>
            </>
          </ProtectedRoute>
        }/>
        
        <Route path="/forecasting" element={
          <ProtectedRoute>
            <>
              <Navbar/>
              <hr/>
              <div className="app-content">
                <Siderbar/>
                <Forecasting/>
              </div>
            </>
          </ProtectedRoute>
        }/>
      </Routes>
    </div>
  )
}

export default App