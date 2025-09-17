# Dashboard Overview (Sanitized)

## Purpose
Provide a snapshot of Twilio usage metrics relevant to the ongoing revenue and expense negotiation, without exposing sensitive identifiers or customer data.

## Key Widgets
1. **Usage Trendline**
   - Shows daily messaging volume for the trailing 90 days.
   - Data points aggregated and anonymized before export.
2. **Cost vs. Budget Gauge**
   - Visual comparison of monthly spend against approved budget envelope.
   - Gauge thresholds sourced from finance planning sheet (values redacted).
3. **Invoice Dispute Tracker**
   - Highlights invoices flagged for review, linked by masked IDs (e.g., `INV-2024-03`).
   - Includes status indicators for finance, legal, and vendor follow-up.
4. **Service Reliability KPIs**
   - API uptime, delivery success rate, and average call connection time.
   - Incident references anonymized; root cause reports stored separately.

## Access & Security
- Dashboard hosted in the internal BI workspace with SSO-only access.
- Exports shared through secure, expiring links—none are embedded in this repository.
- Raw datasets omit customer-identifying information before ingestion.

## Next Steps
- Integrate negotiation-specific tags to isolate cost centers affected by proposed terms.
- Schedule automated weekly exports (sanitized) to feed negotiation briefing packets.
