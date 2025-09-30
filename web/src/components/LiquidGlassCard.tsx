import { PropsWithChildren } from "react";

export function LiquidGlassCard({ children }: PropsWithChildren) {
  return (
    <section className="rounded-3xl border border-white/10 bg-glass-dark/40 p-6 shadow-glass backdrop-blur-xl">
      <div className="rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-xs">
        {children}
      </div>
    </section>
  );
}
