import { createContext, useEffect, useState } from "react";
import PropTypes from "prop-types";

// Global context for token, user, quote items, and app URL.
export const StoreContext = createContext(null);

// Wraps the app and syncs auth/quote state with localStorage and sessionStorage.
const StoreContextProvider = (props) => {
  const url = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [quoteItems, setQuoteItems] = useState(() => {
    const stored = localStorage.getItem("quoteItems");
    return stored ? JSON.parse(stored) : [];
  });
  const [quoteNotes, setQuoteNotes] = useState(
    () => localStorage.getItem("quoteNotes") || ""
  );
  const [activeQuoteId, setActiveQuoteId] = useState(
    () => sessionStorage.getItem("activeQuoteId") || null
  );

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
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
    if (quoteNotes?.trim()) {
      localStorage.setItem("quoteNotes", quoteNotes);
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
    localStorage.removeItem("token");
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
      {props.children}
    </StoreContext.Provider>
  );
};

StoreContextProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export default StoreContextProvider;