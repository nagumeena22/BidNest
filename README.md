# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Seller auction workflow

Seller accounts get a private workspace for creating and managing their own auctions. A listing includes the item category, condition, description, one or more HTTP(S) photo URLs, starting price, bid increment, and closing date/time. Active listings without bids can be edited or cancelled.

When a seller next opens or refreshes the workspace after an auction closes, listings with bids move to **Awaiting your decision** and listings without bids are marked unsold. Sellers can approve or reject the highest bid, record handover notes, then mark an approved sale complete, record a failed pickup, or record a seller cancellation. Bid history and outcomes remain visible on the seller's listing.

Seller updates are checked while the workspace is open. Browser notifications are optional; select **Enable browser alerts** and grant the browser permission to receive pop-up notifications for new bids, auction closures, and recorded outcomes.

## Buyer auction workflow

Buyer accounts can browse active items, search and filter by keyword, category, condition, current price, or auctions closing within 24 hours. Listing cards show photos, starting price, minimum increment, current leading price, countdown, and public bid history. The API validates the starting-price and increment rules and rejects bids after closure.

The **My bids and purchase status** panel tracks each auction a buyer has participated in, including whether they are leading, outbid, awaiting seller approval, reserved, rejected, or affected by a pickup or seller-cancellation outcome. After an approved campus handover, the winning buyer can confirm collection there. Buyer activity refreshes while the workspace is open and can optionally raise browser notifications when permission is granted.

The buyer workspace includes an **AI Assistant** tab for natural-language searches, category/condition/price/closing filters, comparisons, current auction details, and public bid history. Groq interprets a bounded recent conversation on the backend; the application—not the model—queries MongoDB and returns the authoritative listing cards. Results include actual item photos, condition, current leading price, minimum increment, and closing time. A budget filter checks that the next valid bid can fit within that amount. No matching items are reported explicitly, and listing descriptions are treated as untrusted data.

The assistant never bids from chat. To bid, select an auction, enter an exact bid and optional maximum budget, review the server-generated preview, then explicitly confirm that exact amount. The backend stores a short-lived, single-use confirmation, verifies the same user's confirmation, rechecks auction status, price, increment, close time, and budget, then submits through the shared auction bid service. If anything changes, the confirmation is rejected and must be prepared again. Existing automatic proxy bidding remains a separate marketplace opt-in; the AI Assistant does not create or activate proxy bids. Recent chat text is sent to Groq for intent extraction, so students should not include passwords or sensitive account information.

Buyers can post item-specific questions on active auctions, and the listing seller can post one public answer per question. Question length, duplicate submissions, and per-auction daily question limits are validated by the API; only the questioner's first name is shown publicly.

Buyers can also save up to 10 wanted-item alerts by keyword, optional category, and optional maximum price. Existing active listings are checked when an alert is created, and newly published listings are matched and saved to the buyer's account. Matches remain available when the buyer returns; optional browser pop-ups are checked while the buyer portal is open and permission is granted.

## Groq AI Assistant setup

The Groq SDK is used only by the Express backend. The default model is `openai/gpt-oss-120b`; set `GROQ_MODEL` to another currently supported Groq model if needed. See [Groq's model catalog](https://console.groq.com/docs/models) and [deprecation guidance](https://console.groq.com/docs/deprecations). Never put `GROQ_API_KEY` in the frontend or commit a real key.

1. Install frontend and backend dependencies:

   ```powershell
   npm install
   npm install --prefix server
   ```

2. From the repository root, copy the safe backend template and edit `server/.env` with your own MongoDB URI, JWT secret, and Groq key:

   ```powershell
   Copy-Item server\.env.example server\.env
   ```

   Set `GROQ_API_KEY` to a Groq API key and, optionally, `GROQ_MODEL`. The checked-in `server/.env.example` contains placeholders only.

3. Run the backend from the `server` directory and the Vite frontend from the repository root, in separate terminals:

   ```powershell
   Set-Location server
   npm run dev
   ```

   ```powershell
   npm run dev
   ```

4. Run the focused backend tests and builds:

   ```powershell
   npm test --prefix server
   npm run build --prefix server
   npm run build
   npm run lint
   ```

## Manual AI assistant checks

- Sign in as a verified buyer, open **AI Assistant**, and search for a real category and budget (for example, “Find me a cycle under ₹2,000”). Verify every result matches the actual listing, has the real photo/current bid/increment/closing time, and is linked to its marketplace card.
- Try a category, condition, minimum/maximum price, “closing soon”, comparison, and a query with no matching items.
- Choose a result, ask for its current bid and public history, and verify those details against its auction card. Confirm no email, phone, roll number, or account ID is returned by assistant responses.
- Use **Prepare a bid** with a valid amount, review the current-value preview, then explicitly confirm the exact amount. Try a too-low amount and a bid above the optional maximum.
- Prepare a bid, change the auction price from another buyer/session before confirming, and verify confirmation is rejected with a fresh-review message. Retry the same confirmation and verify it cannot place a duplicate bid.
- Try an expired/closed auction, a seller account, an unauthenticated request, and repeated requests past the per-user API rate limit.
- Deny or grant browser notification permission in the existing buyer activity panel; assistant chat itself does not require notification permission.

The live Groq/MongoDB checks require valid backend credentials and active database listings; automated unit tests cover deterministic filter validation, conversation bounds, empty results, and bid minimum calculations. The default rate limiter is process-local; use a shared store if deploying multiple API instances.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
