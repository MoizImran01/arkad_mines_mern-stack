import React, { useContext, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Quotations.css";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import ReCAPTCHA from "react-google-recaptcha";
import { 
  FiAlertTriangle, 
  FiFileText, 
  FiRefreshCw, 
  FiX, 
  FiCheckCircle, 
  FiXCircle,
  FiEdit,
  FiDownload,
  FiShoppingCart,
  FiLock
} from "react-icons/fi";

const RECAPTCHA_SITE_KEY = "6LfIkB0sAAAAANTjmfzZnffj2xE1POMF-Tnl3jYC";

const Quotations = () => {
  const { token, url } = useContext(StoreContext);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [decisionComment, setDecisionComment] = useState("");
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState(null); // "approve", "reject", or "revision"
  const [activeTab, setActiveTab] = useState("pending");
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [pendingApproval, setPendingApproval] = useState(null); // Store approval request data when re-auth needed
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [captchaPassword, setCaptchaPassword] = useState(""); // Password for CAPTCHA + re-auth flow
  const [pendingCaptchaApproval, setPendingCaptchaApproval] = useState(null); // Store approval request data when CAPTCHA needed
  const recaptchaRef = useRef(null);

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
      const response = await axios.get(`${url}/api/quotes/my`, { headers });
      if (response.data.success) {
        let quotations = response.data.quotations || [];
        
        const now = new Date();
        quotations = quotations.filter(quote => {
          if (!quote.validity?.end) return true;
          return new Date(quote.validity.end) >= now;
        });
        
        quotations = filterQuotationsByTab(quotations, activeTab);
        setQuotes(quotations);
      } else {
        setQuotes([]);
        setError(response.data.message || "Unable to load quotations");
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.statusText || err.message;
      console.error("Error fetching quotations:", errorMessage);
      setError(errorMessage); 
      setQuotes([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterQuotationsByTab = (quotations, tab) => {
    switch (tab) {
      case "pending":
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

  // --- RENAMED AND UNIFIED FUNCTION ---
  const handleConvertToSalesOrder = async (passwordForReauth = null) => {
    if (!selectedQuote) return;

    // SCENARIO 1: Quote is ALREADY Approved -> Just Redirect
    if (selectedQuote.status === "approved") {
      // NOTE: Since we don't have an endpoint to fetch the specific order ID yet,
      // we check if it's attached to the quote, or fallback to the reference number.
      const targetOrderNumber = selectedQuote.orderNumber || selectedQuote.referenceNumber;
      navigate(`/place-order/${targetOrderNumber}`);
      return;
    }

    // SCENARIO 2: Quote is ISSUED -> Call Approve API -> Then Redirect
    setActionLoading(true);
    try {
      const requestBody = { comment: decisionComment };
      
      //Include password if re-authentication is being provided
      if (passwordForReauth) {
        requestBody.passwordConfirmation = passwordForReauth;
      }

      const response = await axios.put(
        `${url}/api/quotes/${selectedQuote._id}/approve`,
        requestBody,
        { headers }
      );

      if (response.data.success) {
        const orderNum = response.data.order.orderNumber;
        
        
        if (showReauthModal) {
          setShowReauthModal(false);
          setReauthPassword("");
          setPendingApproval(null);
        }
        
        fetchQuotes();
        setSelectedQuote(null);
        closeDecisionModal();
        
        // Redirect to Place Order Page
        navigate(`/place-order/${orderNum}`);
      } else {
        alert("Failed to approve quotation: " + (response.data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error approving quotation:", err);
      
      // Check if CAPTCHA is required
      if (err.response?.data?.requiresCaptcha === true) {
        // Store the pending approval request
        setPendingCaptchaApproval({
          quoteId: selectedQuote._id,
          comment: decisionComment
        });
        // Show CAPTCHA modal
        setShowCaptchaModal(true);
        setActionLoading(false);
        return;
      }
      
      // Check if re-authentication is required
      if (err.response?.data?.requiresReauth === true) {
        // Store the pending approval request
        setPendingApproval({
          quoteId: selectedQuote._id,
          comment: decisionComment
        });

        setShowReauthModal(true);
        setActionLoading(false);
        return;
      }
      
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.response?.statusText || err.message;
      alert(`Failed to approve: ${errorMessage}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle CAPTCHA completion
  const handleCaptchaChange = (token) => {
    setCaptchaToken(token);
  };

  // Handle CAPTCHA expiration
  const handleCaptchaExpired = () => {
    setCaptchaToken(null);
  };

  // Handle CAPTCHA submission
  const handleCaptchaSubmit = async (e) => {
    e.preventDefault();
    if (!captchaToken) {
      alert("Please complete the CAPTCHA verification.");
      return;
    }
    if (!captchaPassword.trim()) {
      alert("Please enter your password to confirm this action.");
      return;
    }

    // Ensure we have a selected quote (use pendingCaptchaApproval if selectedQuote is null)
    const quoteToApprove = selectedQuote || (pendingCaptchaApproval ? quotes.find(q => q._id === pendingCaptchaApproval.quoteId) : null);
    const commentToUse = decisionComment || (pendingCaptchaApproval ? pendingCaptchaApproval.comment : "");

    if (!quoteToApprove) {
      alert("Error: Quotation not found. Please try again.");
      setShowCaptchaModal(false);
      setCaptchaToken(null);
      setCaptchaPassword("");
      recaptchaRef.current?.reset();
      setPendingCaptchaApproval(null);
      return;
    }

    setActionLoading(true);
    
    try {
      const requestBody = { 
        comment: commentToUse,
        captchaToken: captchaToken,
        passwordConfirmation: captchaPassword // Include password for re-auth
      };

      const response = await axios.put(
        `${url}/api/quotes/${quoteToApprove._id}/approve`,
        requestBody,
        { headers }
      );

      if (response.data.success) {
        const orderNum = response.data.order.orderNumber;
        
        // Close CAPTCHA modal
        setShowCaptchaModal(false);
        setCaptchaToken(null);
        setCaptchaPassword("");
        recaptchaRef.current?.reset();
        setPendingCaptchaApproval(null);
        
        fetchQuotes();
        setSelectedQuote(null);
        closeDecisionModal();
        
        // Redirect to Place Order Page
        navigate(`/place-order/${orderNum}`);
      } else {
        alert("Failed to approve quotation: " + (response.data.message || "Unknown error"));
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      }
    } catch (err) {
      console.error("Error approving quotation with CAPTCHA:", err);
      
      // If still requires CAPTCHA, reset and show error
      if (err.response?.data?.requiresCaptcha === true) {
        alert("CAPTCHA verification failed. Please try again.");
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      } else {
        const errorMessage = err.response?.data?.error || err.response?.data?.message || err.response?.statusText || err.message;
        alert(`Failed to approve: ${errorMessage}`);
        recaptchaRef.current?.reset();
        setCaptchaToken(null);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReauthSubmit = async (e) => {
    e.preventDefault();
    if (!reauthPassword.trim()) {
      alert("Please enter your password to confirm this action.");
      return;
    }

    // Ensure we have a selected quote (use pendingApproval if selectedQuote is null)
    const quoteToApprove = selectedQuote || (pendingApproval ? quotes.find(q => q._id === pendingApproval.quoteId) : null);
    const commentToUse = decisionComment || (pendingApproval ? pendingApproval.comment : "");

    if (!quoteToApprove) {
      alert("Error: Quotation not found. Please try again.");
      setShowReauthModal(false);
      setReauthPassword("");
      setPendingApproval(null);
      return;
    }

    setActionLoading(true);
    
    try {
      const requestBody = { 
        comment: commentToUse,
        passwordConfirmation: reauthPassword // Explicitly include password
      };

      console.log("Sending approval request with password:", { 
        quoteId: quoteToApprove._id, 
        hasPassword: !!reauthPassword,
        passwordLength: reauthPassword.length 
      });

      const response = await axios.put(
        `${url}/api/quotes/${quoteToApprove._id}/approve`,
        requestBody,
        { headers }
      );

      if (response.data.success) {
        const orderNum = response.data.order.orderNumber;
        
        // Close re-auth modal
        setShowReauthModal(false);
        setReauthPassword("");
        setPendingApproval(null);
        
        fetchQuotes();
        setSelectedQuote(null);
        closeDecisionModal();
        
        // Redirect to Place Order Page
        navigate(`/place-order/${orderNum}`);
      } else {
        alert("Failed to approve quotation: " + (response.data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error approving quotation with re-auth:", err);
      
      // If still requires re-auth, show error
      if (err.response?.data?.requiresReauth === true) {
        alert("Re-authentication failed. Please check your password and try again.");
        setReauthPassword(""); // Clear password field
      } else {
        const errorMessage = err.response?.data?.error || err.response?.data?.message || err.response?.statusText || err.message;
        alert(`Failed to approve: ${errorMessage}`);
      }
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
      const errorMessage = err.response?.data?.error || err.response?.statusText || err.message;
      alert(`Failed to reject: ${errorMessage}`);
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
      const errorMessage = err.response?.data?.error || err.response?.statusText || err.message;
      alert(`Failed to request revision: ${errorMessage}`);
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
      const errorMessage = err.response?.data?.error || err.response?.statusText || err.message;
      console.error("Download failed", err);
      alert(`Failed to download PDF: ${errorMessage}`);
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
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleSelectQuote(quote)
                      }
                    }}
                    tabIndex="0"
                    role="button"
                  >
                    <td>{quote.referenceNumber}</td>
                    <td>
                      <span className={`status-badge ${quote.status}`}>
                        {quote.status.replaceAll('_', ' ')}
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
              <h4>Status: <span style={{textTransform: 'capitalize'}}>{selectedQuote.status.replaceAll('_', ' ')}</span></h4>
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
                {/* Modal Trigger */}
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
                {/* DIRECT CONVERSION CALL */}
                <button 
                  className="action-btn convert-order-btn" 
                  onClick={handleConvertToSalesOrder}
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
        <div 
          className="modal-overlay" 
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content" role="document">
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
                <label htmlFor="decision-comment">Comment (Optional):</label>
                <textarea
                  id="decision-comment"
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
                  // UNIFIED CALL IN MODAL
                  if (decisionType === "approve") handleConvertToSalesOrder();
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

      {showCaptchaModal && (
        <div 
          className="modal-overlay" 
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content" role="document">
            <div className="modal-header">
              <h3>
                <FiLock />
                CAPTCHA Verification Required
              </h3>
              <button 
                onClick={() => {
                  setShowCaptchaModal(false);
                  setCaptchaToken(null);
                  setCaptchaPassword("");
                  recaptchaRef.current?.reset();
                  setPendingCaptchaApproval(null);
                }}
                aria-label="Close modal"
              >
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#e74c3c', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FiAlertTriangle />
                For security purposes, please complete the CAPTCHA verification and enter your password to approve this quotation.
              </p>
              <form onSubmit={handleCaptchaSubmit}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <span style={{ marginBottom: '10px', display: 'block' }}>CAPTCHA Verification:</span>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={RECAPTCHA_SITE_KEY}
                      onChange={handleCaptchaChange}
                      onExpired={handleCaptchaExpired}
                      theme="light"
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="captcha-password">Enter Your Password:</label>
                  <input
                    id="captcha-password"
                    type="password"
                    value={captchaPassword}
                    onChange={(e) => setCaptchaPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginTop: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div className="modal-footer">
                  <button 
                    type="button"
                    className="btn-secondary" 
                    onClick={() => {
                      setShowCaptchaModal(false);
                      setCaptchaToken(null);
                      setCaptchaPassword("");
                      recaptchaRef.current?.reset();
                      setPendingCaptchaApproval(null);
                    }}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={actionLoading || !captchaToken || !captchaPassword.trim()}
                  >
                    {actionLoading ? "Verifying..." : "Confirm & Approve"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Re-authentication Modal */}
      {showReauthModal && (
        <div 
          className="modal-overlay" 
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-content" role="document">
            <div className="modal-header">
              <h3>
                <FiLock style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Re-authentication Required
              </h3>
              <button onClick={() => {
                setShowReauthModal(false);
                setReauthPassword("");
                setPendingApproval(null);
              }}>
                <FiX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#e74c3c', marginBottom: '20px' }}>
                <FiAlertTriangle style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                For security purposes, please confirm your password to approve this quotation.
              </p>
              <form onSubmit={handleReauthSubmit}>
                <div className="form-group">
                  <label htmlFor="reauth-password">Enter Your Password:</label>
                  <input
                    id="reauth-password"
                    type="password"
                    value={reauthPassword}
                    onChange={(e) => setReauthPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoFocus
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      marginTop: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div className="modal-footer" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button 
                    type="button"
                    className="btn-secondary" 
                    onClick={() => {
                      setShowReauthModal(false);
                      setReauthPassword("");
                      setPendingApproval(null);
                    }}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={actionLoading || !reauthPassword.trim()}
                    style={{ backgroundColor: '#2d8659' }}
                  >
                    {actionLoading ? "Verifying..." : "Confirm & Approve"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;