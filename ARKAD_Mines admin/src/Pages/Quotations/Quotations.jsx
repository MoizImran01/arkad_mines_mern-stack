import React, { useContext, useEffect, useMemo, useState } from "react";
import "./Quotations.css";
import axios from "axios";
import { AdminAuthContext } from "../../context/AdminAuthContext";
import { 
  FiAlertTriangle, 
  FiFileText, 
  FiRefreshCw, 
  FiX, 
  FiCheckCircle, 
  FiDollarSign, 
  FiDownload 
} from "react-icons/fi";

const Quotations = () => {
  const { token, url } = useContext(AdminAuthContext);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // Filter by tab: all, draft, submitted, adjustment_required, revision_requested, issued, approved, rejected

  
  const [issueFormData, setIssueFormData] = useState({
    taxPercentage: 0,
    shippingCost: 0,
    discountAmount: 0,
    adminNotes: "",
    itemPrices: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const response = await axios.get(`${url}/api/quotes/admin`, { 
        headers
      });
      if (response.data.success) {
        let quotations = response.data.quotations || [];
        
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
    if (tab === "all") {
      return quotations;
    }
    return quotations.filter(q => q.status === tab);
  };

  useEffect(() => {
    fetchQuotes();
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleSelectQuote = (quote) => {
    if (selectedQuote?._id === quote._id) {
      setSelectedQuote(null);
    } else {
      setSelectedQuote(quote);
     
      const itemPrices = {};
      quote.items?.forEach((item, idx) => {
        itemPrices[idx] = item.finalUnitPrice || item.priceSnapshot || 0;
      });

      setIssueFormData({
        taxPercentage: quote.financials?.taxPercentage || 0,
        shippingCost: quote.financials?.shippingCost || 0,
        discountAmount: quote.financials?.discountAmount || 0,
        adminNotes: quote.adminNotes || "",
        itemPrices,
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setIssueFormData((prev) => ({
      ...prev,
      [name]: name === "adminNotes" ? value : Number(value),
    }));
  };

  const handleItemPriceChange = (itemIndex, value) => {
    const price = value === "" ? "" : Number(value);
    setIssueFormData((prev) => ({
      ...prev,
      itemPrices: {
        ...prev.itemPrices,
        [itemIndex]: price,
      },
    }));
  };

  const handleIssueQuote = async () => {
    if (!selectedQuote) return;
    
    //Validation
    const invalidPrices = [];
    selectedQuote.items?.forEach((item, idx) => {
      const price = issueFormData.itemPrices[idx];
      if (price !== undefined && (isNaN(price) || price < 0)) {
        invalidPrices.push(item.stoneName);
      }
    });

    if (invalidPrices.length > 0) {
      alert(`Invalid prices for items: ${invalidPrices.join(", ")}. Please enter valid non-negative numbers.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.put(
        `${url}/api/quotes/${selectedQuote._id}/issue`,
        issueFormData,
        { headers }
      );

      if (response.data.success) {
        alert("Quotation Issued Successfully!");
        fetchQuotes(); 
        setSelectedQuote(null); 
      } else {
        alert("Failed to issue quote: " + (response.data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error issuing quote:", err);
      console.error("Error response:", err.response?.data);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Error issuing quote. Please check the console for details.";
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };


  const calculatePreviewTotal = () => {
    if (!selectedQuote) return 0;
    
    const subtotal = selectedQuote.items?.reduce((sum, item, idx) => {
      const price = issueFormData.itemPrices[idx] !== undefined 
        ? (issueFormData.itemPrices[idx] || 0)
        : (item.finalUnitPrice || item.priceSnapshot || 0);
      return sum + (price * item.requestedQuantity);
    }, 0) || 0;
    
    const tax = (subtotal * issueFormData.taxPercentage) / 100;
    return subtotal + tax + issueFormData.shippingCost - issueFormData.discountAmount;
  };

  const calculatePreviewSubtotal = () => {
    if (!selectedQuote) return 0;
    return selectedQuote.items?.reduce((sum, item, idx) => {
      const price = issueFormData.itemPrices[idx] !== undefined 
        ? (issueFormData.itemPrices[idx] || 0)
        : (item.finalUnitPrice || item.priceSnapshot || 0);
      return sum + (price * item.requestedQuantity);
    }, 0) || 0;
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

  return (
    <div className="quotations-container">
      <div className="quotations-header">
        <div>
          <h1><FiFileText /> Quotation Requests</h1>
          <p>Track buyer requests and issue formal quotations.</p>
        </div>
        <button className="refresh-btn" onClick={fetchQuotes} disabled={refreshing}>
          {refreshing ? <FiRefreshCw className="spin" /> : <FiRefreshCw />} Refresh
        </button>
      </div>

      <div className="quotations-tabs">
        <button
          className={`tab-button ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All Quotations
        </button>
        <button
          className={`tab-button ${activeTab === "draft" ? "active" : ""}`}
          onClick={() => setActiveTab("draft")}
        >
          Draft
        </button>
        <button
          className={`tab-button ${activeTab === "submitted" ? "active" : ""}`}
          onClick={() => setActiveTab("submitted")}
        >
          Submitted
        </button>
        <button
          className={`tab-button ${activeTab === "adjustment_required" ? "active" : ""}`}
          onClick={() => setActiveTab("adjustment_required")}
        >
          Adjustment Required
        </button>
        <button
          className={`tab-button ${activeTab === "revision_requested" ? "active" : ""}`}
          onClick={() => setActiveTab("revision_requested")}
        >
          Revision Requested
        </button>
        <button
          className={`tab-button ${activeTab === "issued" ? "active" : ""}`}
          onClick={() => setActiveTab("issued")}
        >
          Issued
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
            <div className="quotations-empty"><FiFileText /><p>No quotations found</p></div>
          ) : (
            <table className="quotations-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Buyer</th>
                  <th>Status</th>
                  <th>Cost</th>
                  <th>Date</th>
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
                    <td>
                      <span className={`status-badge ${quote.status}`}>{quote.status}</span>
                    </td>
                    <td>
                      {quote.financials?.grandTotal 
                        ? `Rs ${quote.financials.grandTotal.toLocaleString()}` 
                        : `Rs ${quote.totalEstimatedCost?.toLocaleString()} (Est)`}
                    </td>
                    <td>{new Date(quote.createdAt).toLocaleDateString()}</td>
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
              <h4>Status: <span style={{textTransform: 'capitalize'}}>{selectedQuote.status}</span></h4>
              {selectedQuote.notes && (
                <div className="buyer-note-section">
                  <strong>Buyer Note:</strong>
                  <p className="buyer-note-text">{selectedQuote.notes}</p>
                </div>
              )}
              {selectedQuote.buyerDecision && (
                <div className="buyer-decision-section">
                  <strong>Buyer Decision:</strong>
                  <p className="buyer-decision-text">
                    <span className={`decision-badge ${selectedQuote.buyerDecision.decision}`}>
                      {selectedQuote.buyerDecision.decision}
                    </span>
                    {selectedQuote.buyerDecision.comment && (
                      <span className="decision-comment"> - {selectedQuote.buyerDecision.comment}</span>
                    )}
                  </p>
                  {selectedQuote.buyerDecision.decisionDate && (
                    <small>Decision Date: {new Date(selectedQuote.buyerDecision.decisionDate).toLocaleString()}</small>
                  )}
                </div>
              )}
            </div>

            <div className="panel-section">
              <h4>Items</h4>
              <div className="quote-items-list">
                {selectedQuote.items?.map((item, idx) => {
                  const currentPrice = issueFormData.itemPrices[idx] !== undefined 
                    ? issueFormData.itemPrices[idx] 
                    : (item.finalUnitPrice || item.priceSnapshot || 0);
                  const isEditable = ["draft", "submitted", "adjustment_required"].includes(selectedQuote.status);
                  
                  return (
                    <div key={idx} className="quote-item-card">
                      <div className="item-meta">
                        <strong>{item.stoneName}</strong>
                        <span>x{item.requestedQuantity}</span>
                      </div>
                      <div className="item-price-section">
                        {isEditable ? (
                          <div className="item-price-input-group">
                            <label>Unit Price (Rs):</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentPrice}
                              onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                              placeholder={item.priceSnapshot}
                            />
                            <small>Base: Rs {item.priceSnapshot}</small>
                          </div>
                        ) : (
                          <small>Price: Rs {currentPrice} (Base: Rs {item.priceSnapshot})</small>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          
            {["draft", "submitted", "adjustment_required", "revision_requested"].includes(selectedQuote.status) && (
              <div className="admin-action-area">
                <hr />
                <h4> Issue Formal Quote</h4>
                
                <div className="form-group">
                  <label>Tax %</label>
                  <input 
                    type="number" 
                    name="taxPercentage" 
                    value={issueFormData.taxPercentage} 
                    onChange={handleInputChange} 
                    min="0"
                  />
                </div>
                
                <div className="form-group">
                  <label>Shipping Cost (Rs)</label>
                  <input 
                    type="number" 
                    name="shippingCost" 
                    value={issueFormData.shippingCost} 
                    onChange={handleInputChange} 
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Discount (Rs)</label>
                  <input 
                    type="number" 
                    name="discountAmount" 
                    value={issueFormData.discountAmount} 
                    onChange={handleInputChange} 
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Admin Notes / Terms</label>
                  <textarea 
                    name="adminNotes" 
                    value={issueFormData.adminNotes} 
                    onChange={handleInputChange}
                    placeholder="Terms of delivery, payment info..."
                    rows="3"
                  />
                </div>

                <div className="summary-preview">
                  <p>Subtotal: Rs {calculatePreviewSubtotal().toLocaleString()}</p>
                  <p>Est. Total (original): Rs {selectedQuote.totalEstimatedCost?.toLocaleString()}</p>
                  <p><strong>Final Total: Rs {calculatePreviewTotal().toLocaleString()}</strong></p>
                </div>

                <button 
                  className="issue-btn" 
                  onClick={handleIssueQuote} 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing..." : "Finalize & Issue Quote"} <FiCheckCircle />
                </button>
              </div>
            )}
            
          
            {["issued", "approved"].includes(selectedQuote.status) && (
               <div className="panel-section">
                 <h4>Financials</h4>
                 <p>Tax: {selectedQuote.financials?.taxPercentage}%</p>
                 <p>Shipping: Rs {selectedQuote.financials?.shippingCost}</p>
                 <p><strong>Grand Total: Rs {selectedQuote.financials?.grandTotal?.toLocaleString()}</strong></p>
                 
                 <div style={{ marginTop: '16px' }}>
                    <button 
                        className="issue-btn" 
                        onClick={handleDownloadPDF} 
                        style={{ width: '100%', background: '#476757ff' }}
                    >
                        <FiDownload /> Download Formal PDF
                    </button>
                 </div>
               </div>
            )}

          </div>
        ) : (
          <div className="quote-details-panel placeholder">
            <p>Select a quotation to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quotations;