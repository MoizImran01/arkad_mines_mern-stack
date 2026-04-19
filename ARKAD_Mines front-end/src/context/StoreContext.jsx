import { createContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ArkadSocketBridge } from "../../../shared/ArkadSocketBridge.jsx";
import {
  normalizeApiBaseUrl,
  sanitizeTextForBrowserStorage,
} from "../../../shared/clientApiGuards.js";

export const StoreContext = createContext(null);

const migrateTokenFromLegacyStorage = () => {
  try {
    let t = sessionStorage.getItem("token") || "";
    if (t) return t;
    const legacy = localStorage.getItem("token");
    if (legacy) {
      sessionStorage.setItem("token", legacy);
      localStorage.removeItem("token");
      const role = localStorage.getItem("userRole");
      if (role) {
        sessionStorage.setItem("userRole", role);
        localStorage.removeItem("userRole");
      }
      return legacy;
    }
  } catch {
    /* ignore */
  }
  return "";
};

const StoreContextProvider = (props) => {
  const url = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

  const [token, setToken] = useState(() => migrateTokenFromLegacyStorage());
  const [user, setUser] = useState(null);
  const [quoteItems, setQuoteItems] = useState(() => {
    const stored = localStorage.getItem("quoteItems");
    return stored ? JSON.parse(stored) : [];
  });
  const [quoteNotes, setQuoteNotes] = useState(() =>
    sanitizeTextForBrowserStorage(localStorage.getItem("quoteNotes") || "")
  );
  const [activeQuoteId, setActiveQuoteId] = useState(
    () => sessionStorage.getItem("activeQuoteId") || null
  );

  useEffect(() => {
    try {
      if (token) {
        sessionStorage.setItem("token", token);
        localStorage.removeItem("token");
      } else {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("userRole");
        sessionStorage.removeItem("arkad_last_activity");
        localStorage.removeItem("token");
        localStorage.removeItem("userRole");
      }
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    if (quoteItems.length) {
      localStorage.setItem("quoteItems", JSON.stringify(quoteItems));
    } else {
      localStorage.removeItem("quoteItems");
    }
  }, [quoteItems]);

  useEffect(() => {
    const safe = sanitizeTextForBrowserStorage(quoteNotes ?? "");
    if (safe.trim()) {
      localStorage.setItem("quoteNotes", safe);
    } else {
      localStorage.removeItem("quoteNotes");
    }
  }, [quoteNotes]);

  useEffect(() => {
    if (activeQuoteId) {
      sessionStorage.setItem("activeQuoteId", activeQuoteId);
    } else {
      sessionStorage.removeItem("activeQuoteId");
    }
  }, [activeQuoteId]);

  const addItemToQuote = (item) => {
    setQuoteItems((prev) => {
      if (prev.some((existing) => existing._id === item._id)) {
        return prev;
      }

      return [
        ...prev,
        {
          _id: item._id,
          stoneName: item.stoneName,
          price: item.price,
          priceUnit: item.priceUnit,
          dimensions: item.dimensions,
          image: item.image,
          stockAvailability: item.stockAvailability,
          stockQuantity: item.stockQuantity,
          quantityDelivered: item.quantityDelivered || 0,
          requestedQuantity: 1,
          category: item.category,
          subcategory: item.subcategory,
        },
      ];
    });
  };

  const removeItemFromQuote = (stoneId) => {
    setQuoteItems((prev) => prev.filter((item) => item._id !== stoneId));
  };

  const updateQuoteItemQuantity = (stoneId, quantity) => {
    setQuoteItems((prev) =>
      prev.map((item) => {
        if (item._id !== stoneId) return item;
        

        const currentItem = prev.find(i => i._id === stoneId);
        const remainingQuantity = (currentItem?.stockQuantity || 0) - (currentItem?.quantityDelivered || 0);
        const maxAllowed = remainingQuantity > 0 ? remainingQuantity : 0;
        

        let newQuantity = Number(quantity);
        

        if (Number.isNaN(newQuantity) || newQuantity < 1) {
          newQuantity = 1;
        }
        

        if (maxAllowed > 0) {
          newQuantity = Math.min(newQuantity, maxAllowed);
        } else {
          newQuantity = 1; 
        }
        
        return {
          ...item,
          requestedQuantity: newQuantity,
        };
      })
    );
  };

  const replaceQuoteItems = (items = []) => {
    setQuoteItems(
      items.map((item) => ({
        _id: item._id,
        stoneName: item.stoneName,
        price: item.price,
        priceUnit: item.priceUnit,
        dimensions: item.dimensions,
        image: item.image,
        stockAvailability: item.stockAvailability,
        stockQuantity: item.stockQuantity,
        quantityDelivered: item.quantityDelivered || 0,
        requestedQuantity: Math.max(1, Number(item.requestedQuantity) || 1),
        category: item.category,
        subcategory: item.subcategory,
      }))
    );
  };

  const clearQuoteItems = () => {
    setQuoteItems([]);
    setQuoteNotes("");
    setActiveQuoteId(null);
  };

  const logout = () => {
    setToken("");
    setUser(null);
    try {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("userRole");
      sessionStorage.removeItem("arkad_last_activity");
      localStorage.removeItem("token");
      localStorage.removeItem("userRole");
    } catch {
      /* ignore */
    }
    clearQuoteItems();
  };

  const contextValue = {
    url,
    token,
    setToken,
    user,
    setUser,
    logout,
    quoteItems,
    addItemToQuote,
    removeItemFromQuote,
    updateQuoteItemQuantity,
    replaceQuoteItems,
    clearQuoteItems,
    quoteNotes,
    setQuoteNotes,
    activeQuoteId,
    setActiveQuoteId,
  };

  return (
    <StoreContext.Provider value={contextValue}>
      <ArkadSocketBridge apiBaseUrl={url} token={token} />
      {props.children}
    </StoreContext.Provider>
  );
};

StoreContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default StoreContextProvider;