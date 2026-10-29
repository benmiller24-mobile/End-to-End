// Abuse guard for endpoints that spend money on third-party AI APIs
// (Anthropic floorplan vision, Leonardo renders).
//
// These endpoints are intentionally callable without a login (the consumer
// Showroom Atlas site posts to them), so the guard bounds the damage instead:
//   1. Origin allowlist — browsers always send Origin on cross-site POSTs, so
//      another website can't borrow these endpoints from its visitors' browsers.
//   2. Per-IP hourly cap and a site-wide daily cap, counted in Netlify Blobs.
//      This is what stops scripted abuse (curl sends no Origin).
//
// Tunable via env vars (all optional):
//   PAID_API_ALLOWED_ORIGINS   comma-separated, added to the defaults below
//   PAID_API_PER_IP_PER_HOUR   default 30
//   PAID_API_DAILY_LIMIT       default 300
import { getStore } from '@netlify/blobs';

const DEFAULT_ORIGINS = [
  'https://endtoendeclipse.netlify.app',
  'https://showroom-atlas.netlify.app',
  'http://localhost:5173',
  'http://localhost:8888',
];

function allowedOrigins(req) {
  const extra = (process.env.PAID_API_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // The site's own origin (covers deploy previews and custom domains).
  return new Set([...DEFAULT_ORIGINS, ...extra, new URL(req.url).origin]);
}

/** CORS headers echoing the request origin only when it is allowed. */
export function corsFor(req, methods = 'POST, OPTIONS') {
  const origin = req.headers.get('origin');
  const headers = { 'Access-Control-Allow-Methods': methods, 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
  if (origin && allowedOrigins(req).has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function clientIp(req, context) {
  return context?.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Returns null when the call may proceed, or a Response to send back.
 * `name` scopes the counters (e.g. 'floorplan', 'leonardo').
 */
export async function guardPaidCall(req, context, name, extraHeaders = {}) {
  const deny = (status, error) =>
    new Response(JSON.stringify({ error }), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
    });

  const origin = req.headers.get('origin');
  if (origin && !allowedOrigins(req).has(origin)) return deny(403, 'Origin not allowed');

  const perIp = Number(process.env.PAID_API_PER_IP_PER_HOUR) || 30;
  const perDay = Number(process.env.PAID_API_DAILY_LIMIT) || 300;
  const now = new Date();
  const hour = now.toISOString().slice(0, 13);
  const day = now.toISOString().slice(0, 10);
  const ip = clientIp(req, context);

  const store = getStore({ name: 'paid-api-usage', consistency: 'strong' });
  const ipKey = `${name}/ip/${ip}/${hour}`;
  const dayKey = `${name}/day/${day}`;
  const [ipCount, dayCount] = await Promise.all([
    store.get(ipKey, { type: 'json' }).then((v) => v?.n || 0),
    store.get(dayKey, { type: 'json' }).then((v) => v?.n || 0),
  ]);
  if (ipCount >= perIp) return deny(429, 'Too many requests from this address. Try again later.');
  if (dayCount >= perDay) return deny(429, 'Daily limit reached for this service. Try again tomorrow.');

  await Promise.all([store.setJSON(ipKey, { n: ipCount + 1 }), store.setJSON(dayKey, { n: dayCount + 1 })]);
  return null;
}
