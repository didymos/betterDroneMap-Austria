// fetch mit Timeout, Abbruch und optionalem Proxy-Fallback (CORS-Problem staatlicher Server).
import { config } from './config.js';

const TIMEOUT_MS = 20000;

export function proxied(url) {
  return `${config.proxy.url}?url=${encodeURIComponent(url)}`;
}

async function fetchOnce(url, signal) {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

export async function fetchJSON(url, { signal } = {}) {
  const { mode } = config.proxy;
  if (mode === 'always') return (await fetchOnce(proxied(url), signal)).json();
  try {
    return await (await fetchOnce(url, signal)).json();
  } catch (err) {
    if (signal?.aborted) throw err;
    // CORS-Fehler erscheinen im Browser als TypeError ("Failed to fetch").
    if (mode === 'fallback' && err instanceof TypeError) {
      return (await fetchOnce(proxied(url), signal)).json();
    }
    throw err;
  }
}

// Für MapLibre-Rasterkacheln: nur im Modus "always" über den Proxy.
export function transformRequest(url) {
  if (config.proxy.mode !== 'always') return { url };
  const hosts = config.proxy.tileHosts;
  try {
    const u = new URL(url);
    if (hosts.includes(u.hostname)) return { url: new URL(proxied(url), location.href).href };
  } catch { /* relative URL */ }
  return { url };
}
