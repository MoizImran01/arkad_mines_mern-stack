import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const AdminAuthContext = createContext(null);

const AdminAuthContextProvider = (props) => {

  const url = import.meta.env.VITE_API_URL || "http://localhost:4000";
  

  const [token, setToken] = useState("");
  

  const [adminUser, setAdminUser] = useState(null);
  

  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const storedToken = localStorage.getItem("adminToken");
    if (storedToken) {
      setToken(storedToken);

      verifyAdminToken(storedToken);
    } else {
      setLoading(false);
    }

  }, []);


  useEffect(() => {
    if (token) {
      localStorage.setItem("adminToken", token);
    } else {
      localStorage.removeItem("adminToken");
      setAdminUser(null);
    }
  }, [token]);

  const verifyAdminToken = async (tokenToVerify) => {
    try {
      const response = await axios.get(`${url}/api/admin-dashboard`, {
        headers: {
          Authorization: `Bearer ${tokenToVerify}`
        },
        timeout: 10000 // Increased timeout for production
      });
      
      if (response.data) {
        try {
          const decoded = JSON.parse(atob(tokenToVerify.split('.')[1]));

          const storedUserData = localStorage.getItem("adminUserData");
          if (storedUserData) {
            setAdminUser(JSON.parse(storedUserData));
          } else {
            setAdminUser({ id: decoded.id, role: decoded.role });
          }
          setToken(tokenToVerify);
        } catch (decodeError) {
          console.error("Error decoding token:", decodeError);
          localStorage.removeItem("adminToken");
          localStorage.removeItem("adminUserData");
          setToken("");
          setAdminUser(null);
        }
      }
    } catch (error) {
      // Handle different error types
      if (error.code === 'ECONNABORTED') {
        console.error("Token verification timeout - network issue");
      } else if (error.code === 'ERR_NETWORK') {
        console.error("Token verification network error - check API URL:", url);
      } else {
        console.error("Token verification failed:", error.response?.status, error.response?.data?.message || error.message);
      }

      // Clear token on authentication errors
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUserData");
        setToken("");
        setAdminUser(null);
      } else if (!error.response) {
        // Network error - don't clear token, might be temporary
        console.warn("Network error during token verification - token kept for retry");
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken("");
    setAdminUser(null);
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUserData");
  };


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

