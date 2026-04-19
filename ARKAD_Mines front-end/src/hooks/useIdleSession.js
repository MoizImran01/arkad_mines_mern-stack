import { useEffect, useRef, useCallback } from "react";

const IDLE_MS = 60 * 60 * 1000;
const CHECK_MS = 30 * 1000;
const BUMP_THROTTLE_MS = 5000;

/** Calls onIdleLogout after one hour without recorded activity while token is set. */
export function useIdleSession(token, onIdleLogout) {
  const lastBumpRef = useRef(0);

  /** Records user activity and refreshes the idle timestamp in sessionStorage. */
  const bumpActivity = useCallback(() => {
    if (!token) return;
    const now = Date.now();
    if (now - lastBumpRef.current < BUMP_THROTTLE_MS) return;
    lastBumpRef.current = now;
    try {
      sessionStorage.setItem("arkad_last_activity", String(now));
    } catch {
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const now = Date.now();
    lastBumpRef.current = now;
    try {
      sessionStorage.setItem("arkad_last_activity", String(now));
    } catch {
    }

    const onAct = () => bumpActivity();
    const events = ["mousedown", "keydown", "scroll", "touchstart", "click", "mousemove"];
    events.forEach((ev) => {
      window.addEventListener(ev, onAct, { passive: true });
    });

    const timer = setInterval(() => {
      let last = lastBumpRef.current;
      try {
        const s = sessionStorage.getItem("arkad_last_activity");
        if (s) {
          const parsed = parseInt(s, 10);
          if (!Number.isNaN(parsed)) last = Math.max(last, parsed);
        }
      } catch {
      }
      if (Date.now() - last > IDLE_MS) {
        onIdleLogout();
      }
    }, CHECK_MS);

    return () => {
      clearInterval(timer);
      events.forEach((ev) => {
        window.removeEventListener(ev, onAct);
      });
    };
  }, [token, bumpActivity, onIdleLogout]);
}
