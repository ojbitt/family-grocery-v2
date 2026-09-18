// Seed the local dev database with example stores, aisles, products and a
// starter shopping list. Idempotent — stable ids, so re-running just upserts.
//
//   npm run dev                       # in another terminal (API on :8787)
//   node scripts/seed.mjs [--fresh] [password] [apiBase] [setupKey]
//
// --fresh first tombstones every existing row (clean slate), then seeds.
// Defaults: password "dev-seed-password" (local/dev only — never reuse a real
// family password here, this file is committed to git), apiBase http://localhost:8787
// setupKey is only needed if the instance has a SETUP_KEY secret set (see README).

const args = process.argv.slice(2);
const FRESH = args.includes('--fresh');
const rest = args.filter((a) => a !== '--fresh');
const PASSWORD = rest[0] || 'dev-seed-password';
const API = (rest[1] || 'http://localhost:8787').replace(/\/$/, '');
const SETUP_KEY = rest[2];

// Filled in at send time — must be after any --fresh tombstones so LWW keeps the seed.
let stamp = Date.now();
const row = (o) => ({ deleted: 0, ...o, updated_at: stamp });

// --- stores + aisles (aisles in walking order via `position`) ---
const stores = [
  row({ id: 'store_lidl', name: 'Lidl' }),
  row({ id: 'store_costco', name: 'Costco' }),
];

const areas = [
  row({ id: 'area_lidl_produce', store_id: 'store_lidl', name: 'Produce', position: 1 }),
  row({ id: 'area_lidl_bakery', store_id: 'store_lidl', name: 'Bakery', position: 2 }),
  row({ id: 'area_lidl_dairy', store_id: 'store_lidl', name: 'Dairy', position: 3 }),
  row({ id: 'area_lidl_frozen', store_id: 'store_lidl', name: 'Frozen', position: 4 }),
  row({ id: 'area_lidl_checkout', store_id: 'store_lidl', name: 'Checkout', position: 5 }),
  row({ id: 'area_costco_entry', store_id: 'store_costco', name: 'Entrance', position: 1 }),
  row({ id: 'area_costco_dry', store_id: 'store_costco', name: 'Dry goods', position: 2 }),
  row({ id: 'area_costco_fridge', store_id: 'store_costco', name: 'Fridge wall', position: 3 }),
];

// --- products (a spread of every variant: qty only / note only / both / neither) ---
const P = (id, name, extra = {}) =>
  row({ id, name, default_qty: null, note: null, ...extra });
const products = [
  P('prod_milk', 'Milk', { default_qty: '2 L', note: 'semi-skimmed' }), // qty + note, multi-store
  P('prod_eggs', 'Eggs', { default_qty: '12' }), // qty only, multi-store
  P('prod_bread', 'Bread', { note: 'sourdough' }), // note only
  P('prod_apples', 'Apples', { default_qty: '6', note: 'green, firm' }), // qty + note
  P('prod_bananas', 'Bananas', { default_qty: '1 bunch' }), // qty only
  P('prod_tomatoes', 'Tomatoes'), // plain
  P('prod_butter', 'Butter', { note: 'unsalted' }), // note only
  P('prod_yoghurt', 'Yoghurt', { default_qty: '4', note: 'plain, big pots' }), // qty + note
  P('prod_peas', 'Frozen peas'), // plain
  P('prod_chicken', 'Chicken breast', { default_qty: '500 g', note: 'free-range' }), // qty + note, multi-store
  P('prod_rice', 'Basmati rice', { default_qty: '5 kg bag' }), // qty only, Costco bulk
  P('prod_coffee', 'Coffee beans', { note: 'the dark roast' }), // note only, Costco
  P('prod_oil', 'Olive oil', { default_qty: '1 L' }), // qty only, multi-store
  P('prod_dishsoap', 'Dish soap'), // plain, multi-store
  P('prod_candles', 'Birthday candles'), // plain, not sold anywhere
];

// --- placements: which product is bought where, in which aisle ---
const place = (product_id, store_id, area_id, position) =>
  row({ id: `${product_id}:${store_id}`, product_id, store_id, area_id, position });
