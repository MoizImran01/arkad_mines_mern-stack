let ioRef = null;

export const setSocketIO = (io) => {
  ioRef = io;
};

export const getIO = () => ioRef;

const buyerRoom = (buyerId) => `user:${String(buyerId)}`;

const safeEmit = (fn) => {
  try {
    fn();
  } catch (e) {
    console.warn("[socket emit]", e?.message || e);
  }
};

/** All authenticated catalog viewers (buyers + staff). */
export function emitStonesChanged(payload = {}) {
  safeEmit(() => {
    ioRef?.to("catalog").emit("stones:changed", { at: Date.now(), ...payload });
  });
}

export function emitQuotationsChangedForBuyer(buyerId, payload = {}) {
  if (!buyerId || !ioRef) return;
  safeEmit(() => {
    ioRef.to(buyerRoom(buyerId)).emit("quotations:changed", payload);
  });
}

export function emitQuotationsChangedStaff(payload = {}) {
  safeEmit(() => {
    ioRef?.to("staff").emit("quotations:changed", payload);
  });
}

export function emitOrdersChangedForBuyer(buyerId, payload = {}) {
  if (!buyerId || !ioRef) return;
  safeEmit(() => {
    ioRef.to(buyerRoom(buyerId)).emit("orders:changed", payload);
  });
}

export function emitOrdersChangedStaff(payload = {}) {
  safeEmit(() => {
    ioRef?.to("staff").emit("orders:changed", payload);
  });
}

export function emitNotificationsForUser(userId, payload = {}) {
  if (!userId || !ioRef) return;
  safeEmit(() => {
    ioRef.to(buyerRoom(userId)).emit("notifications:changed", payload);
  });
}

export function emitNotificationsForStaff(payload = {}) {
  safeEmit(() => {
    ioRef?.to("staff").emit("notifications:changed", payload);
  });
}
