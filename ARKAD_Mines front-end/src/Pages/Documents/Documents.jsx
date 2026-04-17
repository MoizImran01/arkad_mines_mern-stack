import React, { useContext, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Documents.css";
import axios from "axios";
import { StoreContext } from "../../context/StoreContext";
import { 
  FiFileText, 
  FiRefreshCw, 
  FiLoader,
  FiDownload,
  FiFilter,
  FiX,
  FiCalendar,
  FiSearch,
  FiAlertCircle
} from "react-icons/fi";
import { toast } from "react-toastify";
import { subscribeLive } from '../../../../shared/socketLiveRegistry.js';

// Documents list with date/order/type filters and download.
const Documents = () => {
  const { token, url } = useContext(StoreContext);
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState("quote");
  
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [orderIdFilter, setOrderIdFilter] = useState("");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

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

  const fetchDocumentsRef = useRef(fetchDocuments);
  fetchDocumentsRef.current = fetchDocuments;

  useEffect(() => {
    const fn = () => fetchDocumentsRef.current();
    const u1 = subscribeLive("orders", fn);
    const u2 = subscribeLive("quotations", fn);
    const u3 = subscribeLive("notifications", fn);
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  useEffect(() => {
    fetchDocuments();
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    setFilteredDocuments(documents.filter(doc => doc.documentType === activeFilter));
  }, [activeFilter, documents]);
  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, filteredDocuments.length]);

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
            position: "top-right"
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
            position: "top-right"
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
    setActiveFilter("quote");
    fetchDocuments();
  };

  const getDocumentTypeLabel = (type) => {
    const labels = {
      quote: "Quote",
      invoice: "Invoice",
      receipt: "Receipt"
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
  const totalItems = filteredDocuments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageEnd = pageStart + ITEMS_PER_PAGE;
  const paginatedDocuments = filteredDocuments.slice(pageStart, pageEnd);

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
                <option value="invoice">Invoices</option>
                <option value="receipt">Receipts</option>
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
          className={`tab-button ${activeFilter === "quote" ? "active" : ""}`}
          onClick={() => setActiveFilter("quote")}
        >
          Quotes
        </button>
        <button
          className={`tab-button ${activeFilter === "invoice" ? "active" : ""}`}
          onClick={() => setActiveFilter("invoice")}
        >
          Invoices
        </button>
        <button
          className={`tab-button ${activeFilter === "receipt" ? "active" : ""}`}
          onClick={() => setActiveFilter("receipt")}
        >
          Receipts
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
            <FiLoader className="spin" size={24} />
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
                  <th>#</th>
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
                {paginatedDocuments.map((doc, index) => (
                  <tr key={doc.id}>
                    <td>{pageStart + index + 1}</td>
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
            <div className="universal-pagination">
              <div className="pagination-info">
                <span>
                  Showing {totalItems === 0 ? 0 : pageStart + 1} - {Math.min(pageEnd, totalItems)} of {totalItems} documents
                </span>
              </div>
              <div className="pagination-controls">
                <button className="pagination-btn" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Previous
                </button>
                <div className="pagination-numbers">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-number ${currentPage === pageNum ? "active" : ""}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button className="pagination-btn" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Documents;
