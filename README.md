# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Seller auction workflow

Seller accounts get a private workspace for creating and managing their own auctions. A listing includes the item category, condition, description, one or more HTTP(S) photo URLs, starting price, bid increment, and closing date/time. Active listings without bids can be edited or cancelled.

When a seller next opens or refreshes the workspace after an auction closes, listings with bids move to **Awaiting your decision** and listings without bids are marked unsold. Sellers can approve or reject the highest bid, record handover notes, then mark an approved sale complete, record a failed pickup, or record a seller cancellation. Bid history and outcomes remain visible on the seller's listing.

Seller updates are checked while the workspace is open. Browser notifications are optional; select **Enable browser alerts** and grant the browser permission to receive pop-up notifications for new bids, auction closures, and recorded outcomes.

## Buyer auction workflow

Buyer accounts can browse active items, search and filter by keyword, category, condition, current price, or auctions closing within 24 hours. Listing cards show photos, starting price, minimum increment, current leading price, countdown, and public bid history. The API validates the starting-price and increment rules and rejects bids after closure.

The **My bids and purchase status** panel tracks each auction a buyer has participated in, including whether they are leading, outbid, awaiting seller approval, reserved, rejected, or affected by a pickup or seller-cancellation outcome. After an approved campus handover, the winning buyer can confirm collection there. Buyer activity refreshes while the workspace is open and can optionally raise browser notifications when permission is granted.

The buying assistant accepts simple item-and-budget requests such as “find me a cycle under ₹2,000”. Matching is performed locally from active listings and displays item names and bid prices without student account details. Buyers can separately opt in to automatic bidding on a listing by confirming a maximum amount. The API enforces that ceiling, the auction's minimum increment, close time, buyer role, and seller restrictions; proxy ceilings are shown publicly without account identifiers. The buyer can update or stop an active automatic bid at any time.

Buyers can post item-specific questions on active auctions, and the listing seller can post one public answer per question. Question length, duplicate submissions, and per-auction daily question limits are validated by the API; only the questioner's first name is shown publicly.

Buyers can also save up to 10 wanted-item alerts by keyword, optional category, and optional maximum price. Existing active listings are checked when an alert is created, and newly published listings are matched and saved to the buyer's account. Matches remain available when the buyer returns; optional browser pop-ups are checked while the buyer portal is open and permission is granted.

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
