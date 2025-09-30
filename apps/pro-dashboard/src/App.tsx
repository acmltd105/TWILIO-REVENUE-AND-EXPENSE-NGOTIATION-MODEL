import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from './hooks/useCatalog';
import { useScenario } from './hooks/useScenario';
import { deriveDrivers, computePortfolio, ladderFromState } from './lib/math';
import { fetchNegotiationEnvelope, computeFallbackEnvelope } from './lib/negotiation';
import { money, percentDisplay, integer, compactNumber } from './lib/format';
import { ScenarioState, ScenarioEnvelope } from './lib/types';
import { NumericField } from './components/NumericField';
import { Tabs } from './components/Tabs';
import { Hero } from './components/Hero';
import { KpiCard } from './components/KpiCard';
import { ProjectionChart } from './components/ProjectionChart';

const TAB_LABELS = [
  'Leads & Segments',
  'Usage & Costs',
  'Cost per Client',
  '24-Month Projection',
  'Contract vs Rack vs Ask',
  'Exports',
  'Predictability & Modeling',
  'Journeys',
  'AI Bots',
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

export default function App() {
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

  const automationSkuHighlights = useMemo(
    () =>
      rows
        .filter((row) =>
          ['Twilio Segment', 'Flex Seats', 'Verify', 'WhatsApp', 'RCS', 'SMS Standard', 'SendGrid'].includes(
            row.sku.theme,
          ),
        )
        .sort((a, b) => b.effectiveCost - a.effectiveCost)
        .slice(0, 6)
        .map((row) => ({
          id: row.sku.sku_id,
          name: row.sku.name,
          theme: row.sku.theme,
          category: row.sku.category,
          unit: row.sku.unit,
          rate: row.sku.contract_rate > 0 ? row.sku.contract_rate : row.sku.rack_rate,
          cost: row.effectiveCost,
          units: row.units,
        })),
    [rows],
  );

  const automationSkuTotal = automationSkuHighlights.reduce((sum, item) => sum + item.cost, 0);

  const apiSettings = useMemo(
    () => {
      const themeMap = new Map<
        string,
        {
          theme: string;
          cost: number;
          skus: Set<string>;
          categories: Set<string>;
        }
      >();

      rows.forEach((row) => {
        const key = row.sku.theme || row.sku.category || row.sku.name;
        if (!themeMap.has(key)) {
          themeMap.set(key, {
            theme: key,
            cost: 0,
            skus: new Set<string>(),
            categories: new Set<string>(),
          });
        }
        const entry = themeMap.get(key);
        if (entry) {
          entry.cost += row.effectiveCost;
          entry.skus.add(row.sku.name);
          entry.categories.add(row.sku.category);
        }
      });

      return Array.from(themeMap.values())
        .map((entry) => ({
          theme: entry.theme,
          cost: entry.cost,
          skus: Array.from(entry.skus).sort(),
          categories: Array.from(entry.categories).sort(),
        }))
        .sort((a, b) => b.cost - a.cost);
    },
    [rows],
  );

  const totalApiCost = apiSettings.reduce((sum, api) => sum + api.cost, 0);

  const verifyCoverage = Math.min(
    1,
    Math.max(0, state.verifyAttemptsPerLead) * Math.max(0, Math.min(1, state.verifySuccessRate)),
  );
  const verifiedLeads = drivers.leads * verifyCoverage;
  const aiAutomationShare = drivers.outbound > 0 ? Math.min(1, drivers.aiResponses / drivers.outbound) : 0;
  const conversationDepth = Math.max(0, state.outboundPerConversation + state.inboundPerConversation);
  const aiRepliesRatio = state.outboundPerConversation > 0 ? state.aiRepliesPerConversation / state.outboundPerConversation : 0;
  const segmentCoverage = drivers.leads > 0 ? Math.min(1, drivers.segmentMtus / drivers.leads) : 0;
  const flexSeatCoverage = drivers.conversations > 0 ? drivers.flexSeats / drivers.conversations : 0;
  const voiceMinutesPerLead = drivers.leads > 0 ? drivers.voiceMinutes / drivers.leads : 0;
  const budgetShare = summary.monthlyEffective > 0 ? automationSkuTotal / summary.monthlyEffective : 0;
  const aiShareWithinTarget = aiAutomationShare >= 0.2 && aiAutomationShare <= 0.65;
  const budgetHealthy = summary.monthlyEffective === 0 || budgetShare <= 0.35;

  const leadJourneyStages = useMemo(() => {
    const stageSkus = (themes: string[]) =>
      rows
        .filter((row) => themes.includes(row.sku.theme))
        .sort((a, b) => b.effectiveCost - a.effectiveCost)
        .slice(0, 3)
        .map((row) => ({
          id: row.sku.sku_id,
          name: row.sku.name,
          theme: row.sku.theme,
          unit: row.sku.unit,
          category: row.sku.category,
          rate: row.sku.contract_rate > 0 ? row.sku.contract_rate : row.sku.rack_rate,
        }));

    return [
      {
        id: 'capture',
        title: 'Capture & Qualify',
        description:
          'Launch high-velocity inbound flows, enrich contacts, and run verification guardrails before they hit the bot.',
        metricLabel: 'Verified leads / month',
        metricValue: integer(verifiedLeads),
        insight:
          verifyCoverage < 0.6
            ? 'Boost Twilio Verify coverage to at least 60% so AI never meets an unverified contact.'
            : 'Verification coverage is strong—keep A/B testing to preserve success rates.',
        skus: stageSkus(['SendGrid', 'WhatsApp', 'Verify']),
      },
      {
        id: 'nurture',
        title: 'Nurture & Automate',
        description:
          'Blend outbound nudges and AI follow-ups that adapt messaging based on engagement telemetry.',
        metricLabel: 'AI replies / conversation',
        metricValue: state.aiRepliesPerConversation.toFixed(1),
        insight:
          aiRepliesRatio < 0.6
            ? 'Increase automation scripts or journeys so the bot covers at least 60% of outbound slots.'
            : 'AI reply density is healthy—start training next-intent variations.',
        skus: stageSkus(['SMS Standard', 'RCS', 'WhatsApp']),
      },
      {
        id: 'engage',
        title: 'Omnichannel Engagement',
        description:
          'Let the bot fluidly pivot between SMS, MMS, RCS, and email to keep prospects in-channel.',
        metricLabel: 'RCS adoption',
        metricValue: percentDisplay(Math.min(1, state.rcsAdoption)),
        insight:
          state.rcsAdoption < 0.2
            ? 'Unlock richer journeys by piloting RCS with top segments and high-value SKUs.'
            : 'RCS adoption unlocks premium journeys—reinforce creative testing.',
        skus: stageSkus(['RCS', 'MMS', 'SendGrid']),
      },
      {
        id: 'handoff',
        title: 'Sales Handoff & Conversion',
        description:
          'Sync routing into live agents, voice, and Verify-backed step-up flows when intent spikes.',
        metricLabel: 'Conversion rate',
        metricValue: percentDisplay(state.conversionRate / 100),
        insight:
          state.conversionRate < 5
            ? 'Tighten scoring rules or re-sequence AI prompts to lift conversion past 5%.'
            : 'Conversion rate is on track—instrument downstream revenue captures.',
        skus: stageSkus(['PSTN Outbound', 'Flex Seats', 'Verify']),
      },
      {
        id: 'loyalty',
        title: 'Lifecycle Expansion',
        description:
          'Feed Segment profiles back into campaigns and keep AI journeys learning from product usage.',
        metricLabel: 'Segment MTUs',
        metricValue: integer(drivers.segmentMtus),
        insight:
          segmentCoverage < 0.4
            ? 'Enrich Segment traits or add Lookups so downstream AI has enough behavioral data.'
            : 'Lifecycle data coverage is strong—scale post-sale nurture with AI copilots.',
        skus: stageSkus(['Twilio Segment', 'SendGrid', 'Flex Seats']),
      },
    ];
  }, [
    aiRepliesRatio,
    drivers.segmentMtus,
    rows,
    segmentCoverage,
    state.aiRepliesPerConversation,
    state.conversionRate,
    state.rcsAdoption,
    verifyCoverage,
    verifiedLeads,
  ]);

  const aiBotChecks = useMemo(
    () => [
      {
        id: 'leadVolume',
        label: 'Lead volume baseline',
        detail: `${integer(drivers.leads)} / mo`,
        status: drivers.leads >= 250,
        recommendation: drivers.leads >= 250
          ? 'Volume supports statistical feedback loops for reinforcement learning.'
          : 'Feed at least 250 leads per month before rolling out autonomous sequences.',
      },
      {
        id: 'verification',
        label: 'Identity & compliance gating',
        detail: `${percentDisplay(verifyCoverage)}`,
        status: verifyCoverage >= 0.6,
        recommendation: verifyCoverage >= 0.6
          ? 'Verification coverage is resilient; monitor OTP drop-offs weekly.'
          : 'Increase Verify attempts or success rate so ≥60% of leads are cleared.',
      },
      {
        id: 'conversationDepth',
        label: 'Conversation depth',
        detail: `${conversationDepth.toFixed(1)} touches / lead`,
        status: conversationDepth >= 2,
        recommendation: conversationDepth >= 2
          ? 'Journeys are multi-touch; maintain AI prompts per persona.'
          : 'Add nurture nudges or retargeting to reach at least 2 touches per lead.',
      },
      {
        id: 'aiReplies',
        label: 'AI reply density',
        detail: `${state.aiRepliesPerConversation.toFixed(1)} replies`,
        status: state.aiRepliesPerConversation >= 0.8,
        recommendation: state.aiRepliesPerConversation >= 0.8
          ? 'Bot has enough scripted turns; focus on personalization rules.'
          : 'Author more AI response templates to hit 0.8+ replies per conversation.',
      },
      {
        id: 'automationShare',
        label: 'Automation share of outbound',
        detail: `${percentDisplay(aiAutomationShare)}`,
        status: aiShareWithinTarget,
        recommendation: aiShareWithinTarget
          ? 'Automation share is balanced; keep human-in-the-loop at critical junctures.'
          : 'Target 20-65% automation so humans still cover edge cases.',
      },
      {
        id: 'lookupEnrichment',
        label: 'Data enrichment velocity',
        detail: `${state.lookupsPerLead.toFixed(1)} lookups / lead`,
        status: state.lookupsPerLead >= 0.5,
        recommendation: state.lookupsPerLead >= 0.5
          ? 'Lookup density is adequate—stream traits into Segment audiences.'
          : 'Increase Lookup calls so every other lead is enriched before AI outreach.',
      },
      {
        id: 'segmentActivation',
        label: 'Segment MTU coverage',
        detail: `${percentDisplay(segmentCoverage)}`,
        status: segmentCoverage >= 0.4,
        recommendation: segmentCoverage >= 0.4
          ? 'MTU coverage is on target for journey branching.'
          : 'Connect more sources so ≥40% of leads sync into Segment.',
      },
      {
        id: 'flexStaffing',
        label: 'Agent seat readiness',
        detail: `${integer(drivers.flexSeats)} seats`,
        status: flexSeatCoverage >= 0.0015,
        recommendation: flexSeatCoverage >= 0.0015
          ? 'Flex staffing scales with demand; ensure skills-based routing is tuned.'
          : 'Provision additional Flex seats or reassign licenses before go-live.',
      },
      {
        id: 'voiceFallback',
        label: 'Voice & human fallback',
        detail: `${integer(drivers.voiceMinutes)} min / mo`,
        status: voiceMinutesPerLead >= 0.2,
        recommendation: voiceMinutesPerLead >= 0.2
          ? 'Voice coverage is ready for escalations and high-intent leads.'
          : 'Add PSTN or Flex Voice steps so ≥0.2 min/lead is available for handoff.',
      },
      {
        id: 'budgetHeadroom',
        label: 'Automation budget headroom',
        detail: `${money(automationSkuTotal)}`,
        status: budgetHealthy,
        recommendation: budgetHealthy
          ? 'Automation investment is within 35% of effective spend.'
          : 'Rebalance SKU mix or negotiate rates to keep automation ≤35% of spend.',
      },
    ],
    [
      aiAutomationShare,
      aiShareWithinTarget,
      automationSkuTotal,
      budgetHealthy,
      conversationDepth,
      drivers.flexSeats,
      drivers.leads,
      drivers.voiceMinutes,
      segmentCoverage,
      state.aiRepliesPerConversation,
      state.lookupsPerLead,
      voiceMinutesPerLead,
      flexSeatCoverage,
      verifyCoverage,
    ],
  );

  const modelingSignals = useMemo(
    () => [
      {
        id: 'identityCoverage',
        label: 'Identity coverage',
        detail: percentDisplay(verifyCoverage),
        status: verifyCoverage >= 0.6,
        guidance:
          verifyCoverage >= 0.6
            ? 'Verification pass-through sustains predictable routing models.'
            : 'Raise Verify attempts or success rate until ≥60% of leads are cleared.',
      },
      {
        id: 'automationBand',
        label: 'Automation band',
        detail: percentDisplay(aiAutomationShare),
        status: aiShareWithinTarget,
        guidance:
          aiShareWithinTarget
            ? 'Automation sits inside the 20-65% guardrail—variance is bounded.'
            : 'Rebalance human vs AI touchpoints to maintain the 20-65% band.',
      },
      {
        id: 'segmentSignal',
        label: 'Segment signal coverage',
        detail: percentDisplay(segmentCoverage),
        status: segmentCoverage >= 0.4,
        guidance:
          segmentCoverage >= 0.4
            ? 'Lifecycle telemetry is rich enough for forecast modeling.'
            : 'Connect additional data sources until 40% of leads sync into Segment.',
      },
      {
        id: 'budgetDiscipline',
        label: 'Automation budget discipline',
        detail: percentDisplay(budgetShare),
        status: budgetHealthy,
        guidance:
          budgetHealthy
            ? 'Automation cost share is healthy; modeling will not exceed tolerances.'
            : 'Negotiate or refactor SKUs to keep automation ≤35% of effective spend.',
      },
    ],
    [aiAutomationShare, aiShareWithinTarget, budgetHealthy, budgetShare, segmentCoverage, verifyCoverage],
  );

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
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(280px,320px)_1fr]">
        <div className="glass-card flex max-h-[32rem] flex-col gap-4 overflow-hidden p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/60">War Machine</span>
              <h2 className="text-xl font-bold text-ocean">Settings</h2>
            </div>
            <div className="rounded-full bg-wave/10 px-3 py-1 text-xs font-semibold text-ocean/70">
              APIs {apiSettings.length}
            </div>
          </div>
          <p className="text-sm text-ocean/70">
            Configure the platform surface area by API theme—verify cost envelopes and SKU coverage before dispatching
            deployments.
          </p>
          <div className="flex items-center gap-3 text-xs font-semibold text-ocean/60">
            <span className="rounded-full bg-foam/20 px-3 py-1 text-ocean">
              Total Monthly Automation {money(totalApiCost)}
            </span>
            <span className="rounded-full bg-foam/20 px-3 py-1 text-ocean">Tracked SKUs {rows.length}</span>
          </div>
          <div className="-mr-3 flex-1 overflow-y-auto pr-3">
            {apiSettings.length > 0 ? (
              <ul className="grid gap-3">
                {apiSettings.map((api) => (
                  <li
                    key={api.theme}
                    className="flex flex-col gap-3 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-[0.3em] text-ocean/50">API Theme</span>
                        <span className="text-sm font-semibold text-ocean">{api.theme}</span>
                        {api.categories.length > 0 ? (
                          <span className="text-xs font-semibold text-ocean/60">
                            {api.categories.join(' · ')}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <span className="block text-xs uppercase tracking-[0.3em] text-ocean/50">Monthly Cost</span>
                        <span className="text-base font-semibold text-midnight">{money(api.cost)}</span>
                        <span className="text-xs font-semibold text-ocean/60">{api.skus.length} SKUs</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {api.skus.map((sku) => (
                        <span
                          key={sku}
                          className="rounded-full bg-wave/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ocean"
                        >
                          {sku}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-3xl border border-dashed border-ocean/20 bg-white/60 p-4 text-sm text-ocean/60">
                Catalog syncing… settings will populate once SKU data is available.
              </div>
            )}
          </div>
        </div>
        <Hero
          trailing90={trailing}
          skuCount={skuCount}
          activeTier={ladder.tier}
          discount={ladder.discount}
          mode={mode}
          error={scenarioError ?? (catalogError ? catalogError.message : null)}
          onOpen={openUsageTab}
        />
      </section>

      <Tabs tabs={TAB_LABELS} activeIndex={activeTab} onChange={setActiveTab} />

      {/* Tabs content */}
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
          <p className="text-sm font-semibold text-red-500">
            Negotiation API unavailable; displaying fallback calculations.
          </p>
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

      <section className={activeTab === 6 ? 'flex flex-col gap-6' : 'hidden'}>
        <div className="glass-card flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-ocean">Predictability &amp; Modeling</h2>
            <p className="text-sm text-ocean/70">
              Inspect the data fidelity powering the war machine. These controls calibrate cost, identity coverage, and
              automation ratios before forecast models lock.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Verified Data Rows"
              value={integer(verifiedLeads)}
              tone={verifiedLeads >= 200 ? 'positive' : 'warning'}
            />
            <KpiCard
              label="Automation Ratio"
              value={percentDisplay(aiAutomationShare)}
              tone={aiShareWithinTarget ? 'positive' : 'warning'}
            />
            <KpiCard
              label="Automation Cost Share"
              value={percentDisplay(budgetShare)}
              tone={budgetHealthy ? 'positive' : 'critical'}
            />
          </div>
        </div>

        <div className="glass-card flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-ocean">Model Guardrails</h3>
            <p className="text-sm text-ocean/70">
              Validate the inputs that keep simulations trustworthy. Every signal runs continuously and flags drift before it
              hits production.
            </p>
          </div>
          <ul className="grid gap-3">
            {modelingSignals.map((signal) => (
              <li
                key={signal.id}
                className="flex items-start gap-3 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-sm"
              >
                <span
                  className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    signal.status ? 'bg-foam/70 text-midnight' : 'bg-rose-200 text-midnight'
                  }`}
                >
                  {signal.status ? '✓' : '!'}
                </span>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-ocean">{signal.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        signal.status ? 'bg-foam/20 text-ocean' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {signal.detail}
                    </span>
                  </div>
                  <p className="text-ocean/70">{signal.guidance}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={activeTab === 7 ? 'flex flex-col gap-6' : 'hidden'}>
        <div className="glass-card flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-ocean">Lead Journey Orchestration</h2>
            <p className="text-sm text-ocean/70">
              Align capture, nurture, handoff, and lifecycle loops across every Twilio surface. Each stage locks the SKUs and
              guardrails required to execute.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Verified Leads"
              value={integer(verifiedLeads)}
              tone={verifiedLeads >= 200 ? 'positive' : 'warning'}
            />
            <KpiCard
              label="AI Replies / Conversation"
              value={state.aiRepliesPerConversation.toFixed(1)}
              tone={aiRepliesRatio >= 0.6 ? 'positive' : 'warning'}
            />
            <KpiCard
              label="Segment MTUs"
              value={integer(drivers.segmentMtus)}
              tone={segmentCoverage >= 0.4 ? 'positive' : 'warning'}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {leadJourneyStages.map((stage, idx) => (
            <div key={stage.id} className="glass-card flex flex-col gap-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/60">Stage {idx + 1}</span>
                  <h3 className="text-xl font-bold text-ocean">{stage.title}</h3>
                  <p className="text-sm text-ocean/70">{stage.description}</p>
                </div>
                <div className="rounded-3xl bg-wave/10 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/60">{stage.metricLabel}</p>
                  <p className="text-lg font-semibold text-ocean">{stage.metricValue}</p>
                </div>
              </div>
              <p className="text-sm text-ocean/70">{stage.insight}</p>
              <div className="grid gap-2">
                {stage.skus.length > 0 ? (
                  stage.skus.map((sku) => (
                    <div
                      key={sku.id}
                      className="flex items-center justify-between gap-3 rounded-3xl border border-white/50 bg-white/70 px-4 py-3 shadow-sm"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-ocean">{sku.name}</span>
                        <span className="text-xs uppercase tracking-[0.2em] text-ocean/60">
                          {sku.theme} · {sku.unit}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-midnight">{money(sku.rate)}</span>
                    </div>
                  ))
                ) : (
                  <p className="rounded-3xl border border-dashed border-ocean/20 bg-white/60 px-4 py-3 text-sm text-ocean/60">
                    Catalog loading… relevant SKUs will surface once data syncs.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={activeTab === 8 ? 'flex flex-col gap-6' : 'hidden'}>
        <div className="glass-card flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-ocean">AI Bot Implementation Checklist</h3>
            <p className="text-sm text-ocean/70">
              Ten pre-flight guardrails to validate before the CLI deploys orchestration flows—surface weak spots before they
              become production outages.
            </p>
          </div>
          <ul className="grid gap-3">
            {aiBotChecks.map((check) => (
              <li
                key={check.id}
                className="flex items-start gap-3 rounded-3xl border border-white/50 bg-white/70 p-4 shadow-sm"
              >
                <span
                  className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    check.status ? 'bg-foam/70 text-midnight' : 'bg-rose-200 text-midnight'
                  }`}
                >
                  {check.status ? '✓' : '!'}
                </span>
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-ocean">{check.label}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        check.status ? 'bg-foam/20 text-ocean' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {check.detail}
                    </span>
                  </div>
                  <p className="text-ocean/70">{check.recommendation}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="flex flex-col gap-2 p-6">
            <h3 className="text-lg font-semibold text-ocean">Automation SKU Focus</h3>
            <p className="text-sm text-ocean/70">
              Prioritize the Twilio SKU mix powering the bot stack—verify spend, rate assumptions, and channel coverage at a
              glance.
            </p>
          </div>
          {automationSkuHighlights.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/60 text-left text-sm text-ocean">
                <thead className="bg-white/80 text-xs font-semibold uppercase tracking-wider text-ocean/70">
                  <tr>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Theme</th>
                    <th className="px-4 py-3">Unit</th>
                    <th className="px-4 py-3 text-right">Eff. Rate</th>
                    <th className="px-4 py-3 text-right">Monthly Units</th>
                    <th className="px-4 py-3 text-right">Monthly Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/40">
                  {automationSkuHighlights.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 font-semibold">{item.name}</td>
                      <td className="px-4 py-2">{item.theme}</td>
                      <td className="px-4 py-2">{item.unit}</td>
                      <td className="px-4 py-2 text-right">{money(item.rate)}</td>
                      <td className="px-4 py-2 text-right">{compactNumber(item.units)}</td>
                      <td className="px-4 py-2 text-right">{money(item.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 pb-6 text-sm text-ocean/60">
              SKU economics will populate once the catalog service responds.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
