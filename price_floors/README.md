# Price-Floor Applier — store-side price propagation

**Branch:** `feature/price-floor-propagation` (base: MigoAi `main` @ `2d800f0e`)
**Status:** built + unit-tested; migration drilled on STAGING only. **Not merged, not published, no production writes.**

## Problem

The provenance registry re-bases a product's price to its floor —
`ceil(cost_usd × 82.5)` (margin ×1.5 at 55 EGP/USD) — atomically inside
`complete_failover`. But the store's own selling price (`catalog.price`
in the store Supabase project) never follows: it moves only by manual
edits. A failover or a plain cost rise that pushes a floor above the
store's current sell would silently sell at a loss — exactly the
2026-11-18 Grok incident (store 349 vs floor 384, fixed by hand).
The owner's rule is absolute: never sell at a loss; the displayed
price must always carry the margin.

## Design

- **Trigger — admin-gated endpoint, externally scheduled.**
  `POST /catalog/apply-price-floors` (header `x-migo-admin`, same
  `isAdmin` gate as `/exec/*` and `/wallet/*`). The Deno backend has
  **no internal scheduler**: every periodic flow in `api.ts` is an
  admin-gated endpoint driven from outside (the exec sweep every 20s
  by an external scheduler, the wallet endpoints by the VM deposit
  watcher). The applier follows that exact pattern — the rollout adds
  one step to that same external cadence. The run is idempotent and
  cheap (one RPC per mapped product), so cadence is not delicate.
- **Mapping — the provenance feed is the only source.**
  The applier consumes the same `migo-provenance` snapshot the store
  executor already trusts (`JsonRegistrySource`: feed name/version
  checked, snapshots older than 24h rejected — fail-closed). Each
  record carries `product_key` + `store_sku` + the active supplier's
  `cost_usd`; the `store_sku` values come from the explicit SKU map in
  the feed heartbeat (`provenance_heartbeat.py`), i.e. an inspectable,
  hand-maintained mapping — not a name guess. A product with no feed
  record is **unmapped** and can never be touched (see UNMAPPED list
  in the delivery report).
- **Floor — one formula, checked twice.**
  `floor = ceil(cost_usd × 82.5)`, computed in the applier with
  decimal-safe integer math (micro-USD; the naive float computation
  turns $1.20 into floor 100 instead of 99) and **recomputed exactly
  inside the database** by the RPC, which rejects any mismatched
  floor (`invalid_floor`). The formula was cross-verified against all
  15 registry re-bases actually performed on 2026-11-18 (Duolingo 123,
  Grok 384, Adobe 864, Claude Pro 1791, …).
- **Write path — one atomic, raise-only RPC (migration 017).**
  `apply_price_floor(...)` is the applier's only write. In one
  transaction, under a row lock: verify the floor, verify the SKU
  exists exactly once, `UPDATE catalog SET price = floor WHERE
  price < floor`, insert one `price_floor_audit` row. It is therefore
  **impossible to lower a price through this path**, whatever the
  caller sends. Merchant-chosen prices above the floor are intentional
  and are never touched (`already_at_or_above`).
- **Fail-closed everywhere.** Stale/unparseable feed → the whole run
  aborts, zero writes, error logged. Per record: missing SKU, missing
  or non-positive cost, duplicate `store_sku` in the feed,
  `margin_exception` (owner-documented exception, Google Student
  pattern), or `price_locked` (a failover is mid-flight and re-bases
  atomically itself) → skip + log, never guess. RPC anomalies
  (`sku_not_found`, `sku_ambiguous`, `invalid_floor`) are reported in
  the endpoint's JSON summary and in the central `error_log`.

## Files

| File | Change |
|---|---|
| `price_floors/mod.ts` | **New.** Applier core (`computeFloorEgp`, `runPriceFloorApplier`), PostgREST RPC client, `handlePriceFloorRequest`. |
| `price_floors/price_floors.test.ts` | **New.** 10 offline Deno tests incl. drill cases (a)–(d) against a fake client that mirrors migration 017 semantics. |
| `price_floors/migration_017_price_floor_audit.sql` | **New.** `price_floor_audit` table + `apply_price_floor` RPC (SECURITY DEFINER, service_role-only), additive only. |
| `api.ts` | **Edited, +40 lines.** Import, lazy deps getter (same `PROVENANCE_FEED_URL` + service key the executor uses), one route branch for `/catalog/` next to the wallet branch. Nothing else touched. |

## Production rollout (after review — none of this is done)

1. Apply `migration_017_price_floor_audit.sql` to **production**
   (`qjlivjzgrqyitqxcdtlk`) via the usual Management-API apply path.
2. Merge this branch to `main` (publishes the storefront + redeploys
   the Deno backend `migoai-72`; expect the usual promotion lag).
3. First supervised run: `POST /catalog/apply-price-floors` with the
   admin header, by hand; read the JSON summary and
   `price_floor_audit` — expect `raised: []` today (every mapped store
   price already sits at/above its floor after the 2026-11-18 fixes)
   and one `already_at_or_above` per mapped record.
4. Wire the trigger: add the endpoint to the external watcher cadence
   (a step in the VM deposit-watcher cycle, or its own systemd timer —
   owner's infra choice).
5. Optional follow-up (separate decision): extend the heartbeat SKU
   map so the active-but-unmapped products (ChatGPT Plus, CapCut,
   Claude Pro, Prime Video, LinkedIn, …) join the feed and come under
   the same protection.
