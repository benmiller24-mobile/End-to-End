// Shared core for the floorplan vision extraction — used by the synchronous
// /api/floorplan function (quick plans) and the background job runner
// (dense architect sheets that outlive the 26s sync limit).
import Anthropic from '@anthropic-ai/sdk';

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
          type: { type: 'string', enum: ['range', 'cooktop', 'wall_oven', 'refrigerator', 'dishwasher', 'sink', 'microwave', 'washer', 'dryer'] },
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
- Appliances: place each on its wall with width (standard widths when not printed: range 30, dishwasher 24, fridge 36, sink 33, washer/dryer 27). Do not invent appliances that are not drawn. Laundry/utility rooms are valid rooms — report washers and dryers as appliances, not notes.
- Island: only when the plan draws one; report its overall countertop footprint.
- layoutType reflects the cabinetry chain you reported, not the room outline.
- notes: one short paragraph on anything ambiguous the designer must verify on site.`;


export function buildUserBits({ calibration, hints }) {
  const userBits = [];
  if (calibration?.pixels > 0 && calibration?.inches > 0) {
    userBits.push(`Scale calibration: the operator marked two points ${Math.round(calibration.pixels)} image pixels apart that are ${calibration.inches} inches apart in the real room (${(calibration.pixels / calibration.inches).toFixed(2)} px/inch). Measurements derived this way are "scaled".`);
  }
  if (hints) userBits.push(`Operator notes: ${hints}`);
  userBits.push('Extract the kitchen geometry from this floorplan.');
  return userBits;
}

export async function runExtraction({ image, mediaType, calibration, hints }) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msgStream = client.messages.stream({
    model: 'claude-opus-4-8',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: buildUserBits({ calibration, hints }).join('\n\n') },
      ],
    }],
  });
  const response = await msgStream.finalMessage();
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error(`no extraction returned (stop: ${response.stop_reason})`);
  return JSON.parse(textBlock.text);
}
