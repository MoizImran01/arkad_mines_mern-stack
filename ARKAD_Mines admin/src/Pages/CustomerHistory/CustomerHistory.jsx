import React, { useState, useContext } from "react";
import "./CustomerHistory.css";
import { toast } from "react-toastify";
import axios from "axios";
import { AdminAuthContext } from "../../context/AdminAuthContext";
import { FiSearch, FiUser, FiFileText, FiPackage, FiDownload } from "react-icons/fi";

const CustomerHistory = () => {
  const { token, url } = useContext(AdminAuthContext);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [exporting, setExporting] = useState(false);

  const api = axios.create({
    baseURL: url,
    headers: { Authorization: `Bearer ${token}` },
  });

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      toast.info("Enter at least 2 characters to search");
      return;
    }
    setSearching(true);
    setCustomers([]);
    setSelectedCustomerId(null);
    setHistory(null);
    try {
      const res = await api.get("/api/customers/search", { params: { q } });
      if (res.data.success) {
        setCustomers(res.data.customers || []);
        if (!res.data.customers?.length) toast.info("No record");
      } else {
        toast.error(res.data.message || "Search failed");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || "Error searching customers";
      toast.error(msg);
      setCustomers([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCustomer = async (customerId) => {
    setSelectedCustomerId(customerId);
    setLoadingHistory(true);
    setHistory(null);
    try {
      const res = await api.get(`/api/customers/${customerId}/history`);
      if (res.data.success && res.data.data) {
        setHistory(res.data.data);
      } else {
        toast.info(res.data.message || "No record");
        setHistory(null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "No record";
      toast.info(msg);
      setHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExport = async () => {
    if (!selectedCustomerId) return;
    setExporting(true);
    try {
      const res = await api.get(`/api/customers/${selectedCustomerId}/history/export`, {
        params: { format: "csv" },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `customer-history-${selectedCustomerId}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="customer-history-container">
      <div className="customer-history-header">
        <h1>
          <FiUser className="header-icon" />
          View Customer History
        </h1>
        <p>Search for a customer to view contact details, quotes, and orders.</p>
      </div>

      <div className="customer-history-search">
        <div className="search-row">
          <input
            type="text"
            placeholder="Search by company name or email (min 2 characters)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button type="button" onClick={handleSearch} disabled={searching}>
            <FiSearch style={{ marginRight: 6, verticalAlign: "middle" }} />
            Search
          </button>
        </div>
      </div>

      {searching && (
        <div className="customer-history-loading">
          <div className="spinner" />
          <p>Searching...</p>
        </div>
      )}

      {!searching && customers.length > 0 && (
        <div className="search-results">
          <h3>Select a customer</h3>
          {customers.map((c) => (
            <div
              key={c._id}
              className="result-item"
              onClick={() => handleSelectCustomer(c._id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleSelectCustomer(c._id)}
            >
              <div>
                <div className="company">{c.companyName}</div>
                <div className="email">{c.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!searching && searchQuery.trim().length >= 2 && customers.length === 0 && !history && (
        <p className="no-record">No record</p>
      )}

      {loadingHistory && (
        <div className="customer-history-loading">
          <div className="spinner" />
          <p>Loading customer history...</p>
        </div>
      )}

      {!loadingHistory && history && (
        <>
          <div className="history-panel">
            <h3><FiUser /> Contact details</h3>
            <div className="contact-grid">
              <div className="contact-item">
                <strong>Company</strong>
                <span>{history.contact?.companyName || "—"}</span>
              </div>
              <div className="contact-item">
                <strong>Email</strong>
                <span>{history.contact?.email || "—"}</span>
              </div>
              <div className="contact-item">
                <strong>Role</strong>
                <span>{history.contact?.role || "—"}</span>
              </div>
            </div>
          </div>

          <div className="history-panel">
            <h3><FiFileText /> Quotes</h3>
            {history.quotes?.length > 0 ? (
              <div className="table-responsive">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Status</th>
                      <th>Total</th>
                      <th>Validity end</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.quotes.map((q) => (
                      <tr key={q.id}>
                        <td>{q.referenceNumber}</td>
                        <td>{q.status}</td>
                        <td>{Number(q.totalEstimatedCost).toFixed(2)}</td>
                        <td>{formatDate(q.validityEnd)}</td>
                        <td>{formatDate(q.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-record">No quotes</p>
            )}
          </div>

          <div className="history-panel">
            <h3><FiPackage /> Orders</h3>
            {history.orders?.length > 0 ? (
              <div className="table-responsive">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Order number</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Total</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.orders.map((o) => (
                      <tr key={o.id}>
                        <td>{o.orderNumber}</td>
                        <td>{o.status}</td>
                        <td>{o.paymentStatus}</td>
                        <td>{Number(o.grandTotal).toFixed(2)}</td>
                        <td>{formatDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="no-record">No orders</p>
            )}
            <div className="export-wrap">
              <button type="button" onClick={handleExport} disabled={exporting}>
                <FiDownload /> {exporting ? "Exporting..." : "Export history (CSV)"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerHistory;
