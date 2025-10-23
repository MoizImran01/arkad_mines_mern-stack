// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import StoreContextProvider from "./context/StoreContext";
import { BrowserRouter } from "react-router-dom";

//entry point of the React application - renders the root component
ReactDOM.createRoot(document.getElementById("root")).render(
  //BrowserRouter enables client-side routing for the entire app
  <BrowserRouter>
    {/*StoreContextProvider wraps the app to provide global state management*/}
    <StoreContextProvider>
      <App />
    </StoreContextProvider>
  </BrowserRouter>
);