# supabase/baseline

What production's schema actually looks like — reconstructed from the live
catalog, not from the migration log.

| File | What it is |
|---|---|
| `20260809_schema_baseline.sql` | Full schema snapshot of `zyfkjxepykwpfzmkxitb`, in replay order |
| `DRIFT-REPORT-2026-08-09.md` | Which migrations are applied, which are committed, and where they disagree |

## Why this is not in `supabase/migrations/`

The 79 files in `supabase/migrations/` still replay from an empty database. A
baseline sitting beside them would double-apply. This directory is the
reference for what production really is, and the starting point if the
migration history is ever formally rebased.

## Read this before trusting it

The baseline is a **snapshot**, true as of its capture date. It goes stale the
moment someone changes the schema without committing a migration — which is the
exact habit that made it necessary. Re-capture it, or better, keep it
unnecessary by committing migrations as you go.

It covers the `public` schema only. Not included: `auth`/`storage` objects
(Supabase-managed), table data, Vault secrets, and edge-function bodies.

## Regenerating

Two queries, run against the project with the Supabase MCP. Each returns one
big text column; both spill to a tool-results file, and the two payloads are
concatenated under a header.

**Part 1 — extensions, tables, constraints, indexes:** a CTE per object class.
Tables are rebuilt from `pg_attribute` + `pg_attrdef` (name, `format_type`,
default, not-null); constraints from `pg_get_constraintdef` ordered
primary → unique → check → foreign so they replay cleanly; indexes from
`pg_indexes`, skipping any index that backs a constraint.

**Part 2 — functions, triggers, RLS, policies, grants, cron:** `pg_get_functiondef`
(filtered to `prokind in ('f','p')` — it errors on aggregates), `pg_get_triggerdef`,
`relrowsecurity` for the RLS toggles, `pg_policies` reassembled into
`create policy`, `role_table_grants` for anon/authenticated/service_role, and
`cron.job`.

The full query text is in the commit that added this directory.

## Verifying a fresh capture

Count objects in the output and compare against the live catalog. At the
2026-08-09 capture these agreed exactly:

| Object | Count |
|---|---|
| Tables | 73 |
| Constraints | 314 |
| Non-constraint indexes | 116 |
| Functions | 202 |
| Triggers | 59 |
| Tables with RLS enabled | 73 |
| Policies | 194 |
| Extensions (excl. `plpgsql`) | 7 |
| Cron jobs | 6 |
| Views / sequences / enums | 0 |

If a count comes back lower than expected, suspect a silently-dropped aggregate
in the function CTE or a constraint-index filter that matched too much.
