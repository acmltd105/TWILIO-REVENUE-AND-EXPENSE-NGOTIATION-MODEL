# Twilio Executive Dashboard Package

This `/docs` folder powers the GitHub Pages site for the Twilio revenue and expense negotiation model. It includes:

- **Landing page (`index.html`)** with quick links to dashboards, collateral, and automation.
- **PRO dashboard** for live scenario modeling during negotiations.
- **SHINY dashboard** for executive read-outs.
- **SKU catalog JSON** that hydrates both dashboards.
- **Contract and communications collateral** ready for distribution.

## Pre-flight checks
Before sharing the site, run through this quick list:

1. Update `docs/twilio_sku_catalog.json` if pricing or tiers shift.
2. Drop the latest invoice CSVs into `invoices/csv/` and run `python3 invoice_rollup.py`.
3. Confirm `invoices/trailing_90_usd.txt` matches finance’s trailing-90 value.
4. Validate the dashboards render locally by running `python3 -m http.server` from the repo root and visiting `http://localhost:8000/docs/`.
5. Inspect the browser console for `Catalog SKUs:` output when opening the PRO dashboard.
6. Download the amendment and email files to ensure GitHub Pages serves them without MIME warnings.
7. Run `python -m json.tool docs/twilio_sku_catalog.json` to confirm the catalog is valid JSON.
8. If the Slack notifier is enabled, trigger `Workflow Dispatch` manually once to confirm the webhook fires.
9. Toggle the trailing-90 input in the PRO dashboard to demonstrate the tier transition from 32% → 37% → 45%.
10. Replace `<YOUR PAGES URL>` inside `docs/email_final.txt` before sending.

## Deployment
1. Commit changes to `main`.
2. Ensure GitHub Pages is enabled with Source **main** and Folder **/docs**.
3. Wait for the **Deploy Pages** GitHub Action to finish (usually < 2 minutes).
4. Verify the live site, then send the prepared email to stakeholders.

## Support
- Use the Slack notifier workflow (`.github/workflows/slack-tier.yml`) with the `SLACK_WEBHOOK_URL` secret for daily tier updates.
- Questions or tweaks? Update the HTML/JSON files and push again—GitHub Pages will redeploy automatically.
