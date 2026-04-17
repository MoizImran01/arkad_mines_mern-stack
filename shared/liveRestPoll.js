/**
 * Shared REST polling interval for live-ish UI on serverless (no WebSockets).
 * Used by notifications and catalog so behavior stays aligned.
 */
export const LIVE_REST_POLL_INTERVAL_MS = 15 * 1000;
