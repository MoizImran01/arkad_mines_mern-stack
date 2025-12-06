import { createContext, useEffect, useState } from "react";

//create global context for application state management
export const StoreContext = createContext(null);

const StoreContextProvider = (props) => {
  // Use environment variable for API URL, fallback to localhost for development
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
      prev.map((item) =>
        item._id === stoneId
          ? {
              ...item,
              requestedQuantity: Math.max(1, Number(quantity) || 1),
            }
          : item
      )
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

export default StoreContextProvider;