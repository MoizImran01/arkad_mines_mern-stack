import React, { useState, useEffect, useContext } from 'react'
import './Users.css'
import { toast } from 'react-toastify';
import axios from 'axios'
import { AdminAuthContext } from '../../context/AdminAuthContext'
import { FiUser, FiMail, FiBriefcase, FiTrash2, FiShield, FiClock, FiFileText, FiPackage, FiDownload, FiX } from 'react-icons/fi'

const Users = () => {

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyModalUserId, setHistoryModalUserId] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const { token, url, adminUser } = useContext(AdminAuthContext);

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

    if (!window.confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`)) {
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

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin':
        return 'role-admin';
      case 'employee':
        return 'role-employee';
      case 'customer':
        return 'role-customer';
      default:
        return '';
    }
  };


  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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


      <div className="users-table-container">
        <div className="table-responsive">
          <table className="users-table">
            <thead>
              <tr>
                <th>Company Name</th>
                <th>Email</th>
                {adminUser?.role === 'admin' && <th>Role</th>}
                {adminUser?.role === 'admin' && <th>Created</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={adminUser?.role === 'admin' ? 5 : 3} className="no-users">
                    <div className="empty-state">
                      <FiUser className="empty-icon" />
                      <p>No users found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(user => {
                  const isCurrentUser = user._id === adminUser?.id || String(user._id) === String(adminUser?.id);
                  return (
                  <tr key={user._id} className={isCurrentUser ? 'current-user' : ''}>
                    <td className="company-name">
                      <FiBriefcase className="info-icon" />
                      {user.companyName}
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
                    <td className="user-actions">
                      <button
                        className="history-btn"
                        onClick={() => openHistoryModal(user._id)}
                        title="View customer history"
                      >
                        <FiClock />
                      </button>
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
      </div>

      {/* Customer History Modal */}
      {historyModalUserId && (
        <div className="history-modal-overlay" onClick={closeHistoryModal}>
          <div className="history-modal" onClick={e => e.stopPropagation()}>
            <div className="history-modal-header">
              <h2><FiClock /> Customer History</h2>
              <button type="button" className="history-modal-close" onClick={closeHistoryModal} aria-label="Close">
                <FiX />
              </button>
            </div>
            <div className="history-modal-body">
              {historyLoading ? (
                <div className="history-modal-loading">
                  <div className="spinner" />
                  <p>Loading...</p>
                </div>
              ) : historyData ? (
                <>
                  <div className="history-section">
                    <h3><FiUser /> Contact</h3>
                    <div className="history-contact">
                      <p><strong>Company:</strong> {historyData.contact?.companyName || '—'}</p>
                      <p><strong>Email:</strong> {historyData.contact?.email || '—'}</p>
                      <p><strong>Role:</strong> {historyData.contact?.role || '—'}</p>
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
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;

