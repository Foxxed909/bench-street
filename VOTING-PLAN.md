# Vote-Driven Pricing: Archived Design Note

This document records the pricing direction chosen on 2026-06-14. It is retained for product
history, but the implementation has evolved since the original plan. For current behavior, use
[`README.md`](./README.md) and the pricing code as the source of truth.

## Original decision

- Play-money trading would remain for portfolios and profit/loss.
- Community votes, rather than trade demand, would move model prices.
- Each user would have one toggleable stance per model.
- The dormant `models.demand` field would no longer drive the quote.

## Current implementation

The shipped version supports one of three states per signed-in user and model: like, dislike, or
no vote. A model's quote is calculated from a quality-ranked opening baseline plus net community
sentiment:

```text
price units    = max(0, opening units + likes - dislikes)
per-vote value = $5 × clamp(0.5, 2.0, blended API $/Mtok ÷ 5)
share price    = price units × per-vote value
```

The implementation therefore differs from the first proposal in several important ways:

- dislikes can reduce a model's price;
- active models have a seeded opening line instead of a separate live “fundamental” price;
- API token cost scales the dollar value of a vote;
- prices are recomputed directly when votes or token-price signals change;
- trades do not move the quoted price.

## Shipped surface

- `votes` stores one stance per user/model.
- `POST /api/models/:slug/vote` toggles or switches that stance.
- model list/detail payloads expose current likes, dislikes, and the user's own stance;
- the Floor and model detail pages show community sentiment and price impact;
- Socket.io broadcasts price and tally changes;
- the trader leaderboard remains based on play-money net worth, not vote popularity.

## Security note

Administrator identities and credentials must be configured outside the repository. Production
admin access uses `ADMIN_USER_IDS`; production JWT signing requires a strong `JWT_SECRET`. Never
commit passwords, API keys, tokens, or deployment secrets. Any credential that has ever appeared
in Git history must be rotated because deleting it from the latest revision does not erase prior
commits.

## Local development

Run `npm run dev` for the API on port 4000 and the Vite client on port 5173. Development-only admin
usernames may be configured through `ADMIN_USERNAMES`; they are deliberately ignored in production.
