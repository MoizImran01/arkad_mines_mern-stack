import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { AdminAuthContext } from '../../context/AdminAuthContext';

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


  const allowedRoles = ['admin', 'employee'];
  if (!token || !allowedRoles.includes(adminUser?.role)) {
    return <Navigate to="/login" replace />;
  }


  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired
};

export default ProtectedRoute;

