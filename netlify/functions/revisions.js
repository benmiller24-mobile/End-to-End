import { diffLayouts, diffQuotes } from '../../eclipse-engine/src/index.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const { type, layoutA, layoutB, quoteA, quoteB } = await req.json();

    if (type === 'layout') {
      const diff = diffLayouts(layoutA, layoutB);
      return new Response(JSON.stringify(diff), { headers: { 'Content-Type': 'application/json' } });
    }

    if (type === 'quote') {
      const diff = diffQuotes(quoteA, quoteB);
      return new Response(JSON.stringify(diff), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'type must be "layout" or "quote"' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/revisions' };
