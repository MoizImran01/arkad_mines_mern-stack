import { createContext, useEffect, useState } from "react";

//create global context for application state management
export const StoreContext = createContext(null);

const StoreContextProvider = (props) => {
  //backend API base URL
  const url = "http://localhost:4000"; 
  //authentication token state
  const [token, setToken] = useState("");
  //current user data state
  const [user, setUser] = useState(null);

  //check for existing token in localStorage on component mount
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  //sync token changes to localStorage - persist login state
  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
  }, [token]);


  //clear all auth data and logout user
  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
  };

  //context value that will be available to all consuming components
  const contextValue = {
    url,
    token,
    setToken,
    user,
    setUser,
    logout,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {props.children}
    </StoreContext.Provider>
  );
};

export default StoreContextProvider;