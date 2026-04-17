import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { setSocketIO } from "./socketEmitter.js";

/**
 * Attaches Socket.IO to the HTTP server (local / long-running deployments only).
 * Not used on Vercel serverless — emit helpers no-op when IO is unset.
 * @param {(origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void) => void} verifyOrigin Same rules as Express CORS for browser clients.
 */
export function initSocketServer(httpServer, verifyOrigin) {
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: {
      origin: verifyOrigin,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  setSocketIO(io);

  io.use((socket, next) => {
    try {
      const raw = socket.handshake.auth?.token;
      const token = typeof raw === "string" ? raw.trim() : "";
      if (!token) return next(new Error("auth_required"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!decoded?.id) return next(new Error("invalid_token"));
      socket.user = decoded;
      return next();
    } catch (_e) {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { id, role } = socket.user;
    const r = String(role || "").toLowerCase();
    if (r === "admin" || r === "employee") socket.join("staff");
    else socket.join(`user:${String(id)}`);
    socket.join("catalog");
  });

  return io;
}
