import React, { useContext, useMemo, useState } from "react";
import "./RequestQuote.css";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiFileText,
  FiLoader,
  FiSave,
  FiSend,
  FiTrash2,
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const RequestQuote = () => {
  const {
    quoteItems,
    updateQuoteItemQuantity,
    removeItemFromQuote,
    clearQuoteItems,
    token,
    url,
    quoteNotes,
    setQuoteNotes,
    activeQuoteId,
    setActiveQuoteId,
  } = useContext(StoreContext);

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [unavailableItems, setUnavailableItems] = useState([]);
  const navigate = useNavigate();

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const estimatedTotal = useMemo(
    () =>
      quoteItems.reduce(
        (sum, item) => sum + (item.price || 0) * (item.requestedQuantity || 1),
        0
      ),
    [quoteItems]
  );

  const handleQuantityChange = (stoneId, value) => {
    updateQuoteItemQuantity(stoneId, value);
  };

  const handleServerError = (error) => {
    if (error.response?.data?.code === "ITEMS_UNAVAILABLE") {
      setUnavailableItems(error.response.data.unavailableItems || []);
      setFeedback({
        type: "warning",
        message: error.response.data.message,
      });
      return;
    }

    setFeedback({
      type: "error",
      message:
        error.response?.data?.message ||
        "Unable to process your request at this time.",
    });
  };

  const applyAdjustmentsLocally = () => {
    unavailableItems.forEach((item) => {
      if (item.type === "removed") {
        removeItemFromQuote(item.stoneId);
      }
      if (item.type === "adjusted" && item.availableQuantity) {
        updateQuoteItemQuantity(item.stoneId, item.availableQuantity);
      }
    });
  };

  const submitQuote = async ({ saveAsDraft, confirmAdjustments = false }) => {
    if (!token) {
      navigate("/");
      return;
    }

    if (!quoteItems.length) {
      setFeedback({
        type: "error",
        message: "Add at least one item from the catalog before requesting a quote.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const payload = {
        quoteId: activeQuoteId,
        items: quoteItems.map((item) => ({
          stoneId: item._id,
          quantity: item.requestedQuantity || 1,
        })),
        notes: quoteNotes,
        saveAsDraft,
        confirmAdjustments,
      };

      const response = await axios.post(`${url}/api/quotes`, payload, {
        headers,
      });

      setUnavailableItems([]);
      const { quotation } = response.data;
      setFeedback({
        type: "success",
        message: response.data.message,
        referenceNumber: quotation.referenceNumber,
        validity: quotation.validity,
      });

      if (saveAsDraft) {
        setActiveQuoteId(quotation._id);
      } else {
        clearQuoteItems();
        setActiveQuoteId(null);
        setQuoteNotes("");
      }
    } catch (error) {
      handleServerError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAdjustments = () => {
    applyAdjustmentsLocally();
    submitQuote({ saveAsDraft: false, confirmAdjustments: true });
  };

  return (
    <div className="request-quote-page">
      <div className="request-quote-header">
        <div>
          <h1>Request a Formal Quotation</h1>
        </div>
      </div>

      {feedback && (
        <div className={`feedback-banner ${feedback.type}`}>
          {feedback.type === "success" && <FiCheckCircle />}
          {feedback.type === "warning" && <FiAlertTriangle />}
          {feedback.type === "error" && <FiAlertTriangle />}
          {feedback.type === "info" && <FiFileText />}
          <div>
            <p>{feedback.message}</p>
            {feedback.referenceNumber && (
              <small>Reference: {feedback.referenceNumber}</small>
            )}
            {feedback.validity && (
              <small>
                Valid until:{" "}
                {new Date(feedback.validity.end).toLocaleDateString()}
              </small>
            )}
          </div>
        </div>
      )}

      {unavailableItems.length > 0 && (
        <div className="adjustments-panel">
          <h3>Availability Adjustments Needed</h3>
          <ul>
            {unavailableItems.map((item) => (
              <li key={item.stoneId}>
                <strong>{item.stoneName}</strong> — {item.reason}
              </li>
            ))}
          </ul>
          <div className="adjustment-actions">
            <button className="secondary-btn" onClick={() => setUnavailableItems([])}>
              Review Later
            </button>
            <button className="primary-btn" onClick={handleConfirmAdjustments}>
              Confirm & Continue
            </button>
          </div>
        </div>
      )}

      <div className="quote-content">
        <div className="quote-items-card">
          <div className="card-header">
            <h2>Selected Items</h2>
            <button
              className="clear-btn"
              onClick={clearQuoteItems}
              disabled={!quoteItems.length}
            >
              <FiTrash2 /> Clear All
            </button>
          </div>

          {!quoteItems.length ? (
            <div className="empty-state">
              <p>No items selected yet.</p>
              <button
                className="secondary-btn"
                onClick={() => navigate("/products")}
              >
                Browse Products
              </button>
            </div>
          ) : (
            <div className="quote-items-list">
              {quoteItems.map((item) => (
                <div key={item._id} className="quote-item">
                  <div className="item-details">
                    <img
                      src={`${url}/images/${item.image}`}
                      alt={item.stoneName}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://via.placeholder.com/80x80?text=No+Image";
                      }}
                    />
                    <div>
                      <h3>{item.stoneName}</h3>
                      <p>{item.dimensions}</p>
                      <small>{item.stockAvailability}</small>
                    </div>
                  </div>

                  <div className="item-actions">
                    <label>Quantity needed</label>
                    <input
                      type="number"
                      min="1"
                      value={item.requestedQuantity}
                      onChange={(e) =>
                        handleQuantityChange(item._id, e.target.value)
                      }
                    />
                    <span className="price-note">
                      Rs {item.price}/{item.priceUnit}
                    </span>
                    <button
                      className="link-btn"
                      onClick={() => removeItemFromQuote(item._id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <div className="continue-browsing">
                <button
                  className="secondary-btn"
                  onClick={() => navigate("/products")}
                >
                  Continue Browsing
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="quote-actions-card">
          <div className="notes-section">
            <label htmlFor="notes">Delivery Notes</label>
            <textarea
              id="notes"
              rows="5"
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
              placeholder="Add instructions for delivery, finishing, packaging, etc."
            ></textarea>
          </div>

          <div className="action-buttons">
            <button
              className="secondary-btn"
              onClick={() => submitQuote({ saveAsDraft: true })}
              disabled={loading || !quoteItems.length}
            >
              {loading ? <FiLoader className="spin" /> : <FiSave />}
              Save as Draft
            </button>
            <button
              className="primary-btn"
              onClick={() => submitQuote({ saveAsDraft: false })}
              disabled={loading || !quoteItems.length}
            >
              {loading ? <FiLoader className="spin" /> : <FiSend />}
              Submit Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestQuote;

