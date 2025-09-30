import type { ReactNode } from 'react';

export interface FlowStep {
  label: string;
  description: string;
  status?: ReactNode;
}

interface FlowRailProps {
  steps: FlowStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export const FlowRail = ({ steps, activeIndex, onSelect }: FlowRailProps) => (
  <section className="glass-card flex flex-col gap-6 p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.4em] text-ocean/70">Predictability Flow</h2>
      <p className="text-xs text-ocean/60">Guided steps from demand design to executive outputs.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {steps.map((step, idx) => (
        <button
          key={step.label}
          type="button"
          onClick={() => onSelect(idx)}
          className={`group relative overflow-hidden rounded-3xl border transition-all ${
            idx === activeIndex
              ? 'border-wave/60 bg-gradient-to-br from-wave/30 via-white/80 to-foam/30 shadow-xl'
              : 'border-white/50 bg-white/70 hover:border-wave/40 hover:shadow-lg'
          }`}
        >
          <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="h-full w-full bg-gradient-to-br from-wave/20 via-transparent to-foam/20" />
          </div>
          <div className="relative flex h-full flex-col gap-3 p-5 text-left text-ocean">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-ocean/60">
              <span className="rounded-full bg-wave/20 px-3 py-1 text-ocean">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span>Step</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ocean/90">{step.label}</h3>
              <p className="text-sm text-ocean/70">{step.description}</p>
            </div>
            {step.status ? <div className="mt-auto text-xs font-semibold text-ocean/60">{step.status}</div> : null}
          </div>
        </button>
      ))}
    </div>
  </section>
);
