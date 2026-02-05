import { useContext, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { StoreContext } from '../../context/StoreContext';

const ProtectedRoute = ({ children, setShowLogin }) => {
  const { token } = useContext(StoreContext);
  const location = useLocation();

  useEffect(() => {

    if (!token && setShowLogin) {
      setShowLogin(true);
    }
  }, [token, setShowLogin, location]);

  if (!token) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  setShowLogin: PropTypes.func,
};

export default ProtectedRoute;

