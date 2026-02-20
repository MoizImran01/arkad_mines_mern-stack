import React, { useState, useEffect } from 'react';
import './CreatePurchaseOrder.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  ShoppingCart,
  CheckCircle2,
  X,
  Plus,
  Loader2,
  Search,
  Package,
  Layers,
  DollarSign,
  Hash,
  MapPin,
  RefreshCw
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const formatCurrency = (amount) => `Rs ${(amount || 0).toLocaleString()}`;

const CreatePurchaseOrder = () => {
  const [markedStones, setMarkedStones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStoneIds, setSelectedStoneIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [stoneQuantities, setStoneQuantities] = useState({});
  const [stonePrices, setStonePrices] = useState({});

  const authHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchMarkedStones = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch both marked stones and forecasting data
      const [stonesRes, forecastRes] = await Promise.all([
        axios.get(`${API_URL}/api/stones/marked-for-po`, { headers: authHeaders() }),
        axios.get(`${API_URL}/api/forecasting/forecast`)
      ]);

      if (stonesRes.data.success) {
        const stones = stonesRes.data.stones;
        const forecasts = forecastRes.data.forecasts || forecastRes.data.data || [];

        // Create a map of forecasting data by stoneName + subcategory
        const forecastMap = {};
        forecasts.forEach((f) => {
          const key = `${f.stoneName}_${f.subcategory}`;
          forecastMap[key] = f;
        });

        // Merge forecasting data with stones
        const mergedStones = stones.map((stone) => {
          const key = `${stone.stoneName}_${stone.subcategory}`;
          const forecast = forecastMap[key];
          return {
            ...stone,
            dynamic_reorder_point: forecast?.dynamic_reorder_point,
            suggested_po_quantity: forecast?.suggested_po_quantity
          };
        });

        setMarkedStones(mergedStones);
        if (isRefresh) toast.success('Marked stones refreshed');
      } else {
        toast.error('Error loading marked stones');
      }
    } catch (error) {
      console.error('Error fetching marked stones:', error);
      toast.error('Failed to load marked stones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMarkedStones();
  }, []);

  const toggleStoneSelection = (stoneId) => {
    const newSelected = new Set(selectedStoneIds);
    if (newSelected.has(stoneId)) {
      newSelected.delete(stoneId);
      // Clear quantities and prices for deselected stone
      setStoneQuantities((prev) => {
        const updated = { ...prev };
        delete updated[stoneId];
        return updated;
      });
      setStonePrices((prev) => {
        const updated = { ...prev };
        delete updated[stoneId];
        return updated;
      });
    } else {
      newSelected.add(stoneId);
      // Initialize with suggested quantity from reorder point (if available)
      const stone = markedStones.find((s) => s._id === stoneId);
      if (stone && (stone.suggested_po_quantity || stone.dynamic_reorder_point)) {
        setStoneQuantities((prev) => ({
          ...prev,
          [stoneId]: Math.ceil(stone.suggested_po_quantity || stone.dynamic_reorder_point)
        }));
      } else {
        setStoneQuantities((prev) => ({
          ...prev,
          [stoneId]: ''
        }));
      }
      setStonePrices((prev) => ({
        ...prev,
        [stoneId]: stone?.price || ''
      }));
    }
    setSelectedStoneIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedStoneIds.size === filteredStones.length) {
      setSelectedStoneIds(new Set());
      setStoneQuantities({});
      setStonePrices({});
    } else {
      const allIds = new Set(filteredStones.map((s) => s._id));
      setSelectedStoneIds(allIds);
      const newQuantities = {};
      const newPrices = {};
      filteredStones.forEach((stone) => {
        newQuantities[stone._id] = (stone.suggested_po_quantity || stone.dynamic_reorder_point)
          ? Math.ceil(stone.suggested_po_quantity || stone.dynamic_reorder_point)
          : '';
        newPrices[stone._id] = stone.price || '';
      });
      setStoneQuantities(newQuantities);
      setStonePrices(newPrices);
    }
  };

  const filteredStones = markedStones.filter((stone) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      stone.stoneName?.toLowerCase().includes(q) ||
      stone.category?.toLowerCase().includes(q) ||
      stone.subcategory?.toLowerCase().includes(q)
    );
  });

  const selectedStones = filteredStones.filter((s) => selectedStoneIds.has(s._id));

  const handleCreatePO = async () => {
    if (!supplierName) {
      toast.error('Please enter supplier name');
      return;
    }

    if (selectedStones.length === 0) {
      toast.error('Please select at least one stone');
      return;
    }

    // Validate all selected stones have quantity and price
    for (const stone of selectedStones) {
      if (!stoneQuantities[stone._id] || !stonePrices[stone._id]) {
        toast.error(`Please enter quantity and price for ${stone.stoneName}`);
        return;
      }
    }

    setCreating(true);
    try {
      const stonesPayload = selectedStones.map((stone) => ({
        stoneName: stone.stoneName,
        category: stone.category,
        subcategory: stone.subcategory,
        quantityOrdered: Number(stoneQuantities[stone._id]),
        pricePerTon: Number(stonePrices[stone._id]),
        suggestedQuantity: stone.suggested_po_quantity || stone.dynamic_reorder_point || undefined
      }));

      const payload = {
        supplierName,
        stones: stonesPayload,
        expectedDeliveryDate: expectedDeliveryDate || undefined,
        notes: notes || undefined
      };

      const res = await axios.post(`${API_URL}/api/procurement/create`, payload, { headers: authHeaders() });
      if (res.data.success) {
        toast.success(`Purchase order ${res.data.purchaseOrder.poNumber} created successfully`);
        setCreateModal(false);
        setSupplierName('');
        setExpectedDeliveryDate('');
        setNotes('');
        setSelectedStoneIds(new Set());
        setStoneQuantities({});
        setStonePrices({});
        fetchMarkedStones();
      } else {
        toast.error(res.data.message || 'Failed to create purchase order');
      }
    } catch (error) {
      console.error('Error creating PO:', error);
      toast.error(error.response?.data?.message || 'Error creating purchase order');
    } finally {
      setCreating(false);
    }
  };

  const totalCost = selectedStones.reduce((sum, stone) => {
    const qty = Number(stoneQuantities[stone._id] || 0);
    const price = Number(stonePrices[stone._id] || 0);
    return sum + (qty * price);
  }, 0);

  if (loading) {
    return (
      <div className="cpo-loading-container">
        <div className="cpo-spinner" />
        <p>Loading marked stones...</p>
      </div>
    );
  }

  return (
    <div className="cpo-container">
      {/* Header */}
      <div className="cpo-header">
        <div className="cpo-header-left">
          <div className="cpo-title-row">
            <h1>
              <ShoppingCart className="cpo-header-icon" />
              Create Purchase Order
            </h1>
            <button
              className="cpo-refresh-btn"
              onClick={() => fetchMarkedStones(true)}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="cpo-spin" /> : <RefreshCw />}
              Refresh
            </button>
          </div>
          <p className="cpo-subtitle">
            Select stones marked for purchase order and create a new PO
          </p>
        </div>
        {selectedStoneIds.size > 0 && (
          <button className="cpo-create-btn" onClick={() => setCreateModal(true)}>
            <Plus />
            Create Purchase Order ({selectedStoneIds.size})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="cpo-stats">
        <div className="cpo-stat-card">
          <Package className="cpo-stat-icon" />
          <div>
            <h3>{markedStones.length}</h3>
            <p>Marked for PO</p>
          </div>
        </div>
        <div className="cpo-stat-card">
          <CheckCircle2 className="cpo-stat-icon selected" />
          <div>
            <h3>{selectedStoneIds.size}</h3>
            <p>Selected</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="cpo-search-bar">
        <Search className="cpo-search-icon" />
        <input
          type="text"
          className="cpo-search-input"
          placeholder="Search stones..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Stones List */}
      <div className="cpo-stones-container">
        {filteredStones.length === 0 ? (
          <div className="cpo-empty-state">
            <Package className="cpo-empty-icon" />
            <p className="cpo-empty-title">No stones marked for purchase order</p>
            <p className="cpo-empty-sub">Mark stones from the Inventory Forecasting page</p>
          </div>
        ) : (
          <>
            <div className="cpo-list-header">
              <label className="cpo-select-all">
                <input
                  type="checkbox"
                  checked={selectedStoneIds.size === filteredStones.length && filteredStones.length > 0}
                  onChange={handleSelectAll}
                />
                <span>Select All ({filteredStones.length})</span>
              </label>
            </div>

            <div className="cpo-stones-grid">
              {filteredStones.map((stone) => {
                const isSelected = selectedStoneIds.has(stone._id);
                return (
                  <div
                    key={stone._id}
                    className={`cpo-stone-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleStoneSelection(stone._id)}
                  >
                    <div className="cpo-stone-checkbox">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleStoneSelection(stone._id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="cpo-stone-content">
                      <h3 className="cpo-stone-name">{stone.stoneName}</h3>
                      <div className="cpo-stone-badges">
                        <span className={`cpo-cat-badge ${stone.category === 'Marble' ? 'marble' : 'granite'}`}>
                          {stone.category}
                        </span>
                        <span className="cpo-sub-badge">{stone.subcategory}</span>
                      </div>
                      {(stone.dynamic_reorder_point || stone.suggested_po_quantity) && (
                        <div className="cpo-suggested-qty">
                          Suggested: {Math.ceil(stone.suggested_po_quantity || stone.dynamic_reorder_point)} Tons
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Create PO Modal */}
      {createModal && (
        <div className="cpo-modal-overlay" role="dialog" aria-modal="true">
          <div className="cpo-modal" role="document">
            <div className="cpo-modal-header">
              <h3>Create Purchase Order</h3>
              <button className="cpo-modal-close" onClick={() => setCreateModal(false)}>
                <X />
              </button>
            </div>

            <div className="cpo-modal-body">
              {/* Supplier Info */}
              <div className="cpo-form-section">
                <h4><MapPin className="cpo-section-icon" /> Supplier Information</h4>
                <div className="cpo-form-group">
                  <label>Supplier Name *</label>
                  <input
                    type="text"
                    className="cpo-form-input"
                    placeholder="e.g., Chitral Quarry Alpha"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    required
                  />
                </div>
                <div className="cpo-form-row">
                  <div className="cpo-form-group">
                    <label>Expected Delivery Date</label>
                    <input
                      type="date"
                      className="cpo-form-input"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="cpo-form-group">
                  <label>Notes</label>
                  <textarea
                    className="cpo-form-input"
                    rows="3"
                    placeholder="Phone call notes, agreed terms, etc."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Selected Stones */}
              <div className="cpo-form-section">
                <h4><Layers className="cpo-section-icon" /> Selected Stones ({selectedStones.length})</h4>
                <div className="cpo-stones-list">
                  {selectedStones.map((stone) => (
                    <div key={stone._id} className="cpo-stone-item">
                      <div className="cpo-stone-item-header">
                        <div>
                          <h5>{stone.stoneName}</h5>
                          <div className="cpo-stone-item-badges">
                            <span className={`cpo-cat-badge ${stone.category === 'Marble' ? 'marble' : 'granite'}`}>
                              {stone.category}
                            </span>
                            <span className="cpo-sub-badge">{stone.subcategory}</span>
                          </div>
                          {(stone.dynamic_reorder_point || stone.suggested_po_quantity) && (
                            <p className="cpo-suggested-text">
                              Suggested: {Math.ceil(stone.suggested_po_quantity || stone.dynamic_reorder_point)} Tons
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="cpo-stone-item-fields">
                        <div className="cpo-form-group">
                          <label>Quantity (Tons) *</label>
                          <input
                            type="number"
                            className="cpo-form-input"
                            placeholder="Enter quantity"
                            value={stoneQuantities[stone._id] || ''}
                            onChange={(e) =>
                              setStoneQuantities((prev) => ({
                                ...prev,
                                [stone._id]: e.target.value
                              }))
                            }
                            min="1"
                            required
                          />
                        </div>
                        <div className="cpo-form-group">
                          <label>Price per Ton (Rs) *</label>
                          <input
                            type="number"
                            className="cpo-form-input"
                            placeholder="Enter price"
                            value={stonePrices[stone._id] || ''}
                            onChange={(e) =>
                              setStonePrices((prev) => ({
                                ...prev,
                                [stone._id]: e.target.value
                              }))
                            }
                            min="1"
                            required
                          />
                        </div>
                        <div className="cpo-stone-item-total">
                          <DollarSign className="cpo-total-icon" />
                          <span className="cpo-total-label">Subtotal:</span>
                          <span className="cpo-total-value">
                            {stoneQuantities[stone._id] && stonePrices[stone._id]
                              ? formatCurrency(Number(stoneQuantities[stone._id]) * Number(stonePrices[stone._id]))
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="cpo-total-section">
                <div className="cpo-total-row">
                  <span className="cpo-total-label-lg">Total Cost:</span>
                  <span className="cpo-total-value-lg">{formatCurrency(totalCost)}</span>
                </div>
              </div>
            </div>

            <div className="cpo-modal-footer">
              <button
                type="button"
                className="cpo-btn-secondary"
                onClick={() => setCreateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cpo-btn-primary"
                onClick={handleCreatePO}
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="cpo-spin" /> Creating...
                  </>
                ) : (
                  <>
                    <Plus /> Create Purchase Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePurchaseOrder;
