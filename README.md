# Family Grocery

An offline-capable shopping list for a household, built for use on your
phone. Multiple devices stay in sync automatically.

Built with Vue 3 + Vite (PWA) and a Cloudflare Worker + D1 backend. Full
design notes: [docs/specs.md](docs/specs.md).

## Why

Grocery shopping is faster when you walk each store once, in one direction,
instead of backtracking through aisles. The idea here is simple: define each
store's zones in the order you actually walk them, then place every product
in the zone it's shelved in — including the same product in a different zone
for a different store, since layouts vary. Pick a store while shopping, and
your list reorders itself to match that store's walk, zone by zone.

This is a small, non-commercial hobby project built to solve that one problem
for personal/family use — not a product, just a tool that's shared as-is in
case it's useful to someone else too.

## Run it locally

No Cloudflare account or deployment is required to try the app, or to develop
on it:

```bash
npm install
cp wrangler.toml.example wrangler.toml
cp .dev.vars.example .dev.vars    # for development, edit AUTH_SECRET too
npm run db:migrate:local          # create/upgrade the local database
npm run dev                       # Vite on :5173, Worker + D1 on :8787
```

Open **http://localhost:5173**. This runs the full app — UI and API — on your
machine; the first load asks you to choose a password. A deployed instance
(see below) is also a normal website: opening its URL in any browser works
exactly the same way. "Add to Home Screen" (in Settings) is optional — it
makes the app feel native and work offline, but isn't required to use it.

`wrangler.toml` and `.dev.vars` are your own local files — both are
git-ignored, so nothing you put in them (including your real database id)
ever shows up as a change to commit. Only the `.example` versions, with
placeholder values, are tracked.

## Deploy to your own Cloudflare account

Every deployment is fully independent: your own Worker, your own database,
your own password. Nothing from one deployment is shared with another.

