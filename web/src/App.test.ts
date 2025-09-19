import { describe, expect, it } from 'vitest';
import {
  App,
  normalizeCreditsApplied,
  optionalNumber,
  safeNumber,
  SupabaseFinancialSnapshot,
} from './App';

describe('safeNumber', () => {
  it('returns the fallback for null', () => {
    expect(safeNumber(null, 42)).toBe(42);
  });

  it('returns the fallback for undefined', () => {
    expect(safeNumber(undefined, 19)).toBe(19);
  });

  it('returns the fallback for an empty string', () => {
    expect(safeNumber('', 73)).toBe(73);
  });

  it('returns the fallback for whitespace strings', () => {
    expect(safeNumber('   ', 55)).toBe(55);
  });

  it('parses valid numeric strings', () => {
    expect(safeNumber('123.45', 0)).toBeCloseTo(123.45);
  });

  it('returns the fallback for invalid strings', () => {
    expect(safeNumber('not-a-number', 9)).toBe(9);
  });

  it('returns numbers unchanged when finite', () => {
    expect(safeNumber(88, 0)).toBe(88);
  });

  it('returns the fallback for NaN numbers', () => {
    expect(safeNumber(Number.NaN, 11)).toBe(11);
  });
});

describe('optionalNumber', () => {
  it('returns null for null', () => {
    expect(optionalNumber(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(optionalNumber(undefined)).toBeNull();
  });

  it('returns null for empty strings', () => {
    expect(optionalNumber('')).toBeNull();
  });

  it('returns null for whitespace strings', () => {
    expect(optionalNumber('   ')).toBeNull();
  });

  it('returns parsed numbers for numeric strings', () => {
    expect(optionalNumber('987.65')).toBeCloseTo(987.65);
  });

  it('returns null for invalid strings', () => {
    expect(optionalNumber('bad')).toBeNull();
  });

  it('returns the numeric value when finite', () => {
    expect(optionalNumber(500)).toBe(500);
  });

  it('returns null for NaN numbers', () => {
    expect(optionalNumber(Number.NaN)).toBeNull();
  });
});

describe('normalizeCreditsApplied', () => {
  const cachedCredits = 1_500;

  it('keeps the cached credits when Supabase returns null', () => {
    const snapshot: SupabaseFinancialSnapshot = { credits_applied: null };
    expect(normalizeCreditsApplied(snapshot, cachedCredits)).toBe(cachedCredits);
  });

  it('keeps the cached credits when Supabase omits the field', () => {
    const snapshot = undefined;
    expect(normalizeCreditsApplied(snapshot, cachedCredits)).toBe(cachedCredits);
  });

  it('parses numeric strings from Supabase', () => {
    const snapshot: SupabaseFinancialSnapshot = { credits_applied: '2750.5' };
    expect(normalizeCreditsApplied(snapshot, cachedCredits)).toBeCloseTo(2750.5);
  });

  it('returns the numeric value when Supabase responds with a number', () => {
    const snapshot: SupabaseFinancialSnapshot = { credits_applied: 6200 };
    expect(normalizeCreditsApplied(snapshot, cachedCredits)).toBe(6200);
  });
});

describe('App', () => {
  it('continues to expose cached credits when the response is null', () => {
    const cachedCredits = 2_250;
    const snapshot: SupabaseFinancialSnapshot = { credits_applied: null };

    const result = App({ cachedCredits, snapshot });
    expect(result.credits).toBe(cachedCredits);
  });

  it('updates to Supabase values when provided', () => {
    const cachedCredits = 1_100;
    const snapshot: SupabaseFinancialSnapshot = { credits_applied: '1300' };

    const result = App({ cachedCredits, snapshot });
    expect(result.credits).toBe(1300);
  });
});
