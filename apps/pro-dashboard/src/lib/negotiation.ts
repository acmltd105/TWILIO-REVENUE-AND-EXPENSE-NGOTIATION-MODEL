import { ScenarioEnvelope, ScenarioState } from './types';

export const computeFallbackEnvelope = (state: ScenarioState): ScenarioEnvelope => {
  const portfolioDiscount = state.askTierA / 100;
  const averageRevenue = state.leads * (state.conversionRate / 100) * state.revenuePerSale;
  const trailing = state.trailing90 || averageRevenue * 0.25;
  const targetDiscount = Math.min(0.6, portfolioDiscount + Math.min(0.1, trailing / 5_000_000));
  const floorDiscount = Math.max(0.1, targetDiscount - 0.08);
  const ceilingDiscount = Math.min(0.75, targetDiscount + 0.05);
  return {
    target_discount: targetDiscount,
    floor_discount: floorDiscount,
    ceiling_discount: ceilingDiscount,
    target_revenue: averageRevenue * (1 - targetDiscount),
    floor_revenue: averageRevenue * (1 - ceilingDiscount),
    ceiling_revenue: averageRevenue * (1 - floorDiscount),
    current_margin: 0.32,
    target_margin: 0.45,
  };
};

export const fetchNegotiationEnvelope = async (
  state: ScenarioState,
): Promise<ScenarioEnvelope> => {
  try {
    const response = await fetch('/api/negotiation/envelope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: state }),
    });
    if (!response.ok) {
      throw new Error(`Negotiation API returned ${response.status}`);
    }
    const payload = (await response.json()) as { envelope?: ScenarioEnvelope };
    if (payload?.envelope) {
      return payload.envelope;
    }
    throw new Error('Invalid negotiation payload');
  } catch (error) {
    console.warn('Negotiation API unavailable, using fallback', error);
    return computeFallbackEnvelope(state);
  }
};
