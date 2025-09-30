export const money = (value: number, fractionDigits = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(Number.isFinite(value) ? value : 0);

export const percent = (value: number, fractionDigits = 1) =>
  `${(Number.isFinite(value) ? value : 0) * 100}`;

export const percentDisplay = (value: number, fractionDigits = 1) =>
  `${((Number.isFinite(value) ? value : 0) * 100).toFixed(fractionDigits)}%`;

export const compactNumber = (value: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number.isFinite(value) ? value : 0,
  );

export const integer = (value: number) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
