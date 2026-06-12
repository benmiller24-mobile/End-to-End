// Floorplan vision extraction — server-side proxy to the Claude API.
// Key comes from the ANTHROPIC_API_KEY env var (set in Netlify site settings,
// same handling as LEONARDO_API_KEY); it is never shipped to the browser.
//
// POST /api/floorplan  { image, mediaType, calibration?, hints? }
//   image       base64 (no data: prefix) of a floorplan photo / scan / render
//   mediaType   image/png | image/jpeg | image/webp
//   calibration { pixels, inches } from the two-point scale tool (optional)
//   hints       free-text operator notes (optional)
// -> the structured room extraction (walls chain, openings, appliances,
//    island, per-measurement confidence) ready for the solver's input shape.
import Anthropic from '@anthropic-ai/sdk';

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

// Strict schema: every measurement carries a confidence grade so the app can
// keep the order-readiness gate honest (printed → verifiable; scaled/guessed
// → budget until field-measured).
const CONFIDENCE = { type: 'string', enum: ['printed', 'scaled', 'guessed'] };
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['layoutType', 'scaleStatus', 'walls', 'appliances', 'island', 'ceilingHeightIn', 'notes'],
  properties: {
    layoutType: { type: 'string', enum: ['single-wall', 'galley', 'l-shape', 'u-shape', 'g-shape'] },
    scaleStatus: CONFIDENCE,
    ceilingHeightIn: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    walls: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'lengthIn', 'role', 'confidence', 'openings'],
        properties: {
          id: { type: 'string', description: 'A, B, C… in chain order' },
          lengthIn: { type: 'number' },
          role: { type: 'string', enum: ['sink', 'range', 'fridge', 'general'] },
          confidence: CONFIDENCE,
          openings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'positionIn', 'widthIn', 'confidence'],
              properties: {
                type: { type: 'string', enum: ['window', 'door', 'archway'] },
                positionIn: { type: 'number', description: 'left edge from the wall start, inches' },
                widthIn: { type: 'number' },
                sillHeightIn: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                headHeightIn: { anyOf: [{ type: 'number' }, { type: 'null' }] },
                confidence: CONFIDENCE,
              },
            },
          },
        },
      },
    },
    appliances: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'widthIn', 'wall'],
        properties: {
          type: { type: 'string', enum: ['range', 'cooktop', 'wall_oven', 'refrigerator', 'dishwasher', 'sink', 'microwave'] },
          widthIn: { type: 'number' },
          wall: { type: 'string' },
          positionIn: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        },
      },
    },
    island: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['lengthIn', 'depthIn'],
          properties: { lengthIn: { type: 'number' }, depthIn: { type: 'number' } },
        },
        { type: 'null' },
      ],
    },
    notes: { type: 'string' },
  },
};

const SYSTEM = `You are an NKBA kitchen designer reading a floorplan (architect drawing, builder plan, design-software print, or a photo of one) to set up a cabinetry design. Extract ONLY the kitchen's cabinetry geometry.

Rules:
- Report walls as ONE connected chain in the order a person walks them (label A, B, C…), including only walls that carry or will carry cabinetry. Skip walls that are pure circulation.
- All measurements in inches. Convert printed metric or feet-and-inches dimensions ("12'-6 1/2"" → 150.5).
- Confidence per measurement: "printed" ONLY when a printed dimension string on the drawing directly states that measurement; "scaled" when you derived it from the drawing's scale, a scale bar, or proportion against a printed reference; "guessed" when neither. Never inflate confidence.
- Openings: position is the left edge measured from the wall's start in chain direction. Windows get sill/head heights when printed (typical sill 42, head 80 when shown but unprinted → scaled).
- Appliances: place each on its wall with width (standard widths when not printed: range 30, dishwasher 24, fridge 36, sink 33). Do not invent appliances that are not drawn.
- Island: only when the plan draws one; report its overall countertop footprint.
- layoutType reflects the cabinetry chain you reported, not the room outline.
- notes: one short paragraph on anything ambiguous the designer must verify on site.`;

export default async (req) => {
  try {
    const KEY = process.env.ANTHROPIC_API_KEY;
    if (!KEY) return json({ error: 'ANTHROPIC_API_KEY is not configured on the server — add it in Netlify site settings to enable floorplan import.' }, 503);
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

    const { image, mediaType, calibration, hints } = await req.json();
    if (!image || !mediaType) return json({ error: 'image (base64) and mediaType required' }, 400);

    const userBits = [];
    if (calibration?.pixels > 0 && calibration?.inches > 0) {
      userBits.push(`Scale calibration: the operator marked two points ${Math.round(calibration.pixels)} image pixels apart that are ${calibration.inches} inches apart in the real room (${(calibration.pixels / calibration.inches).toFixed(2)} px/inch). Measurements derived this way are "scaled".`);
    }
    if (hints) userBits.push(`Operator notes: ${hints}`);
    userBits.push('Extract the kitchen geometry from this floorplan.');

    const client = new Anthropic({ apiKey: KEY });
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: userBits.join('\n\n') },
        ],
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock) return json({ error: `no extraction returned (stop: ${response.stop_reason})` }, 502);
    return json({ extraction: JSON.parse(textBlock.text) });
  } catch (e) {
    const status = e?.status >= 400 ? e.status : 500;
    return json({ error: e?.message || String(e) }, status);
  }
};

export const config = { path: '/api/floorplan' };
