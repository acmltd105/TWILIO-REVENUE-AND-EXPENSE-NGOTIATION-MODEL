import { Sku, ScenarioState } from './types';

const tierWeights = [0.16, 0.14, 0.12, 0.11, 0.1, 0.09, 0.08, 0.08, 0.07, 0.05];

export type Drivers = ReturnType<typeof deriveDrivers>;

export const segmentsFromWords = (words: number): number => {
  const characters = Math.max(0, words) * 5.2;
  if (characters <= 160) {
    return 1;
  }
  return Math.ceil(characters / 153);
};

export const deriveDrivers = (state: ScenarioState) => {
  const leads = Math.max(0, state.leads);
  const conversations = leads * Math.max(0, state.conversationsPerLead);
  const outbound = conversations * Math.max(0, state.outboundPerConversation);
  const inbound = conversations * Math.max(0, state.inboundPerConversation);
  const segments = segmentsFromWords(Math.max(1, state.wordsPerOutbound));

  const rcsMessages = outbound * Math.max(0, Math.min(1, state.rcsAdoption));
  const nonRcsOutbound = outbound - rcsMessages;
  const mmsMessages = nonRcsOutbound * Math.max(0, Math.min(1, state.mmsShare));
  const smsOutbound = Math.max(0, nonRcsOutbound - mmsMessages);
  const smsSegments = smsOutbound * segments;
  const tollFreeSegments = smsSegments * Math.max(0, Math.min(1, state.tollFreeShare));
  const standardSegments = Math.max(0, smsSegments - tollFreeSegments);

  const verifyChecks = leads * Math.max(0, state.verifyAttemptsPerLead) * Math.max(0, Math.min(1, state.verifySuccessRate));
  const aiResponses = conversations * Math.max(0, state.aiRepliesPerConversation);
  const lookups = leads * Math.max(0, state.lookupsPerLead);
  const voiceMinutes = leads * Math.max(0, state.callsPerLead) * Math.max(0, state.minutesPerCall);
  const campaigns = Math.max(0, state.campaignsActive);

  const whatsappConversations = conversations * 0.22;
  const flexSeats = Math.max(60, Math.round(conversations * 0.0015));
  const emailThousands = Math.max(1, leads * 0.45 / 1000);
  const segmentMtus = Math.max(leads * 0.55, flexSeats * 40);

  return {
    leads,
    conversations,
    outbound,
    inbound,
    segments,
    smsStandardSegments: standardSegments,
    smsTollFreeSegments: tollFreeSegments,
    mmsMessages,
    rcsMessages,
    whatsappConversations,
    verifyChecks,
    aiResponses,
    lookups,
    voiceMinutes,
    campaigns,
    flexSeats,
    emailThousands,
    segmentMtus,
  };
};

const THEME_BASE: Record<string, keyof Drivers> = {
  'SMS Standard': 'smsStandardSegments',
  'SMS Toll-Free': 'smsTollFreeSegments',
  'SMS Short Code': 'smsStandardSegments',
  MMS: 'mmsMessages',
  RCS: 'rcsMessages',
  WhatsApp: 'whatsappConversations',
  'PSTN Outbound': 'voiceMinutes',
  'Elastic SIP': 'voiceMinutes',
  Verify: 'verifyChecks',
  'Twilio Segment': 'segmentMtus',
  'Flex Seats': 'flexSeats',
  SendGrid: 'emailThousands',
};

const themeScale: Partial<Record<string, number>> = {
  'SMS Short Code': 0.18,
  'Elastic SIP': 0.35,
};

export type PortfolioSummary = {
  monthlyRack: number;
  monthlyEffective: number;
  blendedCpm: number;
  messagesTotal: number;
  tier: 'A' | 'B' | 'C';
  discount: number;
  nextThreshold?: number;
  progressPct: number;
};

export const ladderFromState = (state: ScenarioState, trailing90: number) => {
  const thresholds = [250_000, 1_000_000];
  const askA = state.askTierA / 100;
  const askB = state.askTierB / 100;
  const askC = state.askTierC / 100;
  if (trailing90 > thresholds[1]) {
    return { tier: 'C' as const, discount: askC, nextThreshold: undefined, progressPct: 100 };
  }
  if (trailing90 > thresholds[0]) {
    const progress = Math.min(100, ((trailing90 - thresholds[0]) / (thresholds[1] - thresholds[0])) * 100);
    return {
      tier: 'B' as const,
      discount: askB,
      nextThreshold: thresholds[1] - trailing90,
      progressPct: progress,
    };
  }
  const progress = Math.min(100, (trailing90 / thresholds[0]) * 100);
  return {
    tier: 'A' as const,
    discount: askA,
    nextThreshold: thresholds[0] - trailing90,
    progressPct: progress,
  };
};

const distribution = tierWeights;

const resolveTierWeight = (name: string) => {
  const tierMatch = /Tier\s+(\d+)/i.exec(name);
  const tierIndex = tierMatch ? Math.max(1, Math.min(10, Number(tierMatch[1]))) - 1 : 0;
  return distribution[tierIndex] ?? 0.1;
};

export const computePortfolio = (
  skus: Sku[],
  state: ScenarioState,
  drivers: Drivers,
): { rows: Array<{ sku: Sku; units: number; rackCost: number; effectiveCost: number }>; summary: PortfolioSummary } => {
  const trailing = Math.max(0, state.trailing90);
  const ladder = ladderFromState(state, trailing);

  const rows = skus.map((sku) => {
    const key = THEME_BASE[sku.theme] ?? 'smsStandardSegments';
    const base = drivers[key] ?? 0;
    const scale = themeScale[sku.theme] ?? 1;
    const units = base * scale * resolveTierWeight(sku.name);
    const effectiveRate = sku.contract_rate > 0 ? sku.contract_rate : sku.rack_rate * (1 - ladder.discount);
    const rackCost = sku.rack_rate * units;
    const effectiveCost = effectiveRate * units;
    return { sku, units, rackCost, effectiveCost };
  });

  const monthlyRack = rows.reduce((sum, row) => sum + row.rackCost, 0);
  const monthlyEffective = rows.reduce((sum, row) => sum + row.effectiveCost, 0);
  const messagesTotal =
    drivers.smsStandardSegments +
    drivers.smsTollFreeSegments +
    drivers.rcsMessages +
    drivers.mmsMessages +
    drivers.verifyChecks +
    drivers.aiResponses;
  const blendedCpm = messagesTotal > 0 ? monthlyEffective / messagesTotal : 0;

  return {
    rows,
    summary: {
      monthlyRack,
      monthlyEffective,
      blendedCpm,
      messagesTotal,
      tier: ladder.tier,
      discount: ladder.discount,
      nextThreshold: ladder.nextThreshold,
      progressPct: ladder.progressPct,
    },
  };
};
