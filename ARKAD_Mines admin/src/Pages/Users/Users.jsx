import React, { useState, useEffect, useContext } from 'react'
import './Users.css'
import { toast } from 'react-toastify';
import axios from 'axios'
import { AdminAuthContext } from '../../context/AdminAuthContext'
import { FiUser, FiMail, FiBriefcase, FiTrash2, FiShield, FiClock, FiFileText, FiPackage, FiDownload, FiX } from 'react-icons/fi'

const getRoleBadgeColor = (role) => {
  switch (role) {
    case 'admin': return 'role-admin';
    case 'employee': return 'role-employee';
    case 'customer': return 'role-customer';
    default: return '';
  }
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyModalUserId, setHistoryModalUserId] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const { token, url, adminUser } = useContext(AdminAuthContext);

  const visibleUsers = users.filter((user) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      user.companyName?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.role?.toLowerCase().includes(q)
    );
  });
  const totalItems = visibleUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageEnd = pageStart + ITEMS_PER_PAGE;
  const paginatedUsers = visibleUsers.slice(pageStart, pageEnd);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${url}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        setUsers(response.data.users);
      } else {
        toast.error("Error fetching users");
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Error fetching users");
    } finally {
      setLoading(false);
    }
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      const response = await axios.put(
        `${url}/api/users/${userId}/role`,
        { role: newRole },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success(`User role updated to ${newRole}`);

        await fetchUsers();
      } else {
        toast.error(response.data.message || "Failed to update user role");
      }
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error(error.response?.data?.message || "Error updating user role");
    }
  };

  const deleteUser = async (userId, userName) => {

    if (!globalThis.confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await axios.delete(`${url}/api/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success) {
        toast.success("User deleted successfully");

        await fetchUsers();
      } else {
        toast.error(response.data.message || "Failed to delete user");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error.response?.data?.message || "Error deleting user");
    }
  };

  const openHistoryModal = async (userId) => {
    setHistoryModalUserId(userId);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${url}/api/customers/${userId}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success && res.data.data) {
        setHistoryData(res.data.data);
      } else {
        toast.info(res.data.message || 'No record');
        setHistoryModalUserId(null);
      }
    } catch (err) {
      toast.info(err.response?.data?.message || 'No record');
      setHistoryModalUserId(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setHistoryModalUserId(null);
    setHistoryData(null);
  };

  const exportHistoryPdf = async () => {
    if (!historyModalUserId) return;
    setExportingPdf(true);
    try {
      const res = await axios.get(`${url}/api/customers/${historyModalUserId}/history/export`, {
        params: { format: 'pdf' },
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `customer-history-${historyModalUserId}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Export failed');
    } finally {
      setExportingPdf(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, users.length]);

  if (loading) {
    return (
      <div className="users-loading">
        <div className="spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className='users-container'>
      <div className="users-header">
        <h1><FiUser className="header-icon" /> User Management</h1>
        <p>Manage all users, roles, and permissions</p>
      </div>

      {/* Statistics Cards */}
      <div className="users-stats">
        <div className="stat-card">
          <div className="stat-icon total">
            <FiUser />
          </div>
          <div className="stat-info">
            <h3>{users.length}</h3>
            <p>Total Users</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon admin">
            <FiShield />
          </div>
          <div className="stat-info">
            <h3>{users.filter(u => u.role === 'admin').length}</h3>
            <p>Administrators</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon employee">
            <FiBriefcase />
          </div>
          <div className="stat-info">
            <h3>{users.filter(u => u.role === 'employee').length}</h3>
            <p>Employees</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon customer">
            <FiUser />
          </div>
          <div className="stat-info">
            <h3>{users.filter(u => u.role === 'customer').length}</h3>
            <p>Customers</p>
          </div>
        </div>
      </div>

      <div className="users-search-row">
        <input
          type="text"
          placeholder="Search users by company, email or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="users-search-input"
        />
      </div>


      <div className="users-table-container">
        <div className="table-responsive">
          <table className="users-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Company Name</th>
                <th>Email</th>
                {adminUser?.role === 'admin' && <th>Role</th>}
                {adminUser?.role === 'admin' && <th>Created</th>}
                <th>Customer History</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={adminUser?.role === 'admin' ? 7 : 5} className="no-users">
                    <div className="empty-state">
                      <FiUser className="empty-icon" />
                      <p>No users found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, index) => {
                  const isCurrentUser = user._id === adminUser?.id || String(user._id) === String(adminUser?.id);
                  const normalizedCompanyName = (user.companyName || '').trim();
                  const companyDisplay =
                    !normalizedCompanyName || normalizedCompanyName.toLowerCase() === 'company'
                      ? ''
                      : normalizedCompanyName;
                  return (
                  <tr key={user._id} className={isCurrentUser ? 'current-user' : ''}>
                    <td className="user-index">{pageStart + index + 1}</td>
                    <td className="company-name">
                      {companyDisplay ? (
                        <>
                          <FiBriefcase className="info-icon" />
                          {companyDisplay}
                        </>
                      ) : '—'}
                    </td>
                    <td className="user-email">
                      <FiMail className="info-icon" />
                      {user.email}
                    </td>
                    {adminUser?.role === 'admin' && (
                      <td className="user-role">
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user._id, e.target.value)}
                          className={`role-select ${getRoleBadgeColor(user.role)}`}
                          disabled={isCurrentUser}
                          title={isCurrentUser ? "You cannot change your own role" : ""}
                        >
                          <option value="customer">Customer</option>
                          <option value="employee">Employee</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    )}
                    {adminUser?.role === 'admin' && (
                      <td className="user-date">
                        {formatDate(user.createdAt)}
                      </td>
                    )}
                    <td className="history-cell">
                      <button
                        className="history-btn"
                        onClick={() => openHistoryModal(user._id)}
                        title="View customer history"
                      >
                        <FiClock />
                      </button>
                    </td>
                    <td className="user-actions">
                      {adminUser?.role === 'admin' && (
                        <button
                          className="delete-btn"
                          onClick={() => deleteUser(user._id, user.companyName)}
                          disabled={isCurrentUser}
                          title={isCurrentUser ? "You cannot delete your own account" : "Delete user"}
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="universal-pagination">
          <div className="pagination-info">
            <span>
              Showing {totalItems === 0 ? 0 : pageStart + 1} - {Math.min(pageEnd, totalItems)} of {totalItems} users
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

      {/* Customer History Modal */}
      {historyModalUserId && (
        <dialog open className="history-modal-overlay">
          <button type="button" className="history-modal-backdrop" onClick={closeHistoryModal} aria-label="Close" />
          <div className="history-modal">
            <div className="history-modal-header">
              <h2><FiClock /> Customer History</h2>
              <button type="button" className="history-modal-close" onClick={closeHistoryModal} aria-label="Close">
                <FiX />
              </button>
            </div>
            <div className="history-modal-body">
              {historyLoading && (
                <div className="history-modal-loading">
                  <div className="spinner" />
                  <p>Loading...</p>
                </div>
              )}
              {!historyLoading && historyData && (
                <>
                  <div className="history-section">
                    <h3><FiUser /> Contact</h3>
                    <div className="history-contact">
                      <p><strong>Company:</strong> {historyData.contact?.companyName ?? '—'}</p>
                      <p><strong>Email:</strong> {historyData.contact?.email ?? '—'}</p>
                      <p><strong>Role:</strong> {historyData.contact?.role ?? '—'}</p>
                    </div>
                  </div>
                  <div className="history-section">
                    <h3><FiFileText /> Quotes</h3>
                    {historyData.quotes?.length > 0 ? (
                      <div className="history-table-wrap">
                        <table className="history-inline-table">
                          <thead>
                            <tr>
                              <th>Reference</th>
                              <th>Status</th>
                              <th>Total</th>
                              <th>Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyData.quotes.map(q => (
                              <tr key={q.id}>
                                <td>{q.referenceNumber}</td>
                                <td>{q.status}</td>
                                <td>{Number(q.totalEstimatedCost).toFixed(2)}</td>
                                <td>{formatDate(q.createdAt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="history-empty">No quotes</p>
                    )}
                  </div>
                  <div className="history-section">
                    <h3><FiPackage /> Orders</h3>
                    {historyData.orders?.length > 0 ? (
                      <div className="history-table-wrap">
                        <table className="history-inline-table">
                          <thead>
                            <tr>
                              <th>Order No</th>
                              <th>Status</th>
                              <th>Payment</th>
                              <th>Total</th>
                              <th>Created</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyData.orders.map(o => (
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
                      <p className="history-empty">No orders</p>
                    )}
                  </div>
                  <div className="history-modal-footer">
                    <button type="button" className="export-pdf-btn" onClick={exportHistoryPdf} disabled={exportingPdf}>
                      <FiDownload /> {exportingPdf ? 'Exporting...' : 'Export as PDF'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}

export default Users;

