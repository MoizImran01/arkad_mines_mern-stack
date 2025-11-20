import React, { useContext, useEffect, useMemo, useState } from "react";
import "./Orders.css";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import { useNavigate } from "react-router-dom";
import { FiExternalLink, FiFileText, FiLoader, FiRefreshCw } from "react-icons/fi";

const Orders = () => {
  const {
    token,
    url,
    replaceQuoteItems,
    setActiveQuoteId,
    setQuoteNotes,
  } = useContext(StoreContext);

  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchDrafts = async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);

    try {
      const response = await axios.get(`${url}/api/quotes/my?status=draft`, {
        headers,
      });

      if (response.data.success) {
        setDrafts(response.data.quotations || []);
      } else {
        setDrafts([]);
        setError(response.data.message || "Unable to load drafts");
      }
    } catch (err) {
      console.error("Error fetching drafts:", err);
      setError("Unable to load drafts");
      setDrafts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDrafts();
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const continueDraft = (draft) => {
    replaceQuoteItems(
      draft.items.map((item) => ({
        _id: item.stone,
        stoneName: item.stoneName,
        price: item.priceSnapshot,
        priceUnit: item.priceUnit,
        dimensions: item.dimensions,
        image: item.image,
        stockAvailability: item.availabilityAtRequest,
        requestedQuantity: item.requestedQuantity,
        category: item.category,
        subcategory: item.subcategory,
      }))
    );
    setQuoteNotes(draft.notes || "");
    setActiveQuoteId(draft._id);
    navigate("/request-quote");
  };

  if (!token) {
    return (
      <div className="orders-page">
        <div className="orders-empty">
          <p>Please sign in to view your quotation drafts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div>
          <h1>Drafts</h1>
        </div>
        <button className="refresh-btn" onClick={fetchDrafts} disabled={refreshing}>
          {refreshing ? <FiRefreshCw className="spin" /> : <FiRefreshCw />}
          Refresh
        </button>
      </div>

      {error && <div className="orders-error">{error}</div>}

      {loading ? (
        <div className="orders-loading">
          <FiLoader className="spin" />
          <p>Loading drafts...</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="orders-empty">
          <FiFileText />
          <p>No drafts found. Save a quote as draft to see it here.</p>
        </div>
      ) : (
        <div className="drafts-grid">
          {drafts.map((draft) => (
            <div key={draft._id} className="draft-card">
              <div className="draft-info">
                <h3>{draft.referenceNumber}</h3>
                <p>Items: {draft.items?.length || 0}</p>
                <small>
                  Last updated:{" "}
                  {new Date(draft.updatedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </small>
              </div>
              <div className="draft-actions">
                <p className="draft-total">
                  Estimated: Rs {draft.totalEstimatedCost?.toLocaleString()}
                </p>
                <button
                  className="primary-btn"
                  onClick={() => continueDraft(draft)}
                >
                  <FiExternalLink /> Continue Draft
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;

