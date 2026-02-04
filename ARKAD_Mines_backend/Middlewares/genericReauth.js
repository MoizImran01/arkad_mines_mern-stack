import bcrypt from "bcrypt";
import userModel from "../Models/Users/userModel.js";
import { logAudit, getClientIp, normalizeRole, getUserAgent } from "../logger/auditLogger.js";
import mongoose from "mongoose";

export const createReauthMiddleware = ({
  actionName = 'REAUTH',
  actionType = 'REAUTH_REQUIRED',
  passwordField = 'passwordConfirmation',
  responseFlag = 'requiresReauth',
  getResourceId = (req) => null,
  getAdditionalContext = (req) => ({})
}) => {
  return async (req, res, next) => {
    const clientIp = getClientIp(req);
    const userAgent = getUserAgent(req);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    try {
      const passwordConfirmation = req.method === 'GET'
        ? (req.query[passwordField] || req.body?.[passwordField])
        : req.body[passwordField];

      if (!passwordConfirmation) {
        await logAudit({
          userId,
          role: normalizeRole(req.user?.role),
          action: actionName,
          status: 'FAILED_AUTH',
          resourceId: getResourceId(req),
          clientIp,
          userAgent,
          requestPayload: {
            method: req.method,
            path: req.path,
            ...getAdditionalContext(req)
          },
          details: `Re-authentication required for ${actionName}. Password not provided.`
        });

        return res.status(401).json({
          success: false,
          [responseFlag]: true,
          message: "Re-authentication required. Please provide your password to confirm this action."
        });
      }

      // Sanitize and validate userId to prevent NoSQL injection
      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        await logAudit({
          userId: null,
          role: normalizeRole(req.user?.role),
          action: actionName,
          status: 'FAILED_AUTH',
          resourceId: getResourceId(req),
          clientIp,
          userAgent,
          details: `Invalid user ID format: ${userId}`
        });
        return res.status(400).json({
          success: false,
          message: "Invalid user ID"
        });
      }
      const safeUserId = String(userId).trim();
      
      const user = await userModel.findById(safeUserId).select('password');
      
      if (!user || !user.password) {
        await logAudit({
          userId,
          role: normalizeRole(req.user?.role),
          action: actionName,
          status: 'ERROR',
          resourceId: getResourceId(req),
          clientIp,
          userAgent,
          details: `User not found or password not set for re-authentication`
        });

        return res.status(401).json({
          success: false,
          message: "User authentication error"
        });
      }

      const isMatch = await bcrypt.compare(passwordConfirmation, user.password);

      if (!isMatch) {
        await logAudit({
          userId,
          role: normalizeRole(req.user?.role),
          action: actionName,
          status: 'FAILED_AUTH',
          resourceId: getResourceId(req),
          clientIp,
          userAgent,
          requestPayload: {
            method: req.method,
            path: req.path,
            ...getAdditionalContext(req)
          },
          details: `Re-authentication failed: Invalid password provided`
        });

        return res.status(401).json({
          success: false,
          message: "Invalid password. Re-authentication failed."
        });
      }

      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: actionName,
        status: 'SUCCESS',
        resourceId: getResourceId(req),
        clientIp,
        userAgent,
        details: `Re-authentication successful for ${actionName}`
      });

      next();
    } catch (error) {
      await logAudit({
        userId,
        role: normalizeRole(req.user?.role),
        action: actionName,
        status: 'ERROR',
        resourceId: getResourceId(req),
        clientIp,
        userAgent,
        details: `Error during re-authentication: ${error.message}`
      });

      return res.status(500).json({
        success: false,
        message: "Error during re-authentication. Please try again."
      });
    }
  };
};
