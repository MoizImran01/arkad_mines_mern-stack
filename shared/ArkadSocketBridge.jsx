import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { fireLive } from "./socketLiveRegistry.js";

/**
 * Connects to the API Socket.IO server when `token` is set.
 * Forwards server events to subscribeLive() + window "arkad:live" for legacy listeners.
 *
 * Without a token the socket does not run; a light interval still nudges catalog
 * subscribers (guests) so pages can refetch when admins change inventory.
 */
export function ArkadSocketBridge({ apiBaseUrl, token }) {
  const socketRef = useRef(null);
  const fallbackRef = useRef(null);
  const connectWatchRef = useRef(null);

  useEffect(() => {
    const t = token != null ? String(token).trim() : "";
    if (!t) {
      const guestNudge = setInterval(() => {
        fireLive("stones");
      }, 6000);
      return () => clearInterval(guestNudge);
    }
    return undefined;
  }, [token]);

  useEffect(() => {
    const raw = apiBaseUrl != null ? String(apiBaseUrl).trim() : "";
    const base =
      raw && (raw.startsWith("http://") || raw.startsWith("https://"))
        ? raw.replace(/\/$/, "")
        : "http://localhost:4000";

    if (!token) {
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        fallbackRef.current = null;
      }
      if (connectWatchRef.current) {
        clearTimeout(connectWatchRef.current);
        connectWatchRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return undefined;
    }

    const startFallback = () => {
      if (fallbackRef.current) return;
      fallbackRef.current = setInterval(() => {
        fireLive("stones");
        fireLive("quotations");
        fireLive("orders");
        fireLive("notifications");
      }, 12000);
    };

    const stopFallback = () => {
      if (fallbackRef.current) {
        clearInterval(fallbackRef.current);
        fallbackRef.current = null;
      }
    };

    const socket = io(base, {
      path: "/socket.io",
      auth: { token },
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1500,
      timeout: 25000,
      autoConnect: true,
    });
    socketRef.current = socket;

    const forward = (channel) => {
      fireLive(channel);
    };

    socket.on("stones:changed", () => forward("stones"));
    socket.on("quotations:changed", () => forward("quotations"));
    socket.on("orders:changed", () => forward("orders"));
    socket.on("notifications:changed", () => forward("notifications"));

    socket.on("connect", () => {
      stopFallback();
      if (connectWatchRef.current) {
        clearTimeout(connectWatchRef.current);
        connectWatchRef.current = null;
      }
    });

    socket.on("connect_error", (err) => {
      console.warn("[ArkadSocket]", err?.message || err);
      startFallback();
    });

    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") {
        socket.connect();
      }
      startFallback();
    });

    connectWatchRef.current = setTimeout(() => {
      connectWatchRef.current = null;
      if (!socket.connected) {
        console.warn("[ArkadSocket] not connected after timeout; using polling fallback");
        startFallback();
      }
    }, 6000);

    return () => {
      stopFallback();
      if (connectWatchRef.current) {
        clearTimeout(connectWatchRef.current);
        connectWatchRef.current = null;
      }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [apiBaseUrl, token]);

  return null;
}
