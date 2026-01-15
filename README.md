# the-opportunities-scraper

Scrapes Facebook sources and writes opportunities into Google Sheets using Playwright (via a CDP endpoint) and the Google Sheets API.

## Requirements
- Node.js + pnpm
- A running CDP-compatible browser (e.g., Lightpanda) at `CDP_ENDPOINT`
- A Google service account with Sheets access

## Setup
1) Install dependencies:

```bash
pnpm install
```

2) Provide environment variables:
- `FB_EMAIL`
- `FB_PASSWORD`
- `SPREADSHEET_ID`
- `GOOGLE_CREDENTIALS` (base64-encoded service account JSON)
- `CDP_ENDPOINT` (optional, defaults to `ws://localhost:9222`)

## Run

```bash
pnpm start
```

## Notes
- Items are de-duplicated by URL against the `Items` tab.
- Source definitions and status live in the `Sources` tab of the target sheet.
