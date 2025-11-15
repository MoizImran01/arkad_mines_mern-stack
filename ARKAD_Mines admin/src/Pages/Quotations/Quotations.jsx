import React, { useContext, useEffect, useMemo, useState } from "react";
import "./Quotations.css";
import axios from "axios";
import { AdminAuthContext } from "../../context/AdminAuthContext";
import { FiAlertTriangle, FiFileText, FiRefreshCw, FiX } from "react-icons/fi";

const Quotations = () => {
  const { token, url } = useContext(AdminAuthContext);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchQuotes = async () => {
    if (!token) return;

    setRefreshing(true);
    setError(null);

    try {
      const response = await axios.get(`${url}/api/quotes/admin`, {
        headers,
      });

      if (response.data.success) {
        setQuotes(response.data.quotations || []);
      } else {
        setQuotes([]);
        setError(response.data.message || "Unable to load quotations");
      }
    } catch (err) {
      console.error("Error fetching quotations:", err);
      setError("Unable to load quotations");
      setQuotes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectQuote = (quote) => {
    if (selectedQuote?._id === quote._id) {
      setSelectedQuote(null);
    } else {
      setSelectedQuote(quote);
    }
  };

  return (
    <div className="quotations-container">
      <div className="quotations-header">
        <div>
          <h1>
            <FiFileText /> Quotation Requests
          </h1>
          <p>Track buyer quotation submissions, drafts, and adjustments.</p>
        </div>
        <button className="refresh-btn" onClick={fetchQuotes} disabled={refreshing}>
          {refreshing ? <FiRefreshCw className="spin" /> : <FiRefreshCw />} Refresh
        </button>
      </div>

      {error && (
        <div className="quotations-error">
          <FiAlertTriangle /> {error}
          <button onClick={fetchQuotes}>Retry</button>
        </div>
      )}

      <div className="quotations-content">
        <div className="quotations-table-wrapper">
          {loading ? (
            <div className="quotations-loading">
              <FiRefreshCw className="spin" />
              <p>Loading quotations...</p>
            </div>
          ) : quotes.length === 0 ? (
            <div className="quotations-empty">
              <FiFileText />
              <p>No quotations found</p>
            </div>
          ) : (
            <table className="quotations-table">
              <thead>
                <tr>
                  <th>Reference #</th>
                  <th>Buyer</th>
                  <th>Items</th>
                  <th>Estimated Cost</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr
                    key={quote._id}
                    className={selectedQuote?._id === quote._id ? "selected" : ""}
                    onClick={() => handleSelectQuote(quote)}
                  >
                    <td>{quote.referenceNumber}</td>
                    <td>
                      <div className="buyer-info">
                        <strong>{quote.buyer?.companyName || "N/A"}</strong>
                        <small>{quote.buyer?.email}</small>
                      </div>
                    </td>
                    <td>{quote.items?.length || 0}</td>
                    <td>Rs {quote.totalEstimatedCost?.toLocaleString()}</td>
                    <td>{new Date(quote.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedQuote ? (
          <div className="quote-details-panel">
            <div className="panel-header">
              <h3>Quote Details</h3>
              <button onClick={() => setSelectedQuote(null)}>
                <FiX /> Close
              </button>
            </div>
            <div className="panel-section">
              <h4>Reference</h4>
              <p>{selectedQuote.referenceNumber}</p>
              <small>
                Valid until{" "}
                {new Date(selectedQuote.validity?.end).toLocaleDateString()}
              </small>
            </div>
            <div className="panel-section">
              <h4>Buyer</h4>
              <p>{selectedQuote.buyer?.companyName}</p>
              <small>{selectedQuote.buyer?.email}</small>
            </div>
            <div className="panel-section">
              <h4>Notes</h4>
              <p>{selectedQuote.notes || "No notes provided"}</p>
            </div>
            <div className="panel-section">
              <h4>Items Requested</h4>
              <div className="quote-items-list">
                {selectedQuote.items?.map((item) => (
                  <div
                    key={item.stone?.toString() || item.stoneName}
                    className="quote-item-card"
                  >
                    <div>
                      <strong>{item.stoneName}</strong>
                      <small>{item.dimensions}</small>
                    </div>
                    <div className="item-meta">
                      <span>Qty: {item.requestedQuantity}</span>
                      <span>
                        Rs {item.priceSnapshot}/{item.priceUnit}
                      </span>
                    </div>
                    <small>Status at request: {item.availabilityAtRequest}</small>
                  </div>
                ))}
              </div>
            </div>
            {selectedQuote.adjustments?.length ? (
              <div className="panel-section">
                <h4>Adjustments</h4>
                <ul className="adjustments-list">
                  {selectedQuote.adjustments.map((adjustment, idx) => (
                    <li key={`${adjustment.stoneId}-${idx}`}>
                      <strong>{adjustment.stoneName}</strong> — {adjustment.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="quote-details-panel placeholder">
            <p>Select a quotation to see details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quotations;