**Requirements:** [Node.js](https://nodejs.org) 18 or later, and a free
[Cloudflare](https://dash.cloudflare.com/sign-up) account.

```bash
npm install
npx wrangler login
npm run setup
```

`npm run setup` runs an interactive script that does everything else, asking
before each step:

1. Creates the database and applies its schema.
2. Generates the secret that protects the password.
3. Builds and deploys the app.
4. Asks you to choose the password, and whether to load a small example
   catalog (a couple of stores and products) so there's something to look at
   immediately, or start empty.

When it finishes, it prints the app's URL. Open it and sign in.

The script is safe to re-run — it detects what's already set up and skips it.
To do any step manually instead, see [scripts/setup.mjs](scripts/setup.mjs);
every step there is a single, ordinary `wrangler` command.

### Choosing your app's address

Every Worker gets a free address in the form
`<name>.<your-subdomain>.workers.dev`.

- **`<name>`** — edit the `name` field at the top of your local
  `wrangler.toml` (e.g. `name = "smith-family-list"`; see
  [wrangler.toml.example](wrangler.toml.example) for the full file), then
  redeploy with `npm run deploy`. Cloudflare treats this as a distinct Worker,
  so run `npm run setup` again afterward to set its secret and password — your
  data is untouched, since it's still the same database.
- **`<your-subdomain>`** — this belongs to your Cloudflare account, not to
  this app. Change it once, for every Worker on the account, from the
  Cloudflare dashboard under **Workers & Pages → your subdomain**.
- Already own a domain? Cloudflare Workers can be attached to it for free,
  from the Worker's **Settings → Domains & Routes**.

None of this requires purchasing anything new.

### Deploying a shareable demo

To hand a second, disposable copy to friends — its own Worker, database, and
password — run:

```bash
npm run setup:demo
```

Pick a throwaway password when asked, since this instance is meant to be
shared. Redeploy any time with `npm run deploy:demo`.

## Changing the password

There's no "change password" screen in the app — `/api/setup` only ever
works once. To set a new one on an already-configured instance:

```bash
npm run reset-password -- <newPassword> <url>
npm run reset-password:demo -- <newPassword> <url>   # for the demo instance
```

This clears the old password and claims the new one in one step; it asks
for confirmation first. Devices already signed in stay signed in — only new
logins need the new password.

## Building your shopping catalog

### Import and export

**Settings → Catalog** lets you export the whole catalog as JSON, and import
it back — or import a plain list of product names (one per line, optionally
`name, qty, note`).

Importing offers a **Replace** option: leave it unchecked to merge with what's
already there (existing stores and products are matched by name, not
duplicated), or check it to clear the current catalog first and start clean
from the imported data.

### Generating a catalog with AI

You can ask an AI assistant (ChatGPT, Claude, or similar) to write the import
JSON for you. Give it a prompt like this:

> Write JSON matching exactly this shape, with no other text in your reply:
>
> ```json
> {
>   "stores": [{ "name": "string", "aisles": ["string", "..."] }],
>   "products": [
>     {
>       "name": "string",
>       "qty": "string, optional",
>       "note": "string, optional",
>       "needed": true,
>       "stores": ["Store name", "Store name: Aisle name"]
>     }
>   ]
> }
> ```
>
> My stores and aisles: Lidl (Produce, Bakery, Dairy, Frozen), Costco (Dry
> goods, Fridge wall). Generate 25 common household grocery items, placed in
> the store and aisle where each is normally found. Mark milk, eggs, and bread
> as needed.

Paste the reply into **Settings → Catalog → Import** — using Replace or not,
as above. Imports are capped at 2,000 items at a time.

## Available scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Web and API dev servers together |
| `npm run build` | Type-check and build the PWA to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm test` | Worker and sync tests (Vitest, real Worker runtime + D1) |
| `npm run setup` / `setup:demo` | Guided Cloudflare deployment (see above) |
| `npm run deploy` / `deploy:demo` | Build, then `wrangler deploy` |
| `npm run db:migrate:local` / `:remote` / `:demo` | Apply database migrations |
| `npm run seed` | Load an example catalog into a running instance |
| `npm run reset-password` / `reset-password:demo` | Set a new password on an already-configured instance |

## Project layout

```
index.html              Vite entry (PWA meta, manifest link)
src/
  screens/              one component per screen (Shop, Products, Stores, Store, Login)
  components/           BottomSheet, ShopRow, QuickAddBar, sheets, TabBar, …
  stores/               Pinia: data (IndexedDB mirror), sync, auth, app, shop
  lib/                  idb, repo, sync engine, domain mutations, shopping view, composables
  styles/tokens.css     design tokens (light/dark)
shared/types.ts         types shared between client and Worker
worker/                 Cloudflare Worker — /api/{health,setup,auth,sync}
migrations/             database schema migrations
scripts/                setup.mjs, seed.mjs, reset-password.mjs, PWA icon generation
test/                   Vitest (@cloudflare/vitest-pool-workers)
wrangler.toml.example   tracked template — copied to your own, git-ignored wrangler.toml
```

## Security notes

- The password is never stored — only a keyed hash, verified against a secret
  held by Cloudflare (see `worker/auth.ts`).
- `/api/auth` and `/api/setup` are rate-limited to 10 requests/minute per
  visitor, every other API route to 200/minute.
- An optional `SETUP_KEY` secret locks `/api/setup` so only you can claim the
  password right after deploying; `npm run setup` offers to set one.
- Staying on Cloudflare's free plan (or setting a spending limit if you're on
  a paid one) means an abusive burst of traffic can only ever produce a day of
  rejected requests — never a bill.

## Before sharing this repository

- Confirm `.dev.vars` and `wrangler.toml` were never committed —
  `git ls-files | grep -E 'dev\.vars$|^wrangler\.toml$'` should print nothing
  (only the `.example` versions are meant to be tracked).
- Confirm `scripts/seed.mjs`'s default password is still the generic
  placeholder, not a real one you use anywhere.

## License

[MIT](LICENSE) — free to use, modify, and deploy for your own household.
