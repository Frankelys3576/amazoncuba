# Rulings made during the UUID v7 + seller-ownership implementation

**Branch:** `worktree-uuid-v7-migration` (21 commits from `2eab9c6`)
**Plan:** `docs/superpowers/plans/2026-08-24-uuid-v7-and-seller-ownership.md`
**Spec:** `docs/superpowers/specs/2026-08-24-uuid-v7-and-seller-ownership-design.md`

Every decision below was made without asking, because the process calls for rulings rather than
stalls. Each is listed with why, and with what it costs if it turns out wrong. **Anything here is
yours to reverse.** The ones most worth your attention are marked ⚑.

---

## Plan-structure rulings

**1. Reordered Task 10 (Prisma schema) before Tasks 7-9.**
As planned, the schema was regenerated last — but Tasks 7-9 all edit code typed against the
generated client and each ends with `tsc --noEmit`. Against the old schema (`BigInt` ids, no
`user_id`), `findUnique({ where: { user_id } })` does not compile. Executed in plan order, all three
tasks would have failed their own verification.
*Cost if wrong:* none identified — Task 10 depends only on the database, not on 7-9.

**2. Split Task 10 into a hand-edited schema now, `db pull` verification after the dry run.**
The schema had to exist for 7-9 to compile, but can only be *verified* against a migrated database.

**3. ⚑ Task 1 ships files only; its verification RUN moved into Task 4.**
Task 1's steps applied the generator function to a database and asserted against it. No non-production
copy exists, and applying it to production — even additive, unreferenced `create or replace function`
— is a schema mutation this session was not asked to make.
*Cost if wrong:* the generator stays unproven longer, so a bit-manipulation defect surfaces at dry run
rather than immediately. Nothing depends on it until then.

**4. Tasks 5 and 5b shipped as one dispatch.**
Both are Express edits of the same shape across disjoint files.
*Cost if wrong:* a defect in one blocks the other; they land in the same deployment anyway.

---

## Corrections to my own plan (defects I wrote)

**5. ⚑ Task 1's ordering assertion was wrong and was weakened.**
I wrote an assertion that full UUIDs must sort in generation order. RFC 9562 does not provide that —
v7 orders by its 48-bit millisecond prefix; the remaining 74 bits are random, so two ids minted in the
same millisecond sort arbitrarily. It was a **gate that fails on correct code**, and Task 4 depends on
that script passing, so it would have sent someone debugging a non-bug. The implementer caught it.

**6. Corrected my own brief's grep test.** It expected no `split('@')[0]` anywhere in the codebase,
which is the wrong test. The security-relevant claim is narrower: no *authorization* path derives a
store from an email.

---

## SQL-safety rulings

**7. ⚑ Made `001_uuid_v7_function.sql` self-sufficient (appended `notify pgrst`).**
It had been a separate step in a later task. If forgotten, the gate script fails at its first RPC with
a 404 that reads like a broken generator.
*Cost if wrong:* none — NOTIFY is harmless if nothing is listening.

**8. ⚑ Section G indexes use `create index if not exists`.**
Eight index names could collide with pre-existing hand-made indexes, and that is unverifiable from
here (`pg_indexes` lives in `pg_catalog`, which PostgREST does not expose). This database has been
maintained through loose `.sql` files for years, so a hand-made `products_store_id_idx` is plausible —
and it would abort the transaction *after* all the hard work succeeded.
*Cost if wrong:* an existing index with the same name but a different definition is silently kept. A
suboptimal index is a performance question; an aborted migration is an outage.

**9. ⚑ Added pre-flight assertions that nothing outside the nine tables depends on them.**
Three ways the migration could commit successfully while causing silent structural damage: a
view/matview over any of the nine silently repoints to `legacy_*` (reproduced — `pg_get_viewdef`
afterwards reads `SELECT p.legacy_id AS id`); an RLS policy does the same; an FK from an
un-inventoried `public` table is cascade-dropped and never recreated. **The evidence that "only 9
tables exist" came from PostgREST's OpenAPI, which omits relations lacking anon grants** — so it could
not rule this out.

---

## Security rulings

