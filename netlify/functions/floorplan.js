// Floorplan vision extraction — SYNCHRONOUS path (fallback).
// Key comes from the ANTHROPIC_API_KEY env var (set in Netlify site settings,
// same handling as LEONARDO_API_KEY); it is never shipped to the browser.
//
// The importer prefers the background-job pattern (/api/floorplan-job-background
// + /api/floorplan-result) because dense architect sheets outlive Netlify's
// 26-second synchronous limit. This endpoint stays for quick extractions and
// as a fallback where background functions are unavailable. It streams
// whitespace heartbeats so the CDN doesn't 504 a quiet connection — leading
// whitespace is valid JSON, so callers still just res.json().
import { runExtraction } from '../lib/floorplanCore.js';

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured on the server — add it in Netlify site settings to enable floorplan import.' }, 503);
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    const body = await req.json();
    if (!body.image || !body.mediaType) return json({ error: 'image (base64) and mediaType required' }, 400);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(' ')); } catch { /* closed */ }
        }, 4000);
        try {
          const extraction = await runExtraction(body);
          controller.enqueue(encoder.encode(JSON.stringify({ extraction })));
        } catch (e) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: e?.message || String(e) })));
        } finally {
          clearInterval(heartbeat);
          controller.close();
        }
      },
    });
    return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};

export const config = { path: '/api/floorplan' };
