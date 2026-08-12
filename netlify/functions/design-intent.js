/**
 * /api/design-intent — customer intent → solver preferences (AD-5).
 * =================================================================
 * The Holodeck split: the LLM translates free-text intent ("lots of baking
 * storage, hide the fridge, warm modern feel") into the DETERMINISTIC
 * engine's existing input schema — prefs + design-option hints — and never
 * places a cabinet or invents a SKU. The engine and rubric do the designing;
 * hallucination cannot produce an illegal layout.
 *
 * Key: ANTHROPIC_API_KEY in the Netlify env ONLY (same rule as
 * LEONARDO_API_KEY — never in code). Returns 503 with a friendly message
 * when unset. POST { text } → { prefs, lens, notes }.
 */
export const config = { path: '/api/design-intent' };

const SCHEMA_HINT = `Translate the customer's words into ONLY these fields (omit anything not implied):
{
 "prefs": {
   "preferDrawerBases": bool,          // "drawers", "easy access", "aging in place"
   "featureHood": bool,                // "statement hood", "showpiece range wall"
   "cornerTreatment": "lazySusan"|"blindCorner"|"auto",
   "sophistication": "standard"|"high"|"very_high",   // budget ↔ luxury language
   "golaChannel": bool,                // "handleless", "no hardware", "sleek"
   "underCabinetLighting": bool
 },
 "lens": "balanced"|"storage"|"feature"|"value",      // which design option to lead with
 "notes": "one sentence explaining the mapping for the designer"
}`;

export default async (req) => {
  const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: 'Design-intent assistant is not configured on this deployment (ANTHROPIC_API_KEY missing). Preferences can be set manually.' }), { status: 503, headers });
  }

  let text = '';
  try { text = String((await req.json()).text || '').slice(0, 2000); } catch { /* empty */ }
  if (!text.trim()) return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: `${SCHEMA_HINT}\n\nCustomer said: "${text}"\n\nAnswer with strict JSON only.` }],
      }),
    });
    if (!res.ok) return new Response(JSON.stringify({ error: `intent service error ${res.status}` }), { status: 502, headers });
    const out = await res.json();
    const raw = (out.content || []).map(c => c.text || '').join('');
    const parsed = JSON.parse((raw.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    // Whitelist — nothing the engine doesn't understand passes through.
    const prefs = {};
    const p = parsed.prefs || {};
    if (typeof p.preferDrawerBases === 'boolean') prefs.preferDrawerBases = p.preferDrawerBases;
    if (typeof p.featureHood === 'boolean') prefs.featureHood = p.featureHood;
    if (['lazySusan', 'blindCorner', 'auto'].includes(p.cornerTreatment)) prefs.cornerTreatment = p.cornerTreatment;
    if (['standard', 'high', 'very_high'].includes(p.sophistication)) prefs.sophistication = p.sophistication;
    if (typeof p.golaChannel === 'boolean') prefs.golaChannel = p.golaChannel;
    if (typeof p.underCabinetLighting === 'boolean') prefs.underCabinetLighting = p.underCabinetLighting;
    const lens = ['balanced', 'storage', 'feature', 'value'].includes(parsed.lens) ? parsed.lens : 'balanced';
    return new Response(JSON.stringify({ prefs, lens, notes: String(parsed.notes || '').slice(0, 300) }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: `intent parse failed: ${e.message}` }), { status: 502, headers });
  }
};
