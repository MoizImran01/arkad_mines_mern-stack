import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export const formatTime = (date) => {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const useNotifications = (token, apiBase) => {
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [refreshingNotifications, setRefreshingNotifications] = useState(false);
  const panelRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const authHeaders = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

  const fetchNotifications = async (isRefresh = false) => {
    if (!token) return;
    try {
      if (isRefresh) setRefreshingNotifications(true);
      else setLoadingNotifications(true);
      const response = await axios.get(`${apiBase}/api/notifications`, authHeaders);
      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      }
    } catch (error) {
      console.error("Notification fetch error:", error);
    } finally {
      setLoadingNotifications(false);
      setRefreshingNotifications(false);
    }
  };

  const clearNotifications = async (onSuccess) => {
    if (!token) return;
    try {
      const response = await axios.post(`${apiBase}/api/notifications/clear`, {}, authHeaders);
      if (response.data.success) {
        setNotifications([]);
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error("Clear notifications error:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return {
    notifications, setNotifications,
    loadingNotifications, refreshingNotifications,
    showNotifications, setShowNotifications,
    panelRef,
    fetchNotifications, clearNotifications,
  };
};

export default useNotifications;
