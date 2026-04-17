/** Direct callbacks from Socket.IO → React (avoids relying only on window CustomEvents). */

const channels = {
  stones: new Set(),
  quotations: new Set(),
  orders: new Set(),
  notifications: new Set(),
};

/**
 * @param {"stones"|"quotations"|"orders"|"notifications"} channel
 * @param {() => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribeLive(channel, fn) {
  const set = channels[channel];
  if (!set || typeof fn !== "function") return () => {};
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

export function fireLive(channel) {
  const set = channels[channel];
  if (!set) return;
  set.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn("[subscribeLive]", channel, e?.message || e);
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("arkad:live", { detail: { channel } }));
  }
}
