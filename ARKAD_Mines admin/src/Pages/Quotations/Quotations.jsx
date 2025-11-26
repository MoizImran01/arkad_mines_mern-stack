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

  
  const [issueFormData, setIssueFormData] = useState({
    taxPercentage: 0,
    shippingCost: 0,
    discountAmount: 0,
    adminNotes: "",
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
      const response = await axios.get(`${url}/api/quotes/admin`, { headers });
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
  }, []);

  const handleSelectQuote = (quote) => {
    if (selectedQuote?._id === quote._id) {
      setSelectedQuote(null);
    } else {
      setSelectedQuote(quote);
     
      setIssueFormData({
        taxPercentage: quote.financials?.taxPercentage || 0,
        shippingCost: quote.financials?.shippingCost || 0,
        discountAmount: quote.financials?.discountAmount || 0,
        adminNotes: quote.adminNotes || "",
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

  const handleIssueQuote = async () => {
    if (!selectedQuote) return;
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
        alert("Failed to issue quote: " + response.data.message);
      }
    } catch (err) {
      console.error("Error issuing quote:", err);
      alert("Error issuing quote");
    } finally {
      setIsSubmitting(false);
    }
  };


  const calculatePreviewTotal = () => {
    if (!selectedQuote) return 0;
    const subtotal = selectedQuote.totalEstimatedCost;
    const tax = (subtotal * issueFormData.taxPercentage) / 100;
    return subtotal + tax + issueFormData.shippingCost - issueFormData.discountAmount;
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
              <small>Buyer Note: {selectedQuote.notes || "None"}</small>
            </div>

            <div className="panel-section">
              <h4>Items</h4>
              <div className="quote-items-list">
                {selectedQuote.items?.map((item, idx) => (
                  <div key={idx} className="quote-item-card">
                    <div className="item-meta">
                      <strong>{item.stoneName}</strong>
                      <span>x{item.requestedQuantity}</span>
                    </div>
                    <small>Base: Rs {item.priceSnapshot}</small>
                  </div>
                ))}
              </div>
            </div>

          
            {["draft", "submitted", "adjustment_required"].includes(selectedQuote.status) && (
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
                  <p>Est. Total: Rs {selectedQuote.totalEstimatedCost}</p>
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