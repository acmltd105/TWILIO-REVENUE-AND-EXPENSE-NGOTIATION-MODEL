interface KpiCardProps {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'warning' | 'critical';
}

const toneClasses: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'from-white/70 via-white/90 to-white/70 text-ink',
  positive: 'from-foam/60 via-white/90 to-white/70 text-midnight',
  warning: 'from-amber-100 via-white to-white text-midnight',
  critical: 'from-rose-100 via-white to-white text-midnight',
};

export const KpiCard = ({ label, value, tone = 'default' }: KpiCardProps) => (
  <div
    className={`glass-panel flex flex-col gap-2 bg-gradient-to-br ${toneClasses[tone]} p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl`}
  >
    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ocean/80">{label}</span>
    <span className="text-2xl font-black">{value}</span>
  </div>
);
