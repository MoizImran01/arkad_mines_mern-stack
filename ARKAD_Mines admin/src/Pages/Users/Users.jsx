import React, { useState, useEffect, useContext } from 'react'
import './Users.css'
import { toast } from 'react-toastify';
import axios from 'axios'
import { AdminAuthContext } from '../../context/AdminAuthContext'
import { FiUser, FiMail, FiBriefcase, FiTrash2, FiShield } from 'react-icons/fi'

const Users = () => {

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { token, url, adminUser } = useContext(AdminAuthContext);

  //Function to fetch all users from the backend API
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

  // Function to update user role
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

  //Function to delete a user
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

  // Get role badge color
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
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-users">
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
                    <td className="user-date">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="user-actions">
                      <button
                        className="delete-btn"
                        onClick={() => deleteUser(user._id, user.companyName)}
                        disabled={isCurrentUser}
                        title={isCurrentUser ? "You cannot delete your own account" : "Delete user"}
                      >
                        <FiTrash2 />
                      </button>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Users;

