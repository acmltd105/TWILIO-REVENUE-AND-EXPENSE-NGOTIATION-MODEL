import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../../hooks/useCatalog';
import { useScenario } from '../../hooks/useScenario';
import { deriveDrivers, computePortfolio, ladderFromState } from '../../lib/math';
import { fetchNegotiationEnvelope, computeFallbackEnvelope } from '../../lib/negotiation';
import { money, percentDisplay, integer, compactNumber } from '../../lib/format';
import type { ScenarioState, ScenarioEnvelope } from '../../lib/types';
import { NumericField } from '../../components/NumericField';
import { Tabs } from '../../components/Tabs';
import { Hero } from '../../components/Hero';
import { KpiCard } from '../../components/KpiCard';
import { ProjectionChart } from '../../components/ProjectionChart';
import { FlowRail, type FlowStep } from '../../components/FlowRail';

const TAB_LABELS = [
  'Leads & Segments',
  'Usage & Costs',
  'Cost per Client',
  '24-Month Projection',
  'Contract vs Rack vs Ask',
  'Exports',
];

const FLOW_STEPS: FlowStep[] = [
  {
    label: 'Intake Demand Profile',
    description: 'Define inbound leads, engagement rates, and conversation volume drivers.',
  },
  {
    label: 'Shape SKU Usage',
    description: 'Blend channel mix, verify volume, and automate usage per conversation.',
  },
  {
    label: 'Calibrate Unit Economics',
    description: 'Lock conversion math, negotiate discount ladders, and inspect envelope.',
  },
  {
    label: 'Project Growth Horizon',
    description: 'Compound monthly spend trajectories with 24-month control.',
  },
  {
    label: 'Benchmark Contracts',
    description: 'Validate rack versus contract deltas across locked SKUs.',
  },
  {
    label: 'Export Executive Packet',
    description: 'Deliver CSV / JSON payloads with trailing spend and envelope metadata.',
  },
];

const driverFields: Array<{ group: string; fields: Array<{ id: keyof ScenarioState; label: string; suffix?: string; step?: number }> }> = [
  {
    group: 'Volume Drivers',
    fields: [
      { id: 'leads', label: 'Leads / month' },
      { id: 'wordsPerOutbound', label: 'Avg words / outbound message' },
      { id: 'conversationsPerLead', label: 'Conversations / lead', step: 0.1 },
      { id: 'outboundPerConversation', label: 'Outbound msgs / conversation', step: 0.1 },
      { id: 'inboundPerConversation', label: 'Inbound msgs / conversation', step: 0.1 },
      { id: 'campaignsActive', label: 'Active 10DLC campaigns' },
    ],
  },
  {
    group: 'Channel Mix',
    fields: [
      { id: 'rcsAdoption', label: 'RCS adoption', suffix: '0-1', step: 0.01 },
      { id: 'mmsShare', label: 'MMS share of non-RCS', suffix: '0-1', step: 0.01 },
      { id: 'tollFreeShare', label: 'SMS Toll-Free share', suffix: '0-1', step: 0.01 },
      { id: 'verifyAttemptsPerLead', label: 'Verify attempts / lead', step: 0.1 },
      { id: 'verifySuccessRate', label: 'Verify success rate', suffix: '0-1', step: 0.01 },
      { id: 'aiRepliesPerConversation', label: 'AI replies / conversation', step: 0.1 },
      { id: 'lookupsPerLead', label: 'Lookups / lead', step: 0.1 },
    ],
  },
  {
    group: 'Voice & Support',
    fields: [
      { id: 'callsPerLead', label: 'Voice calls / lead', step: 0.05 },
      { id: 'minutesPerCall', label: 'Minutes / voice call', step: 0.1 },
    ],
  },
];

const ladderFields: Array<{ id: keyof ScenarioState; label: string }[]> = [[
  { id: 'askTierA', label: 'Tier A (%)' },
  { id: 'askTierB', label: 'Tier B (%)' },
  { id: 'askTierC', label: 'Tier C (%)' },
]];

const financeFields: Array<{ id: keyof ScenarioState; label: string; suffix?: string; step?: number }> = [
  { id: 'engagementRate', label: 'Engagement rate (%)', step: 0.1 },
  { id: 'conversionRate', label: 'Conversion rate (%)', step: 0.01 },
  { id: 'revenuePerSale', label: 'Revenue / sale ($)' },
];

const projectionFields: Array<{ id: keyof ScenarioState; label: string; step?: number }> = [
  { id: 'projectionStartSpend', label: 'Start monthly spend ($)' },
  { id: 'projectionGrowth', label: 'Growth % / month', step: 0.1 },
  { id: 'projectionMonths', label: 'Months' },
];

const toPercent = (value: number) => `${(value * 100).toFixed(1)}%`;

