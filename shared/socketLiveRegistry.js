/**
 * Live refetch registry: one global store per browser tab so Vite never
 * instantiates duplicate module state for Bridge vs pages.
 */

const REGISTRY_KEY = "__arkadLiveRegistry_v2";

const emptyRegistry = () => ({
  stones: new Set(),
  quotations: new Set(),
  orders: new Set(),
  notifications: new Set(),
});

function getRegistry() {
  try {
    const g = typeof globalThis !== "undefined" ? globalThis : null;
    if (g) {
      if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = emptyRegistry();
      return g[REGISTRY_KEY];
    }
  } catch {
    /* ignore */
  }
  return emptyRegistry();
}

/**
 * @param {"stones"|"quotations"|"orders"|"notifications"} channel
 * @param {() => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribeLive(channel, fn) {
  const channels = getRegistry();
  const set = channels[channel];
  if (!set || typeof fn !== "function") return () => {};
  set.add(fn);
  return () => {
    set.delete(fn);
  };
}

export function fireLive(channel) {
  const channels = getRegistry();
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