**10. ⚑⚑ OVERRODE a scope call to fix the `?ids=garbage` PII leak in Express.**
The implementer classified it pre-existing and out of scope. The first half was right — the old
integer code hits the identical path, so the UUID change does not worsen it. But the behaviour is that
`GET /api/orders?ids=garbage`, **unauthenticated**, returns every order, each carrying
`customer_name`, `customer_email`, `customer_phone`, `customer_address`. One malformed query parameter
dumps the customer database. "Pre-existing" is not a reason to knowingly leave a PII dump intact while
editing the lines directly above it.

**11. ⚑⚑ Ported that same fix to NestJS, overruling the same call more strongly.**
Express was already fixed, so shipping Nest without it means **the eventual cutover reintroduces a
hole we just closed.** That is not a pre-existing gap carried forward — it is a regression scheduled
for the cutover date.

**12. ACCEPTED leaving `register`'s email→phone fallback (`auth.controller.js:50`).**
Not part of the vulnerability: after this change `stores.phone` is not an authorization input at all,
so a store whose phone was defaulted from an email local part can no longer be claimed. Removing it
would change registration behaviour (stores created with no phone) — a product decision outside this
task.
*Recorded for follow-up:* this fallback is the mechanism that produced the junk the audit found —
**7 of 36 stores carry usernames or a WhatsApp URL in a publicly-displayed phone field.**

---

## Review-loop rulings

**13. Let minors ride along in three fix rounds** (Tasks 1, 2, 11) where they were one-line edits in a
file already open. Minors normally never enter the loop.

**14. ⚑ Escalated a "merely confusing output" finding in Task 2 above its severity label.**
The primary verification method for this entire migration is **diffing the before and after runs**. A
misleading numeric count in either run corrupts that diff — which is the one artifact a human uses to
decide whether the migration worked.

---

## Rulings made during the final review round

**15. Fixed in two sequential dispatches rather than in parallel.**
The file sets were disjoint (migrations vs NestJS vs frontends), but two agents committing in one
worktree race on the git index regardless.
*Cost if wrong:* wall-clock only.

**16. ⛑ ACCEPTED that `verify_integrity.mjs` hardcodes the eight FK constraint names** while the
migration now preserves whatever names production actually uses. If production named one differently,
the checker reports `ERROR` on a healthy database. We cannot enumerate production's real constraint
names from here — `pg_constraint` is not reachable through PostgREST — so the alternative was no check
at all. A false alarm gets investigated by a human standing at the console; a missing check is how C1
would have shipped silently. Cutover step 3b now captures the real names so they can be compared.

**17. ⛑ ACCEPTED that Express will serve the `legacy_*` columns to clients; filed as follow-up.**
Express spreads raw rows, so the new columns ride along; NestJS now strips them, so the two backends
disagree where they previously agreed. Not a crash (PostgREST returns bigint as a JSON number) and not
an exposure — `legacy_id` *is* the integer id that was public until cutover. It is rollback
scaffolding leaking into the API. Fixing it means touching every Express controller, which is more
than this branch should carry.

**18. ACCEPTED a gap in the migration's pre-flight.** Section 0 does not catch a foreign key whose
*referenced* column is renamed while its *child* column is not — a self-referential
`categories.parent_id` is the realistic shape. No such FK exists in the nine tables' known graph, and
section E aborts loudly with a type mismatch and rolls back completely, so it is safe. But it breaks
the pre-flight's "stop before a single column is touched" promise.
*Cost if wrong:* one aborted cutover attempt that rolls back cleanly.

---

## Deferred, with reasons

- `::bigint` rounds half-up, so a generated timestamp can be up to 0.5 ms ahead of `clock_timestamp()`.
  Harmless; recorded so it is not later mistaken for a defect.
- `legacy_id` keeps its identity sequence but loses the old PK's uniqueness — a rollback-doc note.
- The uuid-shape regex is duplicated in `orders.service.ts` and `stores.service.ts`. Consistent and
  test-covered; worth extracting in a cleanup pass.
- `products.service.findAll` 500s on a garbage `storeId`. **Verified as exact parity with Express**,
  which 500s identically — not a regression, and unlike the orders case it errors rather than leaking.
- REFERENCES privilege on `auth.users` and the backfill match rate: only a real database can answer
  these. They are explicit checks in Task 4.