export const PredictabilityFlow = () => {
  const { state, setState, loading: scenarioLoading, mode, error: scenarioError } = useScenario();
  const { data: catalog, isLoading: catalogLoading, error: catalogError } = useCatalog();
  const [activeTab, setActiveTab] = useState(0);
  const [envelope, setEnvelope] = useState<ScenarioEnvelope | null>(null);
  const [envelopeStatus, setEnvelopeStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [trailing, setTrailing] = useState<number>(state.trailing90);

  useEffect(() => {
    if (scenarioLoading) {
      return () => undefined;
    }
    let cancelled = false;
    const loadTrailing = async () => {
      try {
        const response = await fetch('/trailing_90_usd.txt', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('missing trailing spend');
        }
        const text = await response.text();
        const value = Number(text.trim());
        if (!cancelled && Number.isFinite(value) && Math.abs((state.trailing90 ?? 0) - value) > 0.5) {
          setTrailing(value);
          setState({ ...state, trailing90: value });
        }
      } catch (err) {
        console.warn('Unable to load trailing spend from build artifact', err);
      }
    };
    loadTrailing();
    return () => {
      cancelled = true;
    };
  }, [scenarioLoading, state, setState]);

  useEffect(() => {
    setEnvelopeStatus('loading');
    const timer = window.setTimeout(() => {
      fetchNegotiationEnvelope(state)
        .then((result) => {
          setEnvelope(result);
          setEnvelopeStatus('idle');
        })
        .catch((err) => {
          console.error('Negotiation API failed', err);
          setEnvelope(computeFallbackEnvelope(state));
          setEnvelopeStatus('error');
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state]);

  const handleFieldChange = (id: keyof ScenarioState, value: number) => {
    const next = { ...state, [id]: value } as ScenarioState;
    if (id === 'trailing90') {
      setTrailing(value);
    }
    setState(next);
  };

  const drivers = useMemo(() => deriveDrivers(state), [state]);
  const { rows, summary } = useMemo(() => {
    if (!catalog) {
      return {
        rows: [],
        summary: {
          monthlyRack: 0,
          monthlyEffective: 0,
          blendedCpm: 0,
          messagesTotal: 0,
          tier: 'A' as const,
          discount: state.askTierA / 100,
          nextThreshold: 250000,
          progressPct: 0,
        },
      };
    }
    return computePortfolio(catalog, state, drivers);
  }, [catalog, drivers, state]);

  const ladder = useMemo(() => ladderFromState(state, trailing), [state, trailing]);

  const engagement = state.leads * (state.engagementRate / 100);
  const conversions = state.leads * (state.conversionRate / 100);
  const costPerEngaged = engagement > 0 ? summary.monthlyEffective / engagement : 0;
  const costPerConversion = conversions > 0 ? summary.monthlyEffective / conversions : 0;
  const grossMarginPerSale = state.revenuePerSale - costPerConversion;

  const projection = useMemo(() => {
    const months = Math.max(1, Math.round(state.projectionMonths));
    const growth = state.projectionGrowth / 100;
    let spend = state.projectionStartSpend;
    const values: number[] = [];
    const table: Array<{ month: number; spend: number; cumulative: number }> = [];
    let cumulative = 0;
    for (let month = 1; month <= months; month += 1) {
      if (month > 1) {
        spend *= 1 + growth;
      }
      cumulative += spend;
      values.push(spend);
      table.push({ month, spend, cumulative });
    }
    return { values, table };
  }, [state.projectionMonths, state.projectionGrowth, state.projectionStartSpend]);

  const lockedRows = useMemo(() => rows.filter((row) => row.sku.locked), [rows]);

  const exportState = () => ({
    scenario: state,
    trailing90: trailing,
    envelope,
    generatedAt: new Date().toISOString(),
  });

  const downloadFile = (name: string, contents: string, mime: string) => {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const downloadJson = () => downloadFile('dashboard_state.json', JSON.stringify(exportState(), null, 2), 'application/json');

  const downloadCsv = () => {
    const entries = Object.entries(state) as Array<[string, unknown]>;
    const lines = ['key,value', ...entries.map(([key, value]) => `${key},${value}`)];
    downloadFile('dashboard_state.csv', lines.join('\n'), 'text/csv');
  };

  const openUsageTab = () => {
    setActiveTab(1);
    document.getElementById('usage-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const skuCount = catalog?.length ?? 0;

  return (
    <div className="flex flex-col gap-10">
      <Hero
        trailing90={trailing}
        skuCount={skuCount}
        activeTier={ladder.tier}
        discount={ladder.discount}
        mode={mode}
        error={scenarioError ?? (catalogError ? catalogError.message : null)}
        onOpen={openUsageTab}
      />

      <FlowRail steps={FLOW_STEPS} activeIndex={activeTab} onSelect={setActiveTab} />

      <Tabs tabs={TAB_LABELS} activeIndex={activeTab} onChange={setActiveTab} />

      <section className={activeTab === 0 ? 'flex flex-col gap-6' : 'hidden'}>
        <div className="grid gap-6 lg:grid-cols-3">
          {driverFields.map((group) => (
            <div key={group.group} className="glass-card flex flex-col gap-4 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-ocean/60">{group.group}</h2>
              <div className="grid gap-4">
                {group.fields.map((field) => (
                  <NumericField
                    key={field.id}
                    id={field.id}
                    label={field.label}
                    value={state[field.id] as number}
                    step={field.step}
                    onChange={handleFieldChange}
                    suffix={field.suffix}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="glass-card grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Conversations" value={integer(drivers.conversations)} />
          <KpiCard label="Outbound Messages" value={integer(drivers.outbound)} />
          <KpiCard label="Inbound Messages" value={integer(drivers.inbound)} />
          <KpiCard label="Segments / Message" value={drivers.segments.toFixed(2)} />
        </div>
      </section>

      <section id="usage-section" className={activeTab === 1 ? 'flex flex-col gap-6' : 'hidden'}>
        <div className="glass-card flex flex-col gap-6 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <NumericField id="trailing90" label="Trailing 90 Spend ($)" value={trailing} onChange={handleFieldChange} />
            {ladderFields[0].map((field) => (
              <NumericField
                key={field.id}
                id={field.id}
                label={field.label}
                value={state[field.id] as number}
                onChange={handleFieldChange}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Monthly Rack" value={money(summary.monthlyRack)} />
            <KpiCard label="Monthly Effective" value={money(summary.monthlyEffective)} tone="positive" />
            <KpiCard label="Messages" value={integer(summary.messagesTotal)} />
            <KpiCard label="Blended $/Msg" value={money(summary.blendedCpm, 4)} />
          </div>
          <div className="glass-panel flex flex-col gap-4 bg-white/80 p-6">
            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-ocean">
              <span className="rounded-full bg-wave/10 px-3 py-1">Active Tier {ladder.tier}</span>
              <span className="rounded-full bg-wave/10 px-3 py-1">Ask Discount {percentDisplay(ladder.discount)}</span>
              {ladder.nextThreshold ? (
                <span className="rounded-full bg-wave/10 px-3 py-1">
                  ${money(ladder.nextThreshold, 0)} to Tier {ladder.tier === 'A' ? 'B' : 'C'}
                </span>
              ) : (
                <span className="rounded-full bg-wave/10 px-3 py-1">Max tier reached</span>
              )}
              <div className="flex-1 rounded-full bg-ocean/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-wave to-foam"
                  style={{ width: `${ladder.progressPct}%` }}
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/50">
              <table className="min-w-full divide-y divide-white/60 text-left text-sm text-ocean">
                <thead className="bg-white/80 text-xs font-semibold uppercase tracking-wider text-ocean/70">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Theme</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Rack</th>
                    <th className="px-4 py-3 text-right">Contract</th>
                    <th className="px-4 py-3 text-right">Ask %</th>
                    <th className="px-4 py-3 text-right">Eff. Rate</th>
                    <th className="px-4 py-3 text-right">Units</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {rows.map((row, idx) => (
                    <tr key={row.sku.sku_id} className={row.sku.locked ? 'bg-foam/20' : ''}>
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2 font-semibold">{row.sku.theme}</td>
                      <td className="px-4 py-2">{row.sku.category}</td>
                      <td className="px-4 py-2">{row.sku.name}</td>
                      <td className="px-4 py-2">{row.sku.unit}</td>
                      <td className="px-4 py-2 text-right">{money(row.sku.rack_rate)}</td>
                      <td className="px-4 py-2 text-right">{money(row.sku.contract_rate)}</td>
                      <td className="px-4 py-2 text-right">{toPercent(ladder.discount)}</td>
                      <td className="px-4 py-2 text-right">{money(row.sku.contract_rate || row.sku.price_after_discount)}</td>
                      <td className="px-4 py-2 text-right">{compactNumber(row.units)}</td>
                      <td className="px-4 py-2 text-right">{money(row.effectiveCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {catalogLoading && <p className="text-sm text-ocean/60">Loading catalog…</p>}
            {catalogError && <p className="text-sm text-red-500">{catalogError.message}</p>}
          </div>
        </div>
      </section>

      <section className={activeTab === 2 ? 'flex flex-col gap-6' : 'hidden'}>
        <div className="glass-card grid gap-6 p-6 md:grid-cols-3">
          {financeFields.map((field) => (
            <NumericField
              key={field.id}
              id={field.id}
              label={field.label}
              value={state[field.id] as number}
              onChange={handleFieldChange}
              step={field.step}
              suffix={field.suffix}
            />
          ))}
        </div>
        <div className="glass-card grid gap-6 p-6 md:grid-cols-3">
          <KpiCard label="Cost per Engaged" value={money(costPerEngaged)} />
          <KpiCard label="Cost per Conversion" value={money(costPerConversion)} tone="critical" />
          <KpiCard label="Gross Margin / Sale" value={money(grossMarginPerSale)} tone="positive" />
        </div>
        {envelope ? (
          <div className="glass-panel grid gap-4 bg-white/80 p-6 md:grid-cols-3">
            <KpiCard label="Target Discount" value={percentDisplay(envelope.target_discount)} />
            <KpiCard label="Floor Discount" value={percentDisplay(envelope.floor_discount)} />
            <KpiCard label="Ceiling Discount" value={percentDisplay(envelope.ceiling_discount)} />
            <KpiCard label="Target Revenue" value={money(envelope.target_revenue)} />
            <KpiCard label="Floor Revenue" value={money(envelope.floor_revenue)} />
            <KpiCard label="Ceiling Revenue" value={money(envelope.ceiling_revenue)} />
          </div>
        ) : (
          <div className="glass-panel p-6 text-sm text-ocean/60">Negotiation envelope is loading…</div>
        )}
        {envelopeStatus === 'error' ? (
          <p className="text-sm font-semibold text-red-500">Negotiation API unavailable; displaying fallback calculations.</p>
        ) : null}
      </section>

      <section className={activeTab === 3 ? 'flex flex-col gap-6' : 'hidden'}>
        <div className="glass-card grid gap-6 p-6 md:grid-cols-3">
          {projectionFields.map((field) => (
            <NumericField
              key={field.id}
              id={field.id}
              label={field.label}
              value={state[field.id] as number}
              onChange={handleFieldChange}
              step={field.step}
            />
          ))}
        </div>
        <div className="glass-card p-6">
          <ProjectionChart values={projection.values} />
        </div>
        <div className="glass-panel overflow-hidden bg-white/80">
          <table className="min-w-full divide-y divide-white/60 text-left text-sm text-ocean">
            <thead className="bg-white/80 text-xs font-semibold uppercase tracking-wider text-ocean/70">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Monthly Spend</th>
                <th className="px-4 py-3 text-right">Cumulative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {projection.table.map((row) => (
                <tr key={row.month}>
                  <td className="px-4 py-2">{row.month}</td>
                  <td className="px-4 py-2 text-right">{money(row.spend)}</td>
                  <td className="px-4 py-2 text-right">{money(row.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={activeTab === 4 ? 'flex flex-col gap-6' : 'hidden'}>
        <div className="glass-card overflow-hidden">
          <table className="min-w-full divide-y divide-white/60 text-left text-sm text-ocean">
            <thead className="bg-white/80 text-xs font-semibold uppercase tracking-wider text-ocean/70">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3 text-right">Rack</th>
                <th className="px-4 py-3 text-right">Contract</th>
                <th className="px-4 py-3 text-right">Ask Eff.</th>
                <th className="px-4 py-3 text-right">Δ Rack→Contract</th>
                <th className="px-4 py-3 text-right">Δ Rack→Ask</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/40">
              {lockedRows.map((row) => {
                const askRate = row.sku.rack_rate * (1 - ladder.discount);
                return (
                  <tr key={row.sku.sku_id} className="bg-foam/20">
                    <td className="px-4 py-2 font-semibold">{row.sku.name}</td>
                    <td className="px-4 py-2 text-right">{money(row.sku.rack_rate)}</td>
                    <td className="px-4 py-2 text-right">{money(row.sku.contract_rate)}</td>
                    <td className="px-4 py-2 text-right">{money(askRate)}</td>
                    <td className="px-4 py-2 text-right">{money(row.sku.rack_rate - row.sku.contract_rate)}</td>
                    <td className="px-4 py-2 text-right">{money(row.sku.rack_rate - askRate)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className={activeTab === 5 ? 'flex flex-col gap-6' : 'hidden'}>
        <div className="glass-card flex flex-wrap gap-4 p-6">
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-full bg-wave px-6 py-3 text-base font-semibold text-midnight shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl"
          >
            Export CSV (state)
          </button>
          <button
            type="button"
            onClick={downloadJson}
            className="rounded-full bg-foam px-6 py-3 text-base font-semibold text-midnight shadow-lg transition hover:-translate-y-0.5 hover:shadow-2xl"
          >
            Export JSON (state)
          </button>
          <div className="rounded-3xl border border-dashed border-ocean/20 bg-white/70 p-4 text-sm text-ocean/70">
            Payload includes ladder configuration, drivers, trailing spend, and the last negotiation envelope snapshot.
          </div>
        </div>
      </section>
    </div>
  );
};
