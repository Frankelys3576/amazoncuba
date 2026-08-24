# Assign an owner to a store

Use this when a seller cannot access their store because `stores.user_id IS
NULL`. A store with no `user_id` has **no seller access at all** after the
uuid v7 / seller-ownership migration (`backend/migrations/002_uuid_v7_migration.sql`,
section F) — there is no fallback authorization path.

This is a manual, operator-run SQL procedure, not an admin API endpoint, and
that is deliberate. There is no server-side admin authentication anywhere in
this codebase — `admin-frontend` stores a hardcoded `'master_token'` string
in `localStorage` that no server ever verifies (see `AdminAuth.jsx`). An
unauthenticated "assign store to user" endpoint would let anyone reassign
any store's ownership with one HTTP call — a total-compromise vulnerability
worse than the one this migration closes. Replace this runbook with an admin
UI once real admin auth (security finding #3) ships.

Work through the steps below in order, in the Supabase SQL editor for the
production project. Most steps are a query to run; step 3 is a manual,
out-of-band action with no SQL of its own.

Before running step 1, confirm you're actually looking at a migrated
database: if `user_id` doesn't exist yet on `public.stores`, step 1 will
fail with `column "user_id" does not exist` rather than silently returning
nothing — if you see that error, this runbook doesn't apply yet, stop and
check whether `backend/migrations/002_uuid_v7_migration.sql` has been run
against this environment.

## Why a store ends up unowned

Section F of the migration added `stores.user_id` and backfilled it using
the same heuristic the old login flow used to *authorize* requests: strip
`+` and spaces from the auth email's local part (the part before `@`) and
compare it directly to `stores.phone`. The backfill only writes `user_id`
when the match is **doubly unambiguous** — exactly one `auth.users` row
produces that local part, and exactly one `stores` row has that phone. Any
store that doesn't clear both conditions is left `NULL` on purpose, rather
than guessed at. In practice that means an unowned store falls into one of
a few buckets:

- **No matching account at all** — the store's `phone` doesn't correspond
  to any registered auth user's email local part (common for rejected or
  abandoned seed/test stores).
- **The phone is shared by more than one store row** — duplicate store
  records (e.g. old vs. legacy-domain re-registrations) collide on the
  same phone, so neither can be resolved automatically.
- **More than one account produces the same local part** — genuinely
  ambiguous; the migration cannot know which account owns the store.
- **A real, approved store whose registered email just doesn't match its
  stored phone** — e.g. the seller registered under a different phone
  number than the one on the store record. This is the case you're most
  likely handling under pressure: a legitimate seller, locked out, and the
  fix is a judgment call, not a query.

Knowing which bucket a store is in doesn't change the procedure below, but
it tells you what kind of evidence to expect when you go looking for the
right account — and it's worth checking whether the store is actually
rejected/dead before spending time chasing an owner for it.

## 1. Find the unowned store

```sql
select id, name, phone, status, user_id
from public.stores
where user_id is null
order by status, name;
```

Confirm the store you're being asked about is in this list, and check its
`status`. If `status = 'rejected'`, stop and confirm with whoever filed the
request that this store should be resurrected at all — most unowned stores
are rejected seed data, not locked-out sellers. A `pending` store is
handled the same as an `approved` one — pending just means it hasn't been
reviewed yet, not that it's suspect; don't treat it as a third case.

## 2. Find a candidate account

```sql
select id, email, created_at, last_sign_in_at
from auth.users
where email ilike '%<fragment>%'
order by created_at;
```

Replace `<fragment>` with something you already know about the seller —
part of their phone number, their name, or a snippet of the domain they
registered under. This is a starting point for investigation, not proof of
a match: it can return zero, one, or several rows.

## 3. Verify identity out of band

This is the actual hard part, and it is not something SQL can settle.

**Do not use `stores.phone` as proof that an `auth.users` row belongs to
this seller.** Matching on the phone-derived email local part is exactly
the authorization heuristic this migration removed, precisely because it
is spoofable and was already ambiguous for the stores sitting in this
runbook's queue. The phone column being right there, next to a
plausible-looking email, makes it tempting to treat as sufficient — it
isn't.

Instead, contact the seller through a channel you already trust (a phone
call to a number you have independent reason to believe is theirs, a
message on a WhatsApp thread you were already using with them, etc.) and
have them confirm the email address on the account you're about to assign.
Only proceed once you have that confirmation.

**If you cannot reach the seller, or they can't confirm which account is
theirs: leave `user_id` as `NULL` and stop.** Do not fall back to the
phone match because it's the only thing you have left, and do not guess.
The two failure modes here are not symmetric: an unowned store just means
the seller still can't log in — the same state they're already in, fully
recoverable the moment identity is confirmed. A *wrongly* owned store hands
a stranger full control of someone else's business, including the ability
to change the real owner's email and password and lock them out for good —
and nobody may notice until the real seller complains again. Waiting costs
time; guessing can cost the store permanently. Record the request (store
id, who asked, when, why identity couldn't be confirmed) and escalate to
whoever owns the seller relationship so it isn't silently dropped — don't
just let it sit unresolved with no trace that anyone looked at it.

## 4. Assign the owner

```sql
update public.stores
set user_id = '<auth-user-uuid>'
where id = '<store-uuid>'
  and user_id is null;
```

Replace `<auth-user-uuid>` with the `id` from step 2 (not the email) and
`<store-uuid>` with the `id` from step 1.

The `and user_id is null` guard is what makes this statement safe to run:
without it, a stale store id or a copy-paste mistake could silently
overwrite an existing owner. With it:

- **Expect `UPDATE 1`.** That means the store had no owner and now does.
- **`UPDATE 0` means the store already has an owner** (or the `id` you
  pasted doesn't match any unowned store). Stop — do not retry with the
  guard removed. Re-run the query in step 1 to see the store's current
  `user_id` and figure out why it's not `NULL` anymore before doing
  anything else.

`stores.user_id` also carries a `UNIQUE` constraint (`stores_user_id_key`),
so one account can own at most one store. If the account you're assigning
already owns another store, this `UPDATE` fails outright with a unique
constraint violation instead of silently attaching the same seller to two
stores or corrupting either row. If that happens, stop and re-check step 3
— you likely have the wrong account.

## 5. Confirm

```sql
select s.id, s.name, s.user_id, u.email
from public.stores s
join auth.users u on u.id = s.user_id
where s.id = '<store-uuid>';
```

This should return exactly one row, with `u.email` matching the address the
seller confirmed in step 3. Then have the seller log in and verify they can
see their store.
