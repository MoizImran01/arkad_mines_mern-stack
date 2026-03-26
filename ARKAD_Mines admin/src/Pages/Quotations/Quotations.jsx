import React, { useContext, useEffect, useMemo, useState, useCallback } from "react";
import "./Quotations.css";
import axios from "axios";
import { toast } from "react-toastify";
import { AdminAuthContext } from "../../context/AdminAuthContext";
import {
  FiAlertTriangle,
  FiFileText,
  FiRefreshCw,
  FiX,
  FiCheckCircle,
  FiDollarSign,
  FiDownload,
  FiCpu,
  FiTrendingUp
} from "react-icons/fi";
import Pagination from '../../../../shared/Pagination.jsx';

const Quotations = () => {
  const { token, url } = useContext(AdminAuthContext);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all"); // Filter by tab: all, draft, submitted, adjustment_required, revision_requested, issued, approved, rejected
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  const [issueFormData, setIssueFormData] = useState({
    taxPercentage: 0,
    shippingCost: 0,
    discountAmount: 0,
    adminNotes: "",
    itemPrices: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Pricing Suggestion State
  const [priceSuggestions, setPriceSuggestions] = useState({});
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState(null);

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

  const visibleQuotes = quotes.filter((quote) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      quote.referenceNumber?.toLowerCase().includes(q) ||
      quote.buyer?.companyName?.toLowerCase().includes(q) ||
      quote.buyer?.email?.toLowerCase().includes(q) ||
      quote.status?.toLowerCase().includes(q)
    );
  });
  const totalItems = visibleQuotes.length;
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageEnd = pageStart + ITEMS_PER_PAGE;
  const paginatedQuotes = visibleQuotes.slice(pageStart, pageEnd);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, quotes.length]);

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

  // Fetch AI pricing suggestions for the selected quotation's items
  const fetchPriceSuggestions = useCallback(async (quote) => {
    if (!quote?.items?.length) return;
    const isEditable = ["draft", "submitted", "adjustment_required"].includes(quote.status);
    if (!isEditable) return;

    setPricingLoading(true);
    setPricingError(null);
    setPriceSuggestions({});

    try {
      // Fetch stone details to get category/subcategory/grade
      const stoneIds = quote.items.map(item => item.stone).filter(Boolean);
      let stoneDetails = {};

      if (stoneIds.length > 0) {
        try {
          const stonesRes = await axios.get(`${url}/api/stones/list`, { headers });
          if (stonesRes.data?.success) {
            const allStones = stonesRes.data.data || stonesRes.data.stones || [];
            allStones.forEach(s => {
              stoneDetails[s._id] = s;
            });
          }
        } catch {
          // Proceed without stone details — use what's in the quotation
        }
      }

      const items = quote.items.map(item => {
        const stoneId = typeof item.stone === 'object' ? item.stone._id : item.stone;
        const stoneMeta = stoneDetails[stoneId] || {};
        return {
          stoneName: item.stoneName,
          category: stoneMeta.category || "Unknown",
          subcategory: stoneMeta.subcategory || "Unknown",
          grade: stoneMeta.grade || "Standard",
          priceUnit: item.priceUnit,
          requestedQuantity: item.requestedQuantity,
          priceSnapshot: item.priceSnapshot,
        };
      });

      const response = await axios.post(
        `${url}/api/pricing/predict-prices`,
        { items },
        { headers }
      );

      if (response.data?.success) {
        const suggestionsMap = {};
        response.data.predictions.forEach((pred, idx) => {
          suggestionsMap[idx] = pred;
        });
        setPriceSuggestions(suggestionsMap);
      }
    } catch (err) {
      console.error("AI pricing error:", err);
      const msg = err.response?.data?.message || "Pricing suggestions unavailable";
      setPricingError(msg);
    } finally {
      setPricingLoading(false);
    }
  }, [url, headers]);

  // Auto-fetch pricing when a quote is selected
  useEffect(() => {
    if (selectedQuote) {
      fetchPriceSuggestions(selectedQuote);
    }
  }, [selectedQuote?._id]);

  const handleApplySuggestedPrice = (itemIndex, price) => {
    handleItemPriceChange(itemIndex, price);
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
      if (price !== undefined && (Number.isNaN(Number(price)) || price < 0)) {
        invalidPrices.push(item.stoneName);
      }
    });

    if (invalidPrices.length > 0) {
      toast.error(`Invalid prices for items: ${invalidPrices.join(", ")}. Please enter valid non-negative numbers.`);
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
        toast.success("Quotation Issued Successfully!");
        fetchQuotes(); 
        setSelectedQuote(null); 
      } else {
        toast.error("Failed to issue quote: " + (response.data.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error issuing quote:", err);
      console.error("Error response:", err.response?.data);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Error issuing quote. Please check the console for details.";
      toast.error(errorMessage);
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
      toast.error("Failed to download PDF");
    }
  };

  return (
    <div className="quotations-container">
      <div className="quotations-header">
        <div>
          <div className="quotations-title-row">
            <h1><FiFileText /> Quotation Requests</h1>
            <button className="refresh-btn header-refresh-btn" onClick={fetchQuotes} disabled={refreshing}>
              {refreshing ? <FiRefreshCw className="spin" /> : <FiRefreshCw />} Refresh
            </button>
          </div>
          <p>Track buyer requests and issue formal quotations.</p>
        </div>
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
      <div className="quotations-search-row">
        <input
          type="text"
          placeholder="Search by reference, buyer, email or status..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="quotations-search-input"
        />
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
          ) : visibleQuotes.length === 0 ? (
            <div className="quotations-empty"><FiFileText /><p>No quotations found</p></div>
          ) : (
            <>
            <table className="quotations-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Reference</th>
                  <th>Buyer</th>
                  <th>Status</th>
                  <th>Cost</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {paginatedQuotes.map((quote, index) => (
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
                    <td>{pageStart + index + 1}</td>
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
            <Pagination currentPage={currentPage} setCurrentPage={setCurrentPage} totalItems={totalItems} itemsPerPage={ITEMS_PER_PAGE} label="quotations" />
            </>
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
                  
                  const suggestion = priceSuggestions[idx];

                  return (
                    <div key={idx} className="quote-item-card">
                      <div className="item-meta">
                        <strong>{item.stoneName}</strong>
                        <span>x{item.requestedQuantity}</span>
                      </div>
                      <div className="item-price-section">
                        {isEditable ? (
                          <div className="item-price-input-group">
                            <label htmlFor={`unit-price-${idx}`}>Unit Price (Rs):</label>
                            <input
                              id={`unit-price-${idx}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={currentPrice}
                              onChange={(e) => handleItemPriceChange(idx, e.target.value)}
                              placeholder={item.priceSnapshot}
                            />
                            <small>Base: Rs {item.priceSnapshot}</small>

                            {/* AI Price Badge */}
                            {suggestion && (
                              <div className="ai-price-badge" title={`Based on ${suggestion.based_on_samples} historical quotes`}>
                                <FiCpu className="ai-badge-icon" />
                                <span className="ai-badge-text">
                                  AI: Rs {suggestion.price_range_low.toLocaleString()}–{suggestion.price_range_high.toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  className="ai-apply-btn"
                                  onClick={() => handleApplySuggestedPrice(idx, suggestion.suggested_price)}
                                  title="Apply AI suggested price"
                                >
                                  Apply
                                </button>
                              </div>
                            )}
                            {pricingLoading && !suggestion && (
                              <div className="ai-price-badge loading">
                                <FiCpu className="ai-badge-icon spin" />
                                <span className="ai-badge-text">Getting AI suggestion...</span>
                              </div>
                            )}
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


            {/* AI Pricing Suggestion Card */}
            {["draft", "submitted", "adjustment_required", "revision_requested"].includes(selectedQuote.status) && Object.keys(priceSuggestions).length > 0 && (
              <div className="ai-pricing-card">
                <div className="ai-pricing-header">
                  <FiTrendingUp className="ai-card-icon" />
                  <h4>AI Pricing Insight</h4>
                  <span className="ai-confidence-badge">
                    {priceSuggestions[0]?.confidence || 0}% confidence
                  </span>
                </div>
                <p className="ai-pricing-desc">
                  Based on {priceSuggestions[0]?.based_on_samples || 0} historical quotations, here are the suggested unit prices:
                </p>
                <div className="ai-suggestions-list">
                  {selectedQuote.items?.map((item, idx) => {
                    const s = priceSuggestions[idx];
                    if (!s) return null;
                    const currentPrice = issueFormData.itemPrices[idx] !== undefined
                      ? issueFormData.itemPrices[idx]
                      : (item.finalUnitPrice || item.priceSnapshot || 0);
                    const diff = currentPrice > 0 ? ((s.suggested_price - currentPrice) / currentPrice * 100).toFixed(1) : 0;
                    return (
                      <div key={idx} className="ai-suggestion-row">
                        <span className="ai-stone-name">{item.stoneName}</span>
                        <span className="ai-suggested-val">Rs {s.suggested_price.toLocaleString()}</span>
                        <span className={`ai-diff ${Number(diff) >= 0 ? 'up' : 'down'}`}>
                          {Number(diff) >= 0 ? '+' : ''}{diff}%
                        </span>
                        <button
                          type="button"
                          className="ai-apply-btn-sm"
                          onClick={() => handleApplySuggestedPrice(idx, s.suggested_price)}
                        >
                          Use
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="ai-apply-all-btn"
                  onClick={() => {
                    Object.entries(priceSuggestions).forEach(([idx, s]) => {
                      handleApplySuggestedPrice(Number(idx), s.suggested_price);
                    });
                  }}
                >
                  <FiCpu /> Apply All Suggested Prices
                </button>
              </div>
            )}

            {pricingError && ["draft", "submitted", "adjustment_required"].includes(selectedQuote.status) && (
              <div className="ai-pricing-error">
                <FiAlertTriangle /> {pricingError}
              </div>
            )}

            {["draft", "submitted", "adjustment_required", "revision_requested"].includes(selectedQuote.status) && (
              <div className="admin-action-area">
                <hr />
                <h4> Issue Formal Quote</h4>
                
                <div className="form-group">
                  <label htmlFor="taxPercentage">Tax %</label>
                  <input 
                    type="number" 
                    id="taxPercentage"
                    name="taxPercentage" 
                    value={issueFormData.taxPercentage} 
                    onChange={handleInputChange} 
                    min="0"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="shippingCost">Shipping Cost (Rs)</label>
                  <input 
                    type="number" 
                    id="shippingCost"
                    name="shippingCost" 
                    value={issueFormData.shippingCost} 
                    onChange={handleInputChange} 
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="discountAmount">Discount (Rs)</label>
                  <input 
                    type="number" 
                    id="discountAmount"
                    name="discountAmount" 
                    value={issueFormData.discountAmount} 
                    onChange={handleInputChange} 
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="adminNotes">Admin Notes / Terms</label>
                  <textarea 
                    id="adminNotes"
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