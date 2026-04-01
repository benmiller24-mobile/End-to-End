import { listTemplates, getTemplate, getTemplateCategories, solveTemplate, solve } from '../../eclipse-engine/src/index.js';

export default async (req) => {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const category = url.searchParams.get('category');
    const id = url.searchParams.get('id');

    if (id) {
      const template = getTemplate(id);
      if (!template) return new Response(JSON.stringify({ error: 'Template not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify(template), { headers: { 'Content-Type': 'application/json' } });
    }

    const templates = listTemplates(category || undefined);
    const categories = getTemplateCategories();
    return new Response(JSON.stringify({ templates, categories }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (req.method === 'POST') {
    try {
      const { templateId, overrides } = await req.json();
      const result = solveTemplate(templateId, solve, overrides || {});
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  }

  return new Response(JSON.stringify({ error: 'GET or POST required' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
};

export const config = { path: '/api/templates' };
