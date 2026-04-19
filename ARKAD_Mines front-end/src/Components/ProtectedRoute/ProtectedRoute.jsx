import { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { StoreContext } from '../../context/StoreContext';

/** Redirects guests to home when no session token is present. */
const ProtectedRoute = ({ children }) => {
  const { token } = useContext(StoreContext);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ProtectedRoute;

