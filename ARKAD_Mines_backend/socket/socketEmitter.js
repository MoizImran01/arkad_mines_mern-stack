let ioRef = null;

export const setSocketIO = (io) => {
  ioRef = io;
};

export const getIO = () => ioRef;

const safeEmit = (fn) => {
  try {
    fn();
  } catch (e) {
    console.warn("[socket emit]", e?.message || e);
  }
};

const stamp = (payload = {}) => ({ at: Date.now(), ...payload });

/**
 * Catalog / inventory changed — broadcast to every connected authenticated socket.
 */
export function emitStonesChanged(payload = {}) {
  safeEmit(() => {
    if (!ioRef) return;
    ioRef.emit("stones:changed", stamp(payload));
  });
}

/**
 * Quotation updates — broadcast; each client still loads only its own data via JWT on REST.
 */
export function emitQuotationsChangedForBuyer(_buyerId, payload = {}) {
  safeEmit(() => {
    if (!ioRef) return;
    ioRef.emit("quotations:changed", stamp(payload));
  });
}

export function emitQuotationsChangedStaff(payload = {}) {
  safeEmit(() => {
    if (!ioRef) return;
    ioRef.emit("quotations:changed", stamp(payload));
  });
}

/**
 * Order / payment updates — broadcast; REST remains scoped by token.
 */
export function emitOrdersChangedForBuyer(_buyerId, payload = {}) {
  safeEmit(() => {
    if (!ioRef) return;
    ioRef.emit("orders:changed", stamp(payload));
  });
}

export function emitOrdersChangedStaff(payload = {}) {
  safeEmit(() => {
    if (!ioRef) return;
    ioRef.emit("orders:changed", stamp(payload));
  });
}

export function emitNotificationsForUser(_userId, payload = {}) {
  safeEmit(() => {
    if (!ioRef) return;
    ioRef.emit("notifications:changed", stamp(payload));
  });
}

export function emitNotificationsForStaff(payload = {}) {
  safeEmit(() => {
    if (!ioRef) return;
    ioRef.emit("notifications:changed", stamp(payload));
  });
}
