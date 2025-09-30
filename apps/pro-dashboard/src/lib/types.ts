export type Ladder = {
  tier_a: number;
  tier_b: number;
  tier_c: number;
};

export type Sku = {
  sku_id: string;
  name: string;
  category: string;
  theme: string;
  unit: string;
  rack_rate: number;
  contract_rate: number;
  discount_rate: number;
  price_after_discount: number;
  ladder: Ladder;
  locked: boolean;
  notes?: string;
};

export type CatalogPayload = {
  generated_at: string;
  skus: Sku[];
};

export type ScenarioState = {
  startDate: 'sep1' | 'sep15';
  trailing90: number;
  leads: number;
  wordsPerOutbound: number;
  conversationsPerLead: number;
  outboundPerConversation: number;
  inboundPerConversation: number;
  rcsAdoption: number;
  mmsShare: number;
  tollFreeShare: number;
  verifyAttemptsPerLead: number;
  verifySuccessRate: number;
  aiRepliesPerConversation: number;
  lookupsPerLead: number;
  callsPerLead: number;
  minutesPerCall: number;
  campaignsActive: number;
  askTierA: number;
  askTierB: number;
  askTierC: number;
  engagementRate: number;
  conversionRate: number;
  revenuePerSale: number;
  projectionStartSpend: number;
  projectionGrowth: number;
  projectionMonths: number;
};

export type ScenarioEnvelope = {
  target_discount: number;
  floor_discount: number;
  ceiling_discount: number;
  target_revenue: number;
  floor_revenue: number;
  ceiling_revenue: number;
  current_margin: number;
  target_margin: number;
};

export type PersistedScenario = ScenarioState & {
  id?: string;
  last_modified?: string;
};
