import { useEffect, useMemo, useState } from "react";
import { ArrowPathIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

import { LiquidGlassCard } from "../../components/LiquidGlassCard";
import {
  getHealth,
  getInvoices,
  getNegotiation,
  triggerDemoNotification,
  type HealthPayload,
  type InvoiceSummary,
  type NegotiationPayload
} from "../../lib/api";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function NegotiationDashboard() {
  const [negotiation, setNegotiation] = useState<NegotiationPayload | null>(null);
  const [invoices, setInvoices] = useState<InvoiceSummary | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null);

  async function refreshAll() {
    setLoading(true);
    try {
      const [negotiationPayload, invoicePayload, healthPayload] = await Promise.all([
        getNegotiation(),
        getInvoices(),
        getHealth()
      ]);
      setNegotiation(negotiationPayload);
      setInvoices(invoicePayload);
      setHealth(healthPayload);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 30_000);
    return () => clearInterval(interval);
  }, []);

  const marginBands = useMemo(() => {
    if (!negotiation) return [];
    return [
      { label: "Target", value: negotiation.target_margin },
      { label: "Floor", value: negotiation.floor_margin },
      { label: "Ceiling", value: negotiation.ceiling_margin }
    ];
  }, [negotiation]);

  const handleNotification = async () => {
    try {
      const result = await triggerDemoNotification();
      setNotificationStatus(result.message);
    } catch (err) {
      setNotificationStatus(err instanceof Error ? err.message : "Failed to trigger notification");
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <LiquidGlassCard>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white/90">Negotiation Envelope</h2>
            <p className="text-sm text-slate-300">Supabase-backed financial insight</p>
          </div>
          <button
            className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/20"
            onClick={refreshAll}
          >
            <ArrowPathIcon className="h-4 w-4" /> Refresh
          </button>
        </div>
        {loading && <p className="mt-6 animate-pulse text-slate-300">Loading insights...</p>}
        {error && <p className="mt-6 text-rose-400">{error}</p>}
        {negotiation && !loading && !error && (
          <div className="mt-6 space-y-4 text-sm text-slate-200">
            <div className="grid grid-cols-2 gap-4">
              <Metric label="Revenue" value={negotiation.revenue} prefix={negotiation.currency} />
              <Metric label="Expense" value={negotiation.expense} prefix={negotiation.currency} />
              <Metric label="Target Discount" value={negotiation.target_discount} format={formatPercent} />
              <Metric label="Current Margin" value={negotiation.current_margin} format={formatPercent} />
            </div>
            <div className="flex flex-wrap gap-3">
              {marginBands.map((band) => (
                <span
                  key={band.label}
                  className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium"
                >
                  {band.label}: {formatPercent(band.value)}
                </span>
              ))}
            </div>
          </div>
        )}
      </LiquidGlassCard>

      <LiquidGlassCard>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white/90">Invoices</h2>
            <p className="text-sm text-slate-300">Trailing performance overview</p>
          </div>
        </div>
        {invoices && (
          <div className="mt-6 space-y-4 text-sm text-slate-200">
            <Metric label="Outstanding" value={invoices.totals.total} prefix={invoices.totals.currency} />
            <p className="text-xs text-slate-300">{invoices.totals.count} invoices tracked</p>
            <div className="max-h-48 space-y-2 overflow-y-auto pr-2">
              {invoices.invoices.map((invoice) => (
                <div
                  key={String(invoice.invoice_id)}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2"
                >
                  <span className="text-xs uppercase tracking-wide text-slate-300">
                    {invoice.period_start} → {invoice.period_end}
                  </span>
                  <span className="text-sm font-semibold text-white/90">
                    {invoices.totals.currency} {Number(invoice.amount_usd).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </LiquidGlassCard>

      <LiquidGlassCard>
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-white/90">Operational Health</h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-slate-200">
            <StatusPill label="Supabase" active={health?.supabase_online ?? false} />
            <StatusPill label="Twilio" active={health?.twilio_online ?? false} />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Queued Notifications</p>
              <p className="text-lg font-semibold">{health?.cached_notifications ?? 0}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Last Refresh</p>
              <p className="text-lg font-semibold">
                {health ? new Date(health.generated_at).toLocaleTimeString() : "—"}
              </p>
            </div>
          </div>
          <button
            onClick={handleNotification}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-400/90 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-glass transition hover:bg-emerald-300"
          >
            <PaperAirplaneIcon className="h-5 w-5" /> Send Demo Notification
          </button>
          {notificationStatus && <p className="text-xs text-slate-200">{notificationStatus}</p>}
        </div>
      </LiquidGlassCard>
    </div>
  );
}

function Metric({
  label,
  value,
  prefix,
  format
}: {
  label: string;
  value: number;
  prefix?: string;
  format?: (value: number) => string;
}) {
  const displayValue = format ? format(value) : `${prefix ?? ""} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-white/90">{displayValue}</p>
    </div>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-xs uppercase tracking-widest text-slate-400">{label}</span>
      <span
        className={`inline-flex items-center gap-2 text-sm font-semibold ${
          active ? "text-emerald-300" : "text-rose-300"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-300" : "bg-rose-400"}`}
        ></span>
        {active ? "Operational" : "Degraded"}
      </span>
    </div>
  );
}
