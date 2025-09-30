import { useMemo, useState } from 'react';
import { PredictabilityFlow } from './features/predictability/PredictabilityFlow';

interface ModuleDefinition {
  id: string;
  label: string;
  tagline: string;
  status: 'live' | 'beta' | 'alpha' | 'research' | 'soon';
}

const MODULES: ModuleDefinition[] = [
  {
    id: 'command',
    label: 'Command Center',
    tagline: 'Pipeline health, SLAs, and burst controls in one live cockpit.',
    status: 'alpha',
  },
  {
    id: 'predictability',
    label: 'Predictability',
    tagline: 'SKU-calibrated spend modeling with negotiation envelope automation.',
    status: 'live',
  },
  {
    id: 'activation',
    label: 'Activation',
    tagline: 'Campaign QA, content routing, and launch operations workflows.',
    status: 'soon',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    tagline: 'AI-assisted telemetry, share-of-wallet sensing, and market timing.',
    status: 'research',
  },
];

const STATUS_STYLES: Record<ModuleDefinition['status'], string> = {
  live: 'bg-foam text-midnight',
  beta: 'bg-wave text-midnight',
  alpha: 'bg-white/40 text-ocean',
  research: 'bg-midnight/20 text-white/80',
  soon: 'bg-white/20 text-white/70',
};

const STATUS_LABELS: Record<ModuleDefinition['status'], string> = {
  live: 'LIVE',
  beta: 'BETA',
  alpha: 'ALPHA',
  research: 'R&D',
  soon: 'SOON',
};

const ModulePlaceholder = ({ module }: { module: ModuleDefinition }) => (
  <div className="glass-card flex flex-col gap-6 p-8 text-ocean">
    <div className="flex items-center gap-3">
      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${STATUS_STYLES[module.status]}`}>
        {STATUS_LABELS[module.status]}
      </span>
      <h1 className="text-2xl font-semibold">{module.label}</h1>
    </div>
    <p className="max-w-xl text-sm text-ocean/70">{module.tagline}</p>
    <div className="glass-panel border-dashed border-ocean/30 bg-white/80 p-6 text-sm text-ocean/70">
      <p className="font-semibold text-ocean">Roadmap Signal</p>
      <p className="mt-2 leading-relaxed">
        The @marketing war machine keeps this lane under construction. Drop a scenario pack in Supabase with the
        <code className="mx-1 rounded bg-ocean/10 px-2 py-1 text-[0.75rem] font-semibold text-ocean">{module.id}</code>
        slug to light it up in this cockpit.
      </p>
    </div>
  </div>
);

export default function App() {
  const [activeModule, setActiveModule] = useState<string>('predictability');

  const module = useMemo(() => MODULES.find((item) => item.id === activeModule) ?? MODULES[0], [activeModule]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010A18] via-[#021B33] to-[#040F1F] pb-16 text-ink">
      <header className="bg-transparent px-6 py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.5em] text-wave/80">@marketing war machine</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">Revenue &amp; Pipeline Command Stack</h1>
          <p className="max-w-3xl text-sm text-white/70">
            Toggle between frontline command modules. Predictability merges the full revenue negotiation model so operators can
            calculate SKU-driven spend envelopes inside the same cockpit used for launch and pipeline acceleration.
          </p>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 lg:flex-row">
        <aside className="lg:w-80">
          <div className="glass-card flex flex-col divide-y divide-white/40 overflow-hidden">
            {MODULES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`flex flex-col items-start gap-2 px-6 py-5 text-left transition-all ${
                  item.id === activeModule
                    ? 'bg-gradient-to-r from-wave/20 via-white/70 to-foam/20 text-ocean shadow-lg'
                    : 'text-white/80 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] ${STATUS_STYLES[item.status]}`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                  <span className="text-sm font-semibold tracking-wide">{item.label}</span>
                </div>
                <p className="text-xs text-white/70">{item.tagline}</p>
              </button>
            ))}
          </div>
        </aside>
        <main className="flex-1 space-y-8">
          {module.id === 'predictability' ? <PredictabilityFlow /> : <ModulePlaceholder module={module} />}
        </main>
      </div>
    </div>
  );
}
