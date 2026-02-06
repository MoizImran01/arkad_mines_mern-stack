import React, { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Documents.css";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import { 
  FiFileText, 
  FiRefreshCw, 
  FiDownload,
  FiFilter,
  FiX,
  FiCalendar,
  FiSearch,
  FiAlertCircle
} from "react-icons/fi";
import { toast } from "react-toastify";

const Documents = () => {
  const { token, url } = useContext(StoreContext);
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("all");
  
  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("");

  const navigate = useNavigate();

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const fetchDocuments = async () => {
    if (!token) return;
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (orderIdFilter) params.append('orderId', orderIdFilter);
      if (documentTypeFilter && documentTypeFilter !== 'all') {
        params.append('documentType', documentTypeFilter);
      }

      const response = await axios.get(
        `${url}/api/documents?${params.toString()}`,
        { headers }
      );

      if (response.data.success) {
        const docs = response.data.documents || [];
        setDocuments(docs);
        setFilteredDocuments(docs);
      } else {
        setDocuments([]);
        setFilteredDocuments([]);
        setError(response.data.message || "Unable to load documents");
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.statusText || err.message;
      console.error("Error fetching documents:", errorMessage);
      setError(errorMessage);
      setDocuments([]);
      setFilteredDocuments([]);
      
      if (err.response?.status === 429) {
        toast.error("Too many requests. Please wait a moment.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (activeFilter === "all") {
      setFilteredDocuments(documents);
    } else {
      setFilteredDocuments(documents.filter(doc => doc.documentType === activeFilter));
    }
  }, [activeFilter, documents]);

  const handleDownload = async (documentId, format = 'PDF') => {
    try {
      const response = await axios.get(
        `${url}/api/documents/${documentId}/download/${format}`,
        {
          headers,
          responseType: 'blob',
          validateStatus: function (status) {
            return status < 500;
          }
        }
      );

      if (response.status === 429 || response.status >= 400) {
        let errorMessage = "Failed to download document.";
        
        try {
          const blob = response.data;
          const text = await blob.text();
          let errorData;
          try {
            errorData = JSON.parse(text);
          } catch (e) {
            errorData = { error: text || `Error ${response.status}` };
          }
          
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
        }
        
        if (response.status === 429) {
          toast.error(errorMessage || "Too many download requests. Please wait a moment before trying again.", {
            autoClose: 6000,
            position: "top-center"
          });
        } else if (response.status === 404) {
          toast.error("Document not found. It may have been archived.");
        } else if (response.status === 403) {
          toast.error("You don't have permission to download this document.");
        } else {
          toast.error(errorMessage);
        }
        return;
      }

      const contentDisposition = response.headers['content-disposition'];
      let filename = `document.${format.toLowerCase()}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/['"]/g, '').trim();
        }
      }
      
      if (filename === `document.${format.toLowerCase()}`) {
        const docType = documents.find(d => d.id === documentId)?.documentType || 'document';
        const docNumber = documents.find(d => d.id === documentId)?.documentNumber || 'unknown';
        filename = `${docType.charAt(0).toUpperCase() + docType.slice(1).replace('_', '')}-${docNumber}.${format.toLowerCase()}`;
      }

      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      console.error("Download error:", err);
      
      let errorMessage = "Failed to download document. Please try again.";
      
      if (err.response) {
        if (err.response.status === 429) {
          try {
            if (err.response.data instanceof Blob) {
              const text = await err.response.data.text();
              const errorData = JSON.parse(text);
              errorMessage = errorData.error || errorData.message || 
                "Too many download requests. Please wait a moment before trying again.";
            } else {
              errorMessage = err.response.data?.error || err.response.data?.message || 
                "Too many download requests. Please wait a moment before trying again.";
            }
          } catch (e) {
            errorMessage = "Too many download requests. Please wait a moment before trying again.";
          }
          toast.error(errorMessage, {
            autoClose: 6000,
            position: "top-center"
          });
        } else if (err.response.status === 404) {
          toast.error("Document not found. It may have been archived.");
        } else if (err.response.status === 403) {
          toast.error("You don't have permission to download this document.");
        } else {
          errorMessage = err.response.data?.message || err.response.statusText || errorMessage;
          toast.error(errorMessage);
        }
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const applyFilters = () => {
    fetchDocuments();
    setShowFilters(false);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setOrderIdFilter("");
    setDocumentTypeFilter("");
    setActiveFilter("all");
    fetchDocuments();
  };

  const getDocumentTypeLabel = (type) => {
    const labels = {
      quote: "Quote",
      proforma: "Proforma Invoice",
      tax_invoice: "Tax Invoice",
      receipt: "Receipt",
      statement: "Statement"
    };
    return labels[type] || type;
  };

  const getDocumentTypeIcon = (type) => {
    return <FiFileText />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatAmount = (amount) => {
    return `Rs ${(amount || 0).toLocaleString()}`;
  };

  if (!token) {
    return (
      <div className="documents-page">
        <div className="documents-empty">
          <FiAlertCircle />
          <p>Please sign in to view your documents.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="documents-page">
      <div className="documents-header">
        <h1>
          <FiFileText />
          Document History
        </h1>
        <div className="header-actions">
          <button
            className={`filter-btn ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter />
            Filters
          </button>
          <button
            className="refresh-btn"
            onClick={fetchDocuments}
            disabled={refreshing}
          >
            <FiRefreshCw className={refreshing ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>
                <FiCalendar />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>
                <FiCalendar />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>
                <FiSearch />
                Order ID
              </label>
              <input
                type="text"
                placeholder="e.g., ORD-123"
                value={orderIdFilter}
                onChange={(e) => setOrderIdFilter(e.target.value)}
              />
            </div>
            <div className="filter-group">
              <label>
                <FiFileText />
                Document Type
              </label>
              <select
                value={documentTypeFilter}
                onChange={(e) => setDocumentTypeFilter(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="quote">Quotes</option>
                <option value="proforma">Proforma Invoices</option>
                <option value="tax_invoice">Tax Invoices</option>
                <option value="receipt">Receipts</option>
                <option value="statement">Statements</option>
              </select>
            </div>
          </div>
          <div className="filters-actions">
            <button className="apply-btn" onClick={applyFilters}>
              Apply Filters
            </button>
            <button className="clear-btn" onClick={clearFilters}>
              <FiX />
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="documents-tabs">
        <button
          className={`tab-button ${activeFilter === "all" ? "active" : ""}`}
          onClick={() => setActiveFilter("all")}
        >
          All Documents
        </button>
        <button
          className={`tab-button ${activeFilter === "quote" ? "active" : ""}`}
          onClick={() => setActiveFilter("quote")}
        >
          Quotes
        </button>
        <button
          className={`tab-button ${activeFilter === "proforma" ? "active" : ""}`}
          onClick={() => setActiveFilter("proforma")}
        >
          Proformas
        </button>
        <button
          className={`tab-button ${activeFilter === "tax_invoice" ? "active" : ""}`}
          onClick={() => setActiveFilter("tax_invoice")}
        >
          Invoices
        </button>
        <button
          className={`tab-button ${activeFilter === "receipt" ? "active" : ""}`}
          onClick={() => setActiveFilter("receipt")}
        >
          Receipts
        </button>
        <button
          className={`tab-button ${activeFilter === "statement" ? "active" : ""}`}
          onClick={() => setActiveFilter("statement")}
        >
          Statements
        </button>
      </div>

      {error && (
        <div className="documents-error">
          <FiAlertCircle />
          <span>{error}</span>
        </div>
      )}

      <div className="documents-content">
        {loading ? (
          <div className="documents-loading">
            <FiRefreshCw className="spin" />
            <p>Loading documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="documents-empty">
            <FiFileText />
            <p>No documents found</p>
            {documents.length === 0 && (
              <p className="empty-subtext">
                Your documents will appear here once you have orders or quotations.
              </p>
            )}
          </div>
        ) : (
          <div className="documents-table-wrapper">
            <table className="documents-table">
              <thead>
                <tr>
                  <th>Document Type</th>
                  <th>Document Number</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Order Number</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="document-type-cell">
                        {getDocumentTypeIcon(doc.documentType)}
                        <span>{getDocumentTypeLabel(doc.documentType)}</span>
                      </div>
                    </td>
                    <td><strong>{doc.documentNumber}</strong></td>
                    <td>{formatDate(doc.date)}</td>
                    <td>{formatAmount(doc.amount)}</td>
                    <td>
                      <span className={`status-badge status-${doc.status?.toLowerCase()}`}>
                        {doc.status?.charAt(0).toUpperCase() + doc.status?.slice(1) || 'N/A'}
                      </span>
                    </td>
                    <td>{doc.orderNumber || 'N/A'}</td>
                    <td>
                      <div className="action-buttons">
                        {doc.formats?.includes('PDF') && (
                          <button
                            className="download-btn"
                            onClick={() => handleDownload(doc.id, 'PDF')}
                            title="Download PDF"
                          >
                            <FiDownload />
                            PDF
                          </button>
                        )}
                        {doc.formats?.includes('CSV') && (
                          <button
                            className="download-btn csv-btn"
                            onClick={() => handleDownload(doc.id, 'CSV')}
                            title="Download CSV"
                          >
                            <FiDownload />
                            CSV
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;
