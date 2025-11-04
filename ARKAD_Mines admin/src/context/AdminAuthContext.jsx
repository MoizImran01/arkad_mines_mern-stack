import { createContext, useEffect, useState } from "react";
import axios from "axios";

// Create global context for admin authentication state management
export const AdminAuthContext = createContext(null);

const AdminAuthContextProvider = (props) => {
  // Backend API base URL
  const url = "http://localhost:4000";
  
  // Authentication token state
  const [token, setToken] = useState("");
  
  // Current admin user data state
  const [adminUser, setAdminUser] = useState(null);
  
  // Loading state for initial auth check
  const [loading, setLoading] = useState(true);

  // Check for existing token in localStorage on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem("adminToken");
    if (storedToken) {
      setToken(storedToken);
      // Verify token with backend
      verifyAdminToken(storedToken);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync token changes to localStorage - persist login state
  useEffect(() => {
    if (token) {
      localStorage.setItem("adminToken", token);
    } else {
      localStorage.removeItem("adminToken");
      setAdminUser(null);
    }
  }, [token]);

  // Verify admin token with backend and check if user is admin
  const verifyAdminToken = async (tokenToVerify) => {
    try {
      const response = await axios.get(`${url}/api/admin-dashboard`, {
        headers: {
          Authorization: `Bearer ${tokenToVerify}`
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.data) {
        // Token is valid and user is admin
        // Decode JWT to get user info
        try {
          const decoded = JSON.parse(atob(tokenToVerify.split('.')[1]));
          // Get stored user data from localStorage or decode from token
          const storedUserData = localStorage.getItem("adminUserData");
          if (storedUserData) {
            setAdminUser(JSON.parse(storedUserData));
          } else {
            // Fallback: use decoded token data
            setAdminUser({ id: decoded.id, role: decoded.role });
          }
          setToken(tokenToVerify);
        } catch (decodeError) {
          console.error("Error decoding token:", decodeError);
          // Clear invalid token
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUserData");
          setToken("");
          setAdminUser(null);
        }
      }
    } catch (error) {
      // Token is invalid, user is not admin, or server error
      console.error("Token verification failed:", error);
      // Only clear if it's an auth error, not a network error
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUserData");
        setToken("");
        setAdminUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Clear all auth data and logout admin
  const logout = () => {
    setToken("");
    setAdminUser(null);
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUserData");
  };

  // Context value that will be available to all consuming components
  const contextValue = {
    url,
    token,
    setToken,
    adminUser,
    setAdminUser,
    logout,
    loading,
    verifyAdminToken
  };

  return (
    <AdminAuthContext.Provider value={contextValue}>
      {props.children}
    </AdminAuthContext.Provider>
  );
};

export default AdminAuthContextProvider;

