// Minimaler CORS-Proxy für staatliche WFS/WMS/ArcGIS-Endpoints. Keine Abhängigkeiten.
//   GET /proxy?url=<https-url>   (nur Hosts aus PROXY_ALLOW_HOSTS)
//   SERVE_STATIC=1 liefert zusätzlich dist/ aus.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 20000;
const CACHE_TTL_MS = 60000;
const CACHE_MAX = 100;
const cache = new Map();

export function parseAllowList(str) {
  return (str || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Exakter Host oder Subdomain eines Eintrags; nur https; keine Credentials im URL.
export function isAllowed(rawUrl, allow) {
  let u;
  try { u = new URL(rawUrl); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (u.port && u.port !== '443') return false;
  const host = u.hostname.toLowerCase();
  return allow.some((a) => host === a || host.endsWith(`.${a}`));
}

async function readCapped(res) {
  const chunks = [];
  let n = 0;
  for await (const c of res.body) {
    n += c.length;
    if (n > MAX_BYTES) throw new Error('Antwort zu groß');
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

async function handleProxy(req, res, target, allow, origin) {
  const cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  if (!isAllowed(target, allow)) {
    res.writeHead(403, cors).end('Host nicht erlaubt');
    return;
  }
  const hit = cache.get(target);
  if (hit && hit.exp > Date.now()) {
    res.writeHead(200, { ...cors, 'Content-Type': hit.type, 'X-Cache': 'HIT' }).end(hit.body);
    return;
  }
  try {
    const up = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'betterDroneMap-Austria-proxy' } });
    if (up.status >= 300 && up.status < 400) {
      res.writeHead(502, cors).end('Redirects werden nicht gefolgt');
      return;
    }
    const body = await readCapped(up);
    const type = up.headers.get('content-type') || 'application/octet-stream';
    if (up.ok) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(target, { body, type, exp: Date.now() + CACHE_TTL_MS });
    }
    res.writeHead(up.status, { ...cors, 'Content-Type': type, 'X-Cache': 'MISS' }).end(body);
  } catch (err) {
    res.writeHead(502, cors).end(`Upstream-Fehler: ${err.message}`);
  }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

async function handleStatic(req, res, pathname, root) {
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, rel === '/' ? 'index.html' : rel);
  if (file !== root && !file.startsWith(root + sep)) return void res.writeHead(403).end();
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' }).end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

export function createServer({ allow, origin = '*', staticRoot } = {}) {
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    if (u.pathname === '/proxy' && req.method === 'GET') {
      return handleProxy(req, res, u.searchParams.get('url') || '', allow, origin);
    }
    if (staticRoot && req.method === 'GET') return handleStatic(req, res, u.pathname, staticRoot);
    res.writeHead(404).end('Not found');
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const allow = parseAllowList(process.env.PROXY_ALLOW_HOSTS);
  if (!allow.length) console.warn('PROXY_ALLOW_HOSTS leer: alle Anfragen werden mit 403 abgelehnt.');
  const staticRoot = process.env.SERVE_STATIC ? fileURLToPath(new URL('../dist', import.meta.url)) : undefined;
  const port = Number(process.env.PORT) || 8787;
  createServer({ allow, origin: process.env.ALLOW_ORIGIN || '*', staticRoot }).listen(port, () =>
    console.log(`proxy :${port} allow=[${allow}]${staticRoot ? ' static=dist' : ''}`));
}
