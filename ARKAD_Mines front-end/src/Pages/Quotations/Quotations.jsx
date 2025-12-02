import React, { useContext, useEffect, useMemo, useState } from "react";
import "./Quotations.css";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import { 
  FiAlertTriangle, 
  FiFileText, 
  FiRefreshCw, 
  FiX, 
  FiCheckCircle, 
  FiXCircle,
  FiEdit,
  FiDownload,
  FiClock,
  FiShoppingCart
} from "react-icons/fi";

const Quotations = () => {
  const { token, url } = useContext(StoreContext);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [decisionComment, setDecisionComment] = useState("");
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState(null); // "approve", "reject", or "revision"
  const [activeTab, setActiveTab] = useState("pending"); // Filter by tab: pending, approved, rejected, drafts, all

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
      // Fetch all quotations - we'll filter client-side by tab
      const response = await axios.get(`${url}/api/quotes/my`, { 
        headers
      });
      if (response.data.success) {
        let quotations = response.data.quotations || [];
        
        // Filter out expired quotations
        const now = new Date();
        quotations = quotations.filter(quote => {
          if (!quote.validity?.end) return true; // Keep if no validity end date
          return new Date(quote.validity.end) >= now;
        });
        
        // Filter by active tab
        quotations = filterQuotationsByTab(quotations, activeTab);
        
        setQuotes(quotations);
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

  const filterQuotationsByTab = (quotations, tab) => {
    switch (tab) {
      case "pending":
        // Submitted, Adjustment Required, Revision Requested, Issued
        return quotations.filter(q => 
          ["submitted", "adjustment_required", "revision_requested", "issued"].includes(q.status)
        );
      case "approved":
        return quotations.filter(q => q.status === "approved");
      case "rejected":
        return quotations.filter(q => q.status === "rejected");
      case "drafts":
        return quotations.filter(q => q.status === "draft");
      case "all":
        return quotations;
      default:
        return quotations;
    }
  };

  useEffect(() => {
    fetchQuotes();
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab]);

  const handleSelectQuote = (quote) => {
    if (selectedQuote?._id === quote._id) {
      setSelectedQuote(null);
    } else {
      setSelectedQuote(quote);
      setDecisionComment("");
    }
  };


  const openDecisionModal = (type) => {
    setDecisionType(type);
    setShowDecisionModal(true);
    setDecisionComment("");
  };

  const closeDecisionModal = () => {
    setShowDecisionModal(false);
    setDecisionType(null);
    setDecisionComment("");
  };

  const handleApprove = async () => {
    if (!selectedQuote) return;

    setActionLoading(true);
    try {
      const response = await axios.put(
        `${url}/api/quotes/${selectedQuote._id}/approve`,
        { comment: decisionComment },
        { headers }
      );

      if (response.data.success) {
        alert("Quotation approved successfully! Sales order has been created.");
        fetchQuotes();
        setSelectedQuote(null);
        closeDecisionModal();
      } else {
        alert("Failed to approve quotation: " + (response.data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error approving quotation:", err);
      const errorMessage = err.response?.data?.message || "Error approving quotation";
      alert(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedQuote) return;

    setActionLoading(true);
    try {
      const response = await axios.put(
        `${url}/api/quotes/${selectedQuote._id}/reject`,
        { comment: decisionComment },
        { headers }
      );

      if (response.data.success) {
        alert("Quotation rejected successfully.");
        fetchQuotes();
        setSelectedQuote(null);
        closeDecisionModal();
      } else {
        alert("Failed to reject quotation: " + (response.data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error rejecting quotation:", err);
      const errorMessage = err.response?.data?.message || "Error rejecting quotation";
      alert(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedQuote) return;

    if (!decisionComment.trim()) {
      alert("Please provide a comment explaining what needs to be revised.");
      return;
    }

    setActionLoading(true);
    try {
      const response = await axios.put(
        `${url}/api/quotes/${selectedQuote._id}/request-revision`,
        { comment: decisionComment },
        { headers }
      );

      if (response.data.success) {
        alert("Revision request submitted. Sales team will review and update the quotation.");
        fetchQuotes();
        setSelectedQuote(null);
        closeDecisionModal();
      } else {
        alert("Failed to request revision: " + (response.data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error requesting revision:", err);
      const errorMessage = err.response?.data?.message || "Error requesting revision";
      alert(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedQuote) return;
    try {
      const response = await axios.get(
        `${url}/api/quotes/${selectedQuote._id}/download`, 
        { 
          headers, 
          responseType: 'blob'
        }
      );

      const pdfUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.setAttribute('download', `Quotation-${selectedQuote.referenceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to download PDF");
    }
  };

  const handleConvertToOrder = async () => {
    if (!selectedQuote) return;

    if (selectedQuote.status !== "approved") {
      alert("Only approved quotations can be converted to sales orders.");
      return;
    }

    const confirmConvert = window.confirm(
      "Convert this approved quotation to a sales order?\n\n" +
      "Note: This feature is coming soon. This is a placeholder."
    );

    if (!confirmConvert) return;

    setActionLoading(true);
    try {
      const response = await axios.post(
        `${url}/api/quotes/${selectedQuote._id}/convert-to-order`,
        {},
        { headers }
      );

      if (response.data.success) {
        alert(response.data.message || "Sales order conversion requested. This feature is coming soon.");
        // TODO: Navigate to orders page or refresh when implemented
        // fetchQuotes();
      } else {
        alert("Failed to convert to sales order: " + (response.data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error converting to sales order:", err);
      const errorMessage = err.response?.data?.message || "Error converting to sales order";
      alert(errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (!token) {
    return (
      <div className="quotations-page">
        <div className="quotations-empty">
          <p>Please sign in to view your quotations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="quotations-page">
      <div className="quotations-header">
        <div>
          <h1><FiFileText /> My Quotations</h1>
          <p>Review and respond to quotations issued by the sales team.</p>
        </div>
        <button className="refresh-btn" onClick={fetchQuotes} disabled={refreshing}>
          {refreshing ? <FiRefreshCw className="spin" /> : <FiRefreshCw />} Refresh
        </button>
      </div>

      <div className="quotations-tabs">
        <button
          className={`tab-button ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending
        </button>
        <button
          className={`tab-button ${activeTab === "approved" ? "active" : ""}`}
          onClick={() => setActiveTab("approved")}
        >
          Approved
        </button>
        <button
          className={`tab-button ${activeTab === "rejected" ? "active" : ""}`}
          onClick={() => setActiveTab("rejected")}
        >
          Rejected
        </button>
        <button
          className={`tab-button ${activeTab === "drafts" ? "active" : ""}`}
          onClick={() => setActiveTab("drafts")}
        >
          Drafts
        </button>
        <button
          className={`tab-button ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All Quotations
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
            <div className="quotations-loading"><FiRefreshCw className="spin" /><p>Loading...</p></div>
          ) : quotes.length === 0 ? (
            <div className="quotations-empty"><FiFileText /><p>No issued quotations found</p></div>
          ) : (
            <table className="quotations-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Valid Until</th>
                  <th>Date Issued</th>
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
                      <span className={`status-badge ${quote.status}`}>
                        {quote.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {quote.financials?.grandTotal 
                        ? `Rs ${quote.financials.grandTotal.toLocaleString()}` 
                        : `Rs ${quote.totalEstimatedCost?.toLocaleString()}`}
                    </td>
                    <td>
                      {quote.validity?.end ? formatDate(quote.validity.end) : "N/A"}
                    </td>
                    <td>{formatDate(quote.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {selectedQuote ? (
          <div className="quote-details-panel">
            <div className="panel-header">
              <h3>{selectedQuote.referenceNumber}</h3>
              <button onClick={() => setSelectedQuote(null)}><FiX /> Close</button>
            </div>

            <div className="panel-section">
              <h4>Status: <span style={{textTransform: 'capitalize'}}>{selectedQuote.status.replace(/_/g, ' ')}</span></h4>
              {selectedQuote.validity && (
                <small>
                  Valid until: {formatDate(selectedQuote.validity.end)}
                </small>
              )}
            </div>

            <div className="panel-section">
              <h4>Items</h4>
              <div className="quote-items-list">
                {selectedQuote.items?.map((item, idx) => {
                  const price = item.finalUnitPrice || item.priceSnapshot || 0;
                  const total = price * item.requestedQuantity;
                  return (
                    <div key={idx} className="quote-item-card">
                      <div className="item-meta">
                        <strong>{item.stoneName}</strong>
                        <span>x{item.requestedQuantity}</span>
                      </div>
                      <div className="item-price-info">
                        <small>Unit Price: Rs {price.toLocaleString()}</small>
                        <small>Total: Rs {total.toLocaleString()}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="panel-section">
              <h4>Financial Summary</h4>
              {selectedQuote.financials ? (
                <div className="financial-summary">
                  <div className="financial-row">
                    <span>Subtotal:</span>
                    <span>Rs {selectedQuote.financials.subtotal?.toLocaleString()}</span>
                  </div>
                  {selectedQuote.financials.taxPercentage > 0 && (
                    <div className="financial-row">
                      <span>Tax ({selectedQuote.financials.taxPercentage}%):</span>
                      <span>Rs {selectedQuote.financials.taxAmount?.toLocaleString()}</span>
                    </div>
                  )}
                  {selectedQuote.financials.shippingCost > 0 && (
                    <div className="financial-row">
                      <span>Shipping:</span>
                      <span>Rs {selectedQuote.financials.shippingCost?.toLocaleString()}</span>
                    </div>
                  )}
                  {selectedQuote.financials.discountAmount > 0 && (
                    <div className="financial-row">
                      <span>Discount:</span>
                      <span>-Rs {selectedQuote.financials.discountAmount?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="financial-row total">
                    <span><strong>Grand Total:</strong></span>
                    <span><strong>Rs {selectedQuote.financials.grandTotal?.toLocaleString()}</strong></span>
                  </div>
                </div>
              ) : (
                <p>Estimated Total: Rs {selectedQuote.totalEstimatedCost?.toLocaleString()}</p>
              )}
            </div>

            {selectedQuote.adminNotes && (
              <div className="panel-section">
                <h4>Terms & Conditions</h4>
                <p className="admin-notes">{selectedQuote.adminNotes}</p>
              </div>
            )}

            {selectedQuote.status === "issued" && (
              <div className="panel-section action-buttons">
                <button 
                  className="action-btn approve-btn" 
                  onClick={() => openDecisionModal("approve")}
                  disabled={actionLoading}
                >
                  <FiCheckCircle /> Approve
                </button>
                <button 
                  className="action-btn reject-btn" 
                  onClick={() => openDecisionModal("reject")}
                  disabled={actionLoading}
                >
                  <FiXCircle /> Reject
                </button>
                <button 
                  className="action-btn revision-btn" 
                  onClick={() => openDecisionModal("revision")}
                  disabled={actionLoading}
                >
                  <FiEdit /> Request Revision
                </button>
                <button 
                  className="action-btn download-btn" 
                  onClick={handleDownloadPDF}
                >
                  <FiDownload /> Download PDF
                </button>
              </div>
            )}

            {selectedQuote.status === "approved" && (
              <div className="panel-section action-buttons">
                <button 
                  className="action-btn convert-order-btn" 
                  onClick={handleConvertToOrder}
                  disabled={actionLoading}
                >
                  <FiShoppingCart /> Convert to Sales Order
                </button>
                <button 
                  className="action-btn download-btn" 
                  onClick={handleDownloadPDF}
                >
                  <FiDownload /> Download PDF
                </button>
              </div>
            )}

            {selectedQuote.buyerDecision && (
              <div className="panel-section">
                <h4>Your Decision</h4>
                <p><strong>Status:</strong> {selectedQuote.buyerDecision.decision}</p>
                {selectedQuote.buyerDecision.comment && (
                  <p><strong>Comment:</strong> {selectedQuote.buyerDecision.comment}</p>
                )}
                {selectedQuote.buyerDecision.decisionDate && (
                  <p><strong>Date:</strong> {formatDate(selectedQuote.buyerDecision.decisionDate)}</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="quote-details-panel placeholder">
            <p>Select a quotation to view details</p>
          </div>
        )}
      </div>

      {showDecisionModal && (
        <div className="modal-overlay" onClick={closeDecisionModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {decisionType === "approve" && "Approve Quotation"}
                {decisionType === "reject" && "Reject Quotation"}
                {decisionType === "revision" && "Request Revision"}
              </h3>
              <button onClick={closeDecisionModal}><FiX /></button>
            </div>
            <div className="modal-body">
              <p>
                {decisionType === "approve" && "Are you sure you want to approve this quotation? A sales order will be created."}
                {decisionType === "reject" && "Are you sure you want to reject this quotation?"}
                {decisionType === "revision" && "Please provide details about what needs to be revised."}
              </p>
              <div className="form-group">
                <label>Comment (Optional):</label>
                <textarea
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  placeholder={
                    decisionType === "revision" 
                      ? "Describe what needs to be changed..." 
                      : "Add any comments..."
                  }
                  rows="4"
                  required={decisionType === "revision"}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeDecisionModal} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className={`btn-primary ${decisionType === "approve" ? "approve" : decisionType === "reject" ? "reject" : "revision"}`}
                onClick={() => {
                  if (decisionType === "approve") handleApprove();
                  else if (decisionType === "reject") handleReject();
                  else if (decisionType === "revision") handleRequestRevision();
                }}
                disabled={actionLoading || (decisionType === "revision" && !decisionComment.trim())}
              >
                {actionLoading ? "Processing..." : 
                  decisionType === "approve" ? "Approve" :
                  decisionType === "reject" ? "Reject" :
                  "Request Revision"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;

