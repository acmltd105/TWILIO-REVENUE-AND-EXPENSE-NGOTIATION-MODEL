export type NumericInput = number | string | null | undefined;

/**
 * Coerces arbitrary Supabase numeric fields into safe numbers without
 * accidentally converting empty/nullish values into zero.
 */
export function safeNumber(input: NumericInput, fallback: number): number {
  if (input === null || input === undefined) {
    return fallback;
  }

  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : fallback;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return fallback;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

/**
 * Returns a nullable numeric helper that keeps optional values optional while
 * filtering out blank or invalid strings.
 */
export function optionalNumber(input: NumericInput): number | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : null;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export interface SupabaseFinancialSnapshot {
  credits_applied: NumericInput;
}

/**
 * Normalises the Supabase response for credits so the dashboard can continue
 * to rely on cached values when the backend returns nullish data.
 */
export function normalizeCreditsApplied(
  snapshot: SupabaseFinancialSnapshot | null | undefined,
  cachedCredits: number
): number {
  if (!snapshot) {
    return cachedCredits;
  }

  return safeNumber(snapshot.credits_applied, cachedCredits);
}

export interface DashboardProps {
  cachedCredits: number;
  snapshot?: SupabaseFinancialSnapshot | null;
}

/**
 * Minimal placeholder component; in the real UI this would render the Twilio
 * negotiation KPIs. We expose it here solely so tests can confirm that the
 * helpers keep rendering the cached credits instead of zeroing the dashboard.
 */
export function App({ cachedCredits, snapshot }: DashboardProps) {
  const credits = normalizeCreditsApplied(snapshot, cachedCredits);
  return {
    heading: 'Twilio Negotiation Dashboard',
    credits,
  } as const;
}

export default App;
