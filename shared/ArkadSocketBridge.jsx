import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

/**
 * Connects to the API Socket.IO server when `token` is set.
 * Dispatches `arkad:live` on the window so pages can refetch without tight coupling.
 * @param {{ apiBaseUrl: string, token: string }} props
 */
export function ArkadSocketBridge({ apiBaseUrl, token }) {
  const socketRef = useRef(null);

  useEffect(() => {
    const base =
      apiBaseUrl && String(apiBaseUrl).trim() ? String(apiBaseUrl).replace(/\/$/, "") : "http://localhost:4000";

    if (!token) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return undefined;
    }

    const socket = io(base, {
      path: "/socket.io",
      auth: { token },
      // Polling first: some networks/firewalls block WebSocket upgrade; still upgrades when possible.
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true,
    });
    socketRef.current = socket;

    const forward = (channel) => {
      window.dispatchEvent(new CustomEvent("arkad:live", { detail: { channel } }));
    };

    socket.on("stones:changed", () => forward("stones"));
    socket.on("quotations:changed", () => forward("quotations"));
    socket.on("orders:changed", () => forward("orders"));
    socket.on("notifications:changed", () => forward("notifications"));

    socket.on("connect_error", (err) => {
      console.warn("[ArkadSocket]", err?.message || err);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [apiBaseUrl, token]);

  return null;
}