const placements = [
  // Lidl — the weekly shop
  place('prod_apples', 'store_lidl', 'area_lidl_produce', 1),
  place('prod_bananas', 'store_lidl', 'area_lidl_produce', 2),
  place('prod_tomatoes', 'store_lidl', 'area_lidl_produce', 3),
  place('prod_bread', 'store_lidl', 'area_lidl_bakery', 1),
  place('prod_milk', 'store_lidl', 'area_lidl_dairy', 1),
  place('prod_eggs', 'store_lidl', 'area_lidl_dairy', 2),
  place('prod_butter', 'store_lidl', 'area_lidl_dairy', 3),
  place('prod_yoghurt', 'store_lidl', 'area_lidl_dairy', 4),
  place('prod_chicken', 'store_lidl', 'area_lidl_dairy', 5),
  place('prod_peas', 'store_lidl', 'area_lidl_frozen', 1),
  place('prod_oil', 'store_lidl', null, 1), // unsorted
  place('prod_dishsoap', 'store_lidl', null, 2), // unsorted
  // Costco — bulk staples, different layout
  place('prod_rice', 'store_costco', 'area_costco_dry', 1),
  place('prod_coffee', 'store_costco', 'area_costco_dry', 2),
  place('prod_oil', 'store_costco', 'area_costco_dry', 3), // multi-store
  place('prod_dishsoap', 'store_costco', 'area_costco_dry', 4), // multi-store
  place('prod_milk', 'store_costco', 'area_costco_fridge', 1), // multi-store
  place('prod_eggs', 'store_costco', 'area_costco_fridge', 2), // multi-store
  place('prod_chicken', 'store_costco', 'area_costco_fridge', 3), // multi-store
];

// --- a starter shopping list ---
// need id === product id; qty / note here override the product defaults for this trip
const need = (product_id, over = {}) =>
  row({ id: product_id, product_id, qty: null, note: null, status: 'needed', ...over });
const needs = [
  need('prod_milk'), // uses product defaults (2 L · semi-skimmed)
  need('prod_bread'), // note only, from product
  need('prod_apples', { qty: '10', note: 'for the pie' }), // per-trip override of both
  need('prod_yoghurt', { qty: '2' }), // per-trip qty override, note from product
  need('prod_chicken'), // qty + note from product, multi-store
  need('prod_rice'), // qty only, Costco only
  need('prod_candles'), // not sold anywhere — shows under "Not sold here"
];

async function post(path, body, headers = { 'content-type': 'application/json' }) {
  try {
    return await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    console.error(`\nCan't reach the API at ${API}.`);
    console.error('Start it first in another terminal:  npm run dev');
    console.error('(wait for "Ready on http://localhost:8787", then re-run this)\n');
    process.exit(1);
  }
}

async function main() {
  // ensure a password exists, then get a token
  let res = await post('/api/setup', { password: PASSWORD, ...(SETUP_KEY ? { key: SETUP_KEY } : {}) });
  if (res.status === 409) {
    res = await post('/api/auth', { password: PASSWORD });
  }
  if (!res.ok) {
    console.error(`auth failed (${res.status}):`, await res.text());
    console.error('Wrong password? Pass it as an argument:  npm run seed -- <password>');
    process.exit(1);
  }
  const { token } = await res.json();
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  if (FRESH) {
    const cur = await (await post('/api/sync', { cursor: 0, changes: {} }, auth)).json();
    const kill = {};
    for (const [table, rows] of Object.entries(cur.changes ?? {})) {
      kill[table] = rows
        .filter((r) => !r.deleted)
        .map((r) => ({ ...r, deleted: 1, updated_at: stamp }));
    }
    const total = Object.values(kill).reduce((n, r) => n + r.length, 0);
    if (total) {
      const killed = await (await post('/api/sync', { cursor: 0, changes: kill }, auth)).json();
      // seed rows must be newer than the server-stamped tombstones
      stamp = (killed.cursor ?? Date.now()) + 1;
      console.log(`--fresh: cleared ${total} existing rows.`);
    }
  }

  const restamp = (rows) => rows.map((r) => ({ ...r, updated_at: stamp }));
  const sync = await post(
    '/api/sync',
    {
      cursor: 0,
      changes: {
        stores: restamp(stores),
        areas: restamp(areas),
        products: restamp(products),
        placements: restamp(placements),
        needs: restamp(needs),
      },
    },
    auth,
  );
  if (!sync.ok) {
    console.error(`sync failed (${sync.status}):`, await sync.text());
    process.exit(1);
  }
  console.log(
    `Seeded: ${stores.length} stores, ${areas.length} aisles, ${products.length} products, ` +
      `${placements.length} placements, ${needs.length} on the list.`,
  );
  console.log('Includes: multi-store items, qty-only, note-only, qty+note, and plain.');
  console.log('Reload the app (or Settings → Sync now) to see it.');
}

main();
