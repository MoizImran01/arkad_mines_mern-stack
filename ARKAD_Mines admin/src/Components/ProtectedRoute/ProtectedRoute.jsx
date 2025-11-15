import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminAuthContext } from '../../context/AdminAuthContext';

// Protected route component that ensures only authenticated admins can access
const ProtectedRoute = ({ children }) => {
  const { token, adminUser, loading } = useContext(AdminAuthContext);


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


  if (!token || !adminUser || adminUser.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }


  return children;
};

export default ProtectedRoute;

