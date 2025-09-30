import { money, percentDisplay } from '../lib/format';

interface HeroProps {
  trailing90: number;
  skuCount: number;
  activeTier: 'A' | 'B' | 'C';
  discount: number;
  mode: string;
  error?: string | null;
  onOpen: () => void;
}

const LogoOrb = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`logo-orb relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/70 shadow-2xl ${className}`}
  >
    <div className="absolute inset-0 animate-pulseSlow bg-gradient-to-br from-white/40 via-transparent to-white/10" />
    <div className="relative z-10 text-white">{children}</div>
  </div>
);

export const Hero = ({ trailing90, skuCount, activeTier, discount, mode, error, onOpen }: HeroProps) => (
  <section className="hero-gradient relative overflow-hidden rounded-[32px] border border-white/20 p-10 text-white shadow-2xl">
    <div className="absolute -left-32 -top-28 h-64 w-64 rounded-full bg-wave/20 blur-3xl" />
    <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-foam/20 blur-3xl" />
    <div className="relative z-10 flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-6">
          <LogoOrb className="animate-float">
            <svg viewBox="0 0 64 64" className="h-16 w-16">
              <circle cx="32" cy="32" r="30" fill="rgba(255,255,255,0.12)" stroke="white" strokeWidth="2" />
              <circle cx="24" cy="26" r="6" fill="white" />
              <circle cx="42" cy="38" r="4" fill="white" />
              <path d="M18 46c7-6 19-6 28-12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </LogoOrb>
          <LogoOrb className="animate-float delay-150">
            <svg viewBox="0 0 64 64" className="h-16 w-16">
              <circle cx="32" cy="32" r="30" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="2" />
              <path
                d="M20 22h24v6H20zm0 10h24v6H20zm0 10h16v6H20z"
                fill="white"
                className="animate-pulseSlow"
              />
            </svg>
          </LogoOrb>
        </div>
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-black tracking-tight">Executive Negotiation Dashboard — PRO</h1>
          <p className="text-lg text-white/80">
            Ground the portfolio conversation in 120 verified Twilio SKUs, live trailing spend, and an automated negotiation envelope.
            Start with the Fortune-grade blue / green liquid glass aesthetic and flex between Supabase or local persistence automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-white/80">
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full bg-white/90 px-5 py-2 text-ink shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            ▶ Open Live Model
          </button>
          <span className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">SKUs: {skuCount}</span>
          <span className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">Tier {activeTier}</span>
          <span className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">
            Ask Discount {percentDisplay(discount, 1)}
          </span>
          <span className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">
            Trailing 90 {money(trailing90)}
          </span>
          <span className="rounded-full bg-white/10 px-4 py-2 backdrop-blur">Scenario mode: {mode}</span>
        </div>
        {error ? <p className="text-sm font-semibold text-red-100">{error}</p> : null}
      </div>
      <div className="glass-card relative flex max-w-md flex-col gap-6 p-6 text-ink">
        <h2 className="text-lg font-bold uppercase tracking-[0.3em] text-ocean">Enforcement</h2>
        <ul className="space-y-3 text-sm text-ocean/80">
          <li>• Automatic 120-SKU validation before render.</li>
          <li>• Negotiation API fallback protects executive demos.</li>
          <li>• Supabase scenario persistence with local failover.</li>
          <li>• Animated DPCyeah &amp; Twilio marks maintain on-brand polish.</li>
        </ul>
      </div>
    </div>
  </section>
);
