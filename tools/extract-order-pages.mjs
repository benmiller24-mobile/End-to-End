/**
 * Extract a cabinet ORDER list from rendered order-sheet page images via Claude
 * vision (for scanned/raster order PDFs with no extractable text). Returns the
 * structured line items so the order can be re-priced in any tenant line.
 *
 *   ANTHROPIC_API_KEY=… node tools/extract-order-pages.mjs out.json img1.png img2.png …
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['areas'],
  properties: {
    areas: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['area', 'doorStyle', 'finish', 'lineItems'],
        properties: {
          area: { type: 'string', description: 'e.g. kitchen, bath' },
          doorStyle: { type: 'string' },
          finish: { type: 'string' },
          construction: { type: 'string' },
          lineItems: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              required: ['productCode', 'qty', 'description'],
              properties: {
                productCode: { type: 'string', description: 'the catalog SKU exactly as printed, e.g. B2PO30, BACS530L, T4PO2796' },
                qty: { type: 'number' },
                description: { type: 'string' },
                finishedEnd: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
};

const SYSTEM = `You are reading a kitchen/bath cabinet ORDER sheet (a cabinet maker's order form). Transcribe EVERY product line exactly. The product code column holds the cabinet SKU as printed (e.g. B2PO30, B3D30, SB36, BACS530L, BTPO18, T4PO2796, W3924-27, WAC2442L, MCB8, fillers). Capture qty, the printed product code verbatim, the description, and the finished-end note if any. Group by Style/Area (kitchen, bath). Also capture the door style, finish, and construction printed in each area header. Include molding/filler/panel/toe-kick lines. Do NOT invent or skip lines.`;

async function main() {
  const out = process.argv[2];
  const imgs = process.argv.slice(3);
  if (!out || !imgs.length) { console.error('usage: node tools/extract-order-pages.mjs out.json img1 [img2 …]'); process.exit(1); }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content = imgs.map(p => ({ type: 'image', source: { type: 'base64', media_type: p.endsWith('.png') ? 'image/png' : 'image/jpeg', data: fs.readFileSync(p).toString('base64') } }));
  content.push({ type: 'text', text: 'Transcribe the full order — every line item across all pages.' });
  const stream = client.messages.stream({
    model: 'claude-opus-4-8', max_tokens: 16000, thinking: { type: 'adaptive' },
    system: SYSTEM, output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content.find(b => b.type === 'text').text;
  fs.writeFileSync(out, text);
  const data = JSON.parse(text);
  for (const a of data.areas) console.log(`${a.area}: ${a.lineItems.length} lines  (door ${a.doorStyle}, finish ${a.finish})`);
  console.log('wrote', out);
}
main();
