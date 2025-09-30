import { ChangeEvent } from 'react';
import { ScenarioState } from '../lib/types';

interface NumericFieldProps {
  id: keyof ScenarioState;
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (id: keyof ScenarioState, value: number) => void;
  suffix?: string;
}

export const NumericField = ({ id, label, value, min, max, step, onChange, suffix }: NumericFieldProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    onChange(id, Number.isFinite(parsed) ? parsed : 0);
  };
  return (
    <label className="flex flex-col gap-2 text-sm text-ocean/80">
      <span className="font-semibold tracking-wide text-ocean">{label}</span>
      <div className="relative">
        <input
          id={id as string}
          type="number"
          inputMode="decimal"
          className="w-full rounded-2xl border border-white/50 bg-white/80 px-4 py-3 text-base font-semibold text-ink shadow-inner focus:border-wave focus:outline-none focus:ring-2 focus:ring-wave/30"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step ?? 'any'}
          onChange={handleChange}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-ocean/70">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
};
