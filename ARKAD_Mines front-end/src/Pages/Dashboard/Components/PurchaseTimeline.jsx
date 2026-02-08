import React, { useState, useMemo } from 'react';
import '../Dashboard.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PurchaseTimeline = ({ orders }) => {
  const yearOptions = useMemo(() => {
    if (!orders?.length) return [];
    const years = new Set();
    orders.forEach((o) => {
      const d = new Date(o.createdAt);
      if (!isNaN(d.getTime())) years.add(d.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [orders]);

  const defaultYear = yearOptions[0] ?? new Date().getFullYear();
  const defaultMonth = useMemo(() => {
    if (!orders?.length) return new Date().getMonth() + 1;
    const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const d = new Date(sorted[0].createdAt);
    return d.getMonth() + 1;
  }, [orders]);

  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const currentMonth = selectedMonth !== '' ? Number(selectedMonth) : defaultMonth;
  const currentYear = selectedYear !== '' ? Number(selectedYear) : defaultYear;

  const ordersInMonth = useMemo(() => {
    if (!orders?.length) return [];
    return orders
      .filter((o) => {
        const d = new Date(o.createdAt);
        return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [orders, currentMonth, currentYear]);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const formatMoney = (n) =>
    n != null ? Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

  if (!orders?.length || yearOptions.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 dashboard-compact-card">
      <div className="dashboard-compact-header">
        <div>
          <h2 className="dashboard-compact-title">Purchase timeline</h2>
          <p className="dashboard-compact-subtitle">View orders by month and year</p>
        </div>
        <div className="purchase-timeline-dropdown-wrap">
          <label htmlFor="purchase-timeline-month" className="sr-only">
            Select month
          </label>
          <select
            id="purchase-timeline-month"
            className="purchase-timeline-select"
            value={currentMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Select month"
          >
            {MONTHS.map((name, i) => (
              <option key={i} value={i + 1}>
                {name}
              </option>
            ))}
          </select>
          <label htmlFor="purchase-timeline-year" className="sr-only">
            Select year
          </label>
          <select
            id="purchase-timeline-year"
            className="purchase-timeline-select"
            value={currentYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            aria-label="Select year"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="dashboard-table-wrap purchase-timeline-table-wrap">
        {ordersInMonth.length > 0 ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {ordersInMonth.map((order) => (
                <tr key={order._id}>
                  <td>{order.orderNumber}</td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    <span className={`dashboard-badge status-${order.status}`}>{order.status}</span>
                  </td>
                  <td>
                    <span className={`dashboard-badge payment-${order.paymentStatus}`}>
                      {order.paymentStatus || '—'}
                    </span>
                  </td>
                  <td>{formatMoney(order.financials?.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="purchase-timeline-empty">
            No orders in this month.
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseTimeline;
