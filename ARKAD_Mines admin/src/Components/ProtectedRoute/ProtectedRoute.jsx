import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminAuthContext } from '../../context/AdminAuthContext';

// Protected route component that ensures only authenticated admins can access
const ProtectedRoute = ({ children }) => {
  const { token, adminUser, loading } = useContext(AdminAuthContext);

  // Show loading state while checking authentication
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

  // Redirect to login if not authenticated or not admin
  if (!token || !adminUser || adminUser.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  // Render protected content if authenticated as admin
  return children;
};

export default ProtectedRoute;

