-- =====================================================================
-- Migo Store — Migration 021: Provenance feed moves into the store DB
-- Package: Provenance-feed privacy fix (self-inspection finding F-01 /
-- Gemini D-05, 2026-11-19).
--
-- Problem: the full provenance feed (supplier_key + exact cost_usd +
-- supplier listing_ref for every mapped product) was a static JSON
-- file committed to the PUBLIC GitHub repo and served from the public
-- site, because the Deno consumers (price-floor applier + store
-- executor registry) read it over HTTP. Anyone could read the store's
-- supplier map and exact margin structure. The filename token was
-- never real protection: the file sits in git history.
--
-- What this adds (additive only — no existing object is altered):
--   public.provenance_feed — a singleton table (one row, id = 1)
--   holding the exact same `migo-provenance` v1 document in a jsonb
--   column. The heartbeat publisher upserts that row on the same
--   cadence it used to republish the static file (dual-write during
--   the transition), and the Deno consumers read it via PostgREST
--   with the service-role key they already hold, falling back to the
--   published URL only while the switch is being proven.
--
-- Posture mirrors migration 017 / the wallet tables: RLS enabled with
-- NO policies — anon and authenticated roles see nothing; only the
-- service role (publisher + Deno backend) can read or write. The feed
-- document itself contains no credentials and must stay that way.
--
-- Switch-over (ordered, zero-impact; see the PR runbook):
--   1) apply this migration;
--   2) activate the publisher's dual-write (DB + GitHub);
--   3) verify this table is populated and fresh;
--   4) merge the consumer PR (DB-first read, URL fallback);
--   5) verify floors + executor live;
--   6) only then: delete the public prov-*.json from the repo, drop
--      the URL fallback and the hardcoded default URL constant.
-- =====================================================================

create table if not exists public.provenance_feed (
  id           integer     primary key check (id = 1),  -- singleton row
  feed         jsonb       not null,                    -- migo-provenance v1 document, verbatim
  generated_at timestamptz not null,                    -- == feed.generated_at (publisher-stamped)
  updated_at   timestamptz not null default now()
);

alter table public.provenance_feed enable row level security;

comment on table public.provenance_feed is
  'Singleton (id=1) provenance feed document (migo-provenance v1). '
  'Written by the provenance heartbeat publisher; read by the Deno '
  'price-floor applier and store executor via service role only. '
  'Replaces the formerly public static prov-*.json file (F-01/D-05).';
