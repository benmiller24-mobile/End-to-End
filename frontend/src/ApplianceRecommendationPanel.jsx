import React from 'react';

/**
 * ApplianceRecommendationPanel
 *
 * Renders solverResult.applianceRecommendation (from eclipse-engine/src/appliance-recommender.js)
 * as a compact side panel: the layout-driven cooking strategy + rationale, tiered brand
 * options (value / luxury / ultra) for each appliance category, ventilation sizing,
 * island extras, and a per-tier package total.
 *
 * Pure presentational; dark theme matched to App.jsx palette.
 */

const P = {
  surface: '#1e293b', surface2: '#334155', border: '#334155',
  text: '#f1f5f9', muted: '#94a3b8', dim: '#64748b',
  primary: '#3b82f6', accent: '#10b981', warn: '#f59e0b', purple: '#8b5cf6',
};

const TIER = {
  value: { label: 'Value', color: P.accent },
  luxury: { label: 'Luxury', color: P.primary },
  ultra: { label: 'Ultra', color: P.purple },
};

const money = (n) => (n == null ? '' : '$' + n.toLocaleString());

function TierRow({ tier, opt }) {
  if (!opt) return null;
  const t = TIER[tier];
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0', fontSize: 12 }}>
      <span style={{ flex: '0 0 46px', color: t.color, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {t.label}
      </span>
      <span style={{ flex: 1, color: P.text }}>
        {opt.brand} <span style={{ color: P.muted }}>{opt.model}</span>
        {opt.width ? <span style={{ color: P.dim }}> · {opt.width}"</span> : null}
        {opt.fuel ? <span style={{ color: P.dim }}> · {opt.fuel}</span> : null}
      </span>
      {opt.msrp ? <span style={{ color: P.muted, whiteSpace: 'nowrap' }}>{money(opt.msrp)}</span> : null}
    </div>
  );
}

function Category({ title, hint, options }) {
  if (!options) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: P.text, marginBottom: 2 }}>{title}</div>
      {hint ? <div style={{ fontSize: 10.5, color: P.dim, marginBottom: 4 }}>{hint}</div> : null}
      {['value', 'luxury', 'ultra'].map(t => <TierRow key={t} tier={t} opt={options[t]} />)}
    </div>
  );
}

export default function ApplianceRecommendationPanel({ solverResult, style }) {
  const rec = solverResult && solverResult.applianceRecommendation;
  if (!rec) return null;
  const { cooking, ventilation: vent, refrigeration, dishwasher, island, packageByTier } = rec;

  const card = {
    background: P.surface, border: `1px solid ${P.border}`, borderRadius: 8,
    padding: 14, color: P.text, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    ...style,
  };
  const divider = { height: 1, background: P.border, margin: '10px 0', border: 'none' };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>Appliance Recommendation</div>
        <div style={{ fontSize: 10, color: P.muted, textTransform: 'capitalize' }}>{(rec.layout || '').replace('-', ' ')}</div>
      </div>
      <div style={{ fontSize: 11.5, color: P.muted, lineHeight: 1.4, marginBottom: 10 }}>{rec.summary}</div>

      {/* COOKING */}
      <div style={{ fontSize: 10, fontWeight: 700, color: P.warn, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        Cooking · {cooking.type}
      </div>
      {cooking.type === 'range' ? (
        <Category title={`Range${cooking.width ? ` (${cooking.width}")` : ''}`} options={cooking.range} />
      ) : (
        <>
          <Category title="Cooktop" options={cooking.cooktop} />
          <Category title="Wall oven" options={cooking.wallOven} />
        </>
      )}

      {/* VENTILATION */}
      <div style={{ fontSize: 11, color: P.muted, background: '#0f172a', borderRadius: 6, padding: '6px 8px', marginBottom: 10 }}>
        <b style={{ color: P.text }}>Ventilation</b> · {vent.hoodWidth}" hood · {vent.cfm} CFM · {vent.mount}
        {vent.makeUpAir ? <span style={{ color: P.warn }}> · make-up air req'd</span> : null}
      </div>

      <hr style={divider} />
      <Category title="Refrigeration" hint={refrigeration.recommendation} options={refrigeration.options} />
      <Category title="Dishwasher" hint={dishwasher.placement} options={dishwasher.options} />

      {/* ISLAND */}
      {island && (
        <>
          <hr style={divider} />
          <div style={{ fontSize: 11, fontWeight: 700, color: P.text, marginBottom: 4 }}>Island</div>
          <div style={{ fontSize: 10.5, color: P.muted, lineHeight: 1.45 }}>
            <div>• {island.prepSink}</div>
            <div>• {island.cooktopInIsland}</div>
            {island.seating ? <div>• {island.seating}</div> : null}
          </div>
          {island.beverage && <div style={{ marginTop: 6 }}><Category title="Beverage / wine" options={island.beverage} /></div>}
        </>
      )}

      {/* PACKAGE TOTALS */}
      <hr style={divider} />
      <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
        Est. package (appliances)
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {['value', 'luxury', 'ultra'].map(t => {
          const pk = packageByTier && packageByTier[t];
          if (!pk) return null;
          return (
            <div key={t} style={{ flex: 1, textAlign: 'center', background: '#0f172a', borderRadius: 6, padding: '8px 4px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: TIER[t].color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{TIER[t].label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginTop: 2 }}>{money(pk.estTotal)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9.5, color: P.dim, marginTop: 8, lineHeight: 1.4 }}>{rec.note}</div>
    </div>
  );
}
