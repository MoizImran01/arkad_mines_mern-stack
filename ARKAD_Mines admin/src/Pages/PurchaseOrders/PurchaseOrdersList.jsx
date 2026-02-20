import React, { useState, useEffect } from 'react';
import './PurchaseOrdersList.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Truck,
  Search,
  Eye,
  X,
  RefreshCw,
  ClipboardList,
  Calendar,
  Package,
  MapPin,
  FileText,
  Hash,
  Layers
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const STATUS_CONFIG = {
  draft:            { label: 'Draft',            className: 'po-status-draft' },
  sent_to_supplier: { label: 'Sent to Supplier', className: 'po-status-sent' },
  in_transit:       { label: 'In Transit',        className: 'po-status-transit' },
  received:         { label: 'Received',          className: 'po-status-received' },
  cancelled:        { label: 'Cancelled',         className: 'po-status-cancelled' },
};


const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

const formatCurrency = (amount) => `Rs ${(amount || 0).toLocaleString()}`;

const PurchaseOrdersList = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailModal, setDetailModal] = useState(null);

  const authHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchOrders = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/api/procurement/list`, { headers: authHeaders() });
      if (res.data.success) {
        setPurchaseOrders(res.data.purchaseOrders);
        if (isRefresh) toast.success('Purchase orders refreshed');
      } else {
        toast.error('Error loading purchase orders');
      }
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleStatusChange = async (poId, newStatus) => {
    try {
      const res = await axios.put(
        `${API_URL}/api/procurement/status/${poId}`,
        { status: newStatus },
        { headers: authHeaders() }
      );
      if (res.data.success) {
        setPurchaseOrders((prev) =>
          prev.map((po) => (po._id === poId ? res.data.purchaseOrder : po))
        );
        if (newStatus === 'received') {
          toast.success('PO marked as received. Delivery date logged.');
        } else {
          toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
        }
      } else {
        toast.error(res.data.message || 'Failed to update status');
      }
    } catch {
      toast.error('Error updating status');
    }
  };


  const filtered = purchaseOrders.filter((po) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      po.poNumber.toLowerCase().includes(q) ||
      po.supplierName.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: purchaseOrders.length,
    draft: purchaseOrders.filter((p) => p.status === 'draft').length,
    sent: purchaseOrders.filter((p) => p.status === 'sent_to_supplier').length,
    transit: purchaseOrders.filter((p) => p.status === 'in_transit').length,
    received: purchaseOrders.filter((p) => p.status === 'received').length,
    totalCost: purchaseOrders
      .filter((p) => p.status !== 'cancelled')
      .reduce((s, p) => s + (p.totalCost || 0), 0),
  };

  if (loading) {
    return (
      <div className="po-loading-container">
        <div className="po-spinner" />
        <p>Loading purchase orders...</p>
      </div>
    );
  }

  return (
    <div className="po-container">
      {/* Header */}
      <div className="po-header">
        <div className="po-header-left">
          <div className="po-title-row">
            <h1>
              <Truck className="po-header-icon" />
              Purchase Orders
            </h1>
            <button
              className="po-refresh-btn"
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="po-spin" /> : <RefreshCw />}
              Refresh
            </button>
          </div>
          <p className="po-subtitle">
            Track inbound supplier orders &amp; deliveries
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="po-stats-grid">
        <div className="po-stat-card">
          <div className="po-stat-icon total"><ClipboardList /></div>
          <div className="po-stat-info"><h3>{stats.total}</h3><p>Total POs</p></div>
        </div>
        <div className="po-stat-card">
          <div className="po-stat-icon draft"><FileText /></div>
          <div className="po-stat-info"><h3>{stats.draft}</h3><p>Drafts</p></div>
        </div>
        <div className="po-stat-card">
          <div className="po-stat-icon sent"><Truck /></div>
          <div className="po-stat-info"><h3>{stats.sent + stats.transit}</h3><p>In Pipeline</p></div>
        </div>
        <div className="po-stat-card">
          <div className="po-stat-icon received"><Package /></div>
          <div className="po-stat-info"><h3>{stats.received}</h3><p>Received</p></div>
        </div>
        <div className="po-stat-card">
          <div className="po-stat-icon cost rupee-icon">₨</div>
          <div className="po-stat-info"><h3>{formatCurrency(stats.totalCost)}</h3><p>Total Value</p></div>
        </div>
      </div>

      {/* Search bar */}
      <div className="po-search-bar">
        <Search className="po-search-icon" />
        <input
          type="text"
          className="po-search-input"
          placeholder="Search by PO number or supplier name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="po-table-container">
        <div className="po-table-responsive">
          <table className="po-table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Order Date</th>
                <th>Stone (Category / Type)</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="po-empty-cell">
                    <div className="po-empty-state">
                      <ClipboardList className="po-empty-icon" />
                      <p className="po-empty-title">No purchase orders found</p>
                      <p className="po-empty-sub">Create a new PO to start tracking inbound orders</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((po) => (
                  <tr key={po._id} className="po-row">
                    <td className="po-number-cell">
                      <Hash className="po-cell-icon" />
                      {po.poNumber}
                    </td>
                    <td className="po-supplier-cell">
                      <MapPin className="po-cell-icon" />
                      {po.supplierName}
                    </td>
                    <td className="po-date-cell">
                      <Calendar className="po-cell-icon" />
                      {formatDate(po.orderDate)}
                    </td>
                    <td className="po-stone-cell">
                      {po.stones && po.stones.length > 0 ? (
                        <>
                          <div className="po-stone-name">{po.stones.length} stone{po.stones.length > 1 ? 's' : ''}</div>
                          <div className="po-stone-meta">
                            {po.stones.slice(0, 2).map((stone, idx) => (
                              <div key={idx} style={{ marginBottom: '4px' }}>
                                <span className="po-stone-name-small">{stone.stoneName}</span>
                                <span className={`po-cat-badge ${stone.category === 'Marble' ? 'marble' : 'granite'}`}>
                                  {stone.category}
                                </span>
                                <span className="po-sub-badge">{stone.subcategory}</span>
                              </div>
                            ))}
                            {po.stones.length > 2 && (
                              <div className="po-more-stones">+{po.stones.length - 2} more</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="po-stone-name">{po.stoneDetails?.stoneName}</div>
                          <div className="po-stone-meta">
                            <span className={`po-cat-badge ${po.stoneDetails?.category === 'Marble' ? 'marble' : 'granite'}`}>
                              {po.stoneDetails?.category}
                            </span>
                            <span className="po-sub-badge">{po.stoneDetails?.subcategory}</span>
                          </div>
                        </>
                      )}
                    </td>
                    <td className="po-qty-cell">
                      {po.stones && po.stones.length > 0
                        ? po.stones.reduce((sum, s) => sum + (s.quantityOrdered || 0), 0)
                        : po.quantityOrdered || 0}{' '}
                      <span className="po-qty-unit">Tons</span>
                    </td>
                    <td className="po-status-cell" onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`po-status-select ${STATUS_CONFIG[po.status]?.className || ''}`}
                        value={po.status}
                        onChange={(e) => handleStatusChange(po._id, e.target.value)}
                      >
                        {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                          <option key={value} value={value}>{cfg.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="po-actions-cell">
                      <button
                        className="po-view-btn"
                        onClick={() => setDetailModal(po)}
                        title="View Details"
                      >
                        <Eye />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {detailModal && (
        <div className="po-modal-overlay" role="dialog" aria-modal="true">
          <div className="po-modal" role="document">
            <div className="po-modal-header">
              <h3>Purchase Order Details</h3>
              <button className="po-modal-close" onClick={() => setDetailModal(null)}>
                <X />
              </button>
            </div>
            <div className="po-modal-body">
              {detailModal.stones && detailModal.stones.length > 0 ? (
                <>
                  <div className="po-detail-section po-detail-highlight">
                    <h4><Layers className="po-section-icon" /> Stone Details ({detailModal.stones.length} stones)</h4>
                    <div className="po-stones-list-modal">
                      {detailModal.stones.map((stone, idx) => (
                        <div key={idx} className="po-stone-item-modal">
                          <div className="po-stone-item-header-modal">
                            <h5>{stone.stoneName}</h5>
                            <div className="po-stone-item-badges-modal">
                              <span className={`po-cat-badge ${stone.category === 'Marble' ? 'marble' : 'granite'}`}>
                                {stone.category}
                              </span>
                              <span className="po-sub-badge">{stone.subcategory}</span>
                            </div>
                          </div>
                          <div className="po-stone-item-details-modal">
                            <div><span className="po-detail-label">Quantity</span><span className="po-detail-value">{stone.quantityOrdered} Tons</span></div>
                            <div><span className="po-detail-label">Price per Ton</span><span className="po-detail-value">{formatCurrency(stone.pricePerTon)}</span></div>
                            <div><span className="po-detail-label">Subtotal</span><span className="po-detail-value bold">{formatCurrency(stone.quantityOrdered * stone.pricePerTon)}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="po-detail-section po-detail-highlight">
                  <h4><Layers className="po-section-icon" /> Stone Details</h4>
                  <div className="po-detail-grid">
                    <div><span className="po-detail-label">Stone Name</span><span className="po-detail-value lg">{detailModal.stoneDetails?.stoneName}</span></div>
                    <div><span className="po-detail-label">Category</span><span className="po-detail-value">{detailModal.stoneDetails?.category}</span></div>
                    <div><span className="po-detail-label">Product Type</span><span className="po-detail-value">{detailModal.stoneDetails?.subcategory}</span></div>
                  </div>
                </div>
              )}

              <div className="po-detail-section">
                <h4><ClipboardList className="po-section-icon" /> Order Information</h4>
                <div className="po-detail-grid">
                  <div><span className="po-detail-label">PO Number</span><span className="po-detail-value mono">{detailModal.poNumber}</span></div>
                  <div><span className="po-detail-label">Supplier</span><span className="po-detail-value">{detailModal.supplierName}</span></div>
                  <div><span className="po-detail-label">Status</span><span className={`po-detail-value`}><span className={`po-detail-badge ${STATUS_CONFIG[detailModal.status]?.className}`}>{STATUS_CONFIG[detailModal.status]?.label}</span></span></div>
                  <div><span className="po-detail-label">Order Date</span><span className="po-detail-value">{formatDate(detailModal.orderDate)}</span></div>
                  <div><span className="po-detail-label">Expected Delivery</span><span className="po-detail-value">{formatDate(detailModal.expectedDeliveryDate)}</span></div>
                  <div><span className="po-detail-label">Actual Delivery</span><span className="po-detail-value">{formatDate(detailModal.actualDeliveryDate)}</span></div>
                </div>
              </div>

              <div className="po-detail-section">
                <h4><span className="po-section-icon rupee-icon">₨</span> Financial Summary</h4>
                <div className="po-detail-grid">
                  {detailModal.stones && detailModal.stones.length > 0 ? (
                    <>
                      <div><span className="po-detail-label">Total Quantity</span><span className="po-detail-value">{detailModal.stones.reduce((sum, s) => sum + (s.quantityOrdered || 0), 0)} Tons</span></div>
                      <div><span className="po-detail-label">Number of Stones</span><span className="po-detail-value">{detailModal.stones.length}</span></div>
                    </>
                  ) : (
                    <>
                      <div><span className="po-detail-label">Quantity Ordered</span><span className="po-detail-value">{detailModal.quantityOrdered} Tons</span></div>
                      <div><span className="po-detail-label">Price per Ton</span><span className="po-detail-value">{formatCurrency(detailModal.pricePerTon)}</span></div>
                    </>
                  )}
                  <div><span className="po-detail-label">Total Cost</span><span className="po-detail-value lg bold">{formatCurrency(detailModal.totalCost)}</span></div>
                </div>
              </div>

              {detailModal.notes && (
                <div className="po-detail-section">
                  <h4><FileText className="po-section-icon" /> Notes</h4>
                  <p className="po-detail-notes">{detailModal.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PurchaseOrdersList;
