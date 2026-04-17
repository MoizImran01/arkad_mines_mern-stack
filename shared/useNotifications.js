import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { subscribeLive } from './socketLiveRegistry.js';
import { LIVE_REST_POLL_INTERVAL_MS } from './liveRestPoll.js';

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

const normalizeFetchArg = (arg) => {
  if (arg === true) return { manual: true, silent: false };
  if (arg && typeof arg === 'object' && arg.silent === true) return { manual: false, silent: true };
  return { manual: false, silent: false };
};

const useNotifications = (token, apiBase, options = {}) => {
  const { pathname } = options;
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [refreshingNotifications, setRefreshingNotifications] = useState(false);
  const panelRef = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const tokenRef = useRef(token);
  const pathHandledRef = useRef(false);

  tokenRef.current = token;

  const fetchNotifications = useCallback(async (arg) => {
    const { manual, silent } = normalizeFetchArg(arg);
    const t = tokenRef.current;
    if (!t) return;
    try {
      if (!silent) {
        if (manual) setRefreshingNotifications(true);
        else setLoadingNotifications(true);
      }
      const response = await axios.get(`${apiBase}/api/notifications`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (response.data.success) {
        setNotifications(response.data.notifications || []);
      }
    } catch (error) {
      console.error("Notification fetch error:", error);
    } finally {
      if (!silent) {
        setLoadingNotifications(false);
        setRefreshingNotifications(false);
      }
    }
  }, [apiBase]);

  const clearNotifications = async (onSuccess) => {
    const t = tokenRef.current;
    if (!t) return;
    try {
      const response = await axios.post(
        `${apiBase}/api/notifications/clear`,
        {},
        { headers: { Authorization: `Bearer ${t}` } }
      );
      if (response.data.success) {
        setNotifications([]);
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error("Clear notifications error:", error);
    }
  };

  useEffect(() => {
    if (!token) {
      pathHandledRef.current = false;
      setNotifications([]);
      return;
    }
    fetchNotifications();
  }, [token, fetchNotifications]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      if (!tokenRef.current) return;
      fetchNotifications({ silent: true });
    }, LIVE_REST_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [token, fetchNotifications]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && tokenRef.current) {
        fetchNotifications({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchNotifications]);

  useEffect(() => {
    const onFocus = () => {
      if (tokenRef.current) fetchNotifications({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchNotifications]);

  useEffect(() => {
    if (pathname === undefined || !token) return;
    if (!pathHandledRef.current) {
      pathHandledRef.current = true;
      return;
    }
    fetchNotifications({ silent: true });
  }, [pathname, token, fetchNotifications]);

  useEffect(() => {
    if (token && showNotifications) {
      fetchNotifications({ silent: true });
    }
  }, [showNotifications, token, fetchNotifications]);

  useEffect(() => {
    return subscribeLive("notifications", () => {
      if (tokenRef.current) fetchNotifications({ silent: true });
    });
  }, [fetchNotifications]);

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
