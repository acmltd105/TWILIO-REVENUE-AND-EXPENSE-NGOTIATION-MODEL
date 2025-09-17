# Ship Checklist

Follow this checklist before announcing the dashboard as production-ready.

1. **Validate data sources**
   - Confirm latest invoices are in `invoices/csv/` and rerun `python3 invoice_rollup.py`.
   - Spot check the generated `invoices/trailing_90_usd.txt` against finance numbers.
2. **Exercise dashboards**
   - Open `/docs/Twilio_Exec_Dashboard_PRO.html` locally and verify KPIs update as you type.
   - Use the trailing-90 input to show the jump from Tier A (32%) to Tier B (37%) and Tier C (45%).
   - Launch `/docs/Twilio_Exec_Dashboard_SHINY.html` and confirm SKU table renders.
3. **Static asset sweep**
   - Run `python -m json.tool docs/twilio_sku_catalog.json`.
   - Run `npx prettier --check "docs/**/*.{html,md,json}"` if Node is available.
4. **Automation**
   - Ensure GitHub Actions secrets are configured (`SLACK_WEBHOOK_URL`).
   - Trigger the Slack notifier manually via the Actions tab.
5. **Pages deployment**
   - Push to `main` and confirm the `Deploy Pages` workflow completes successfully.
   - Visit the live URL (`https://<you>.github.io/<repo>/`) and run the landing page sanity checks listed in `docs/README.md`.
6. **Communications**
   - Replace `<YOUR PAGES URL>` in `docs/email_final.txt` with the live site.
   - Send the board memo email with the dashboard link and attach any supplemental files.

When each item is checked, you are cleared to announce "SHIP IT".
