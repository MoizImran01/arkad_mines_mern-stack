import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const AdminAuthContext = createContext(null);

const AdminAuthContextProvider = (props) => {

  // Use environment variable for API URL, fallback to localhost for development
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

  // Verify admin token with backend and check if user is admin
  const verifyAdminToken = async (tokenToVerify) => {
    try {
      const response = await axios.get(`${url}/api/admin-dashboard`, {
        headers: {
          Authorization: `Bearer ${tokenToVerify}`
        },
        timeout: 5000 
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

      console.error("Token verification failed:", error);

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

