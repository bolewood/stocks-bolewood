// Client-only: keep Yahoo-backed JSON fresh in a tab left open overnight.
// Matches the 60s CDN TTL. fetch cache: "no-store" so the browser cannot
// reuse a Cache-Control: public response from a previous session.

export const PRICE_CLIENT_POLL_MS = 60_000;

export function startJsonPoll(
  url,
  { onData, onError, intervalMs = PRICE_CLIENT_POLL_MS } = {}
) {
  let cancelled = false;
  const load = () => {
    fetch(url, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`poll ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) onData?.(data);
      })
      .catch((err) => {
        if (!cancelled) onError?.(err);
      });
  };
  load();
  const id = setInterval(load, intervalMs);
  const onVis = () => {
    if (document.visibilityState === "visible") load();
  };
  document.addEventListener("visibilitychange", onVis);
  return () => {
    cancelled = true;
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVis);
  };
}
