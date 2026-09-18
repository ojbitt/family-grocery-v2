-- Family Grocery — initial schema. See docs/specs.md §5.
-- Every domain row carries updated_at (ms epoch, server-assigned) and a deleted tombstone flag.

CREATE TABLE products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  default_qty TEXT,
  note        TEXT,
  updated_at  INTEGER NOT NULL,
  deleted     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE stores (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE areas (
  id         TEXT PRIMARY KEY,
  store_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  position   REAL NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_areas_store ON areas (store_id);

CREATE TABLE placements (
  id         TEXT PRIMARY KEY,            -- "{product_id}:{store_id}"
  product_id TEXT NOT NULL,
  store_id   TEXT NOT NULL,
  area_id    TEXT,                        -- NULL => Unsorted
  position   REAL NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_placements_store ON placements (store_id);
CREATE INDEX idx_placements_product ON placements (product_id);

CREATE TABLE needs (
  id         TEXT PRIMARY KEY,            -- = product_id
  product_id TEXT NOT NULL,
  qty        TEXT,
  note       TEXT,
  status     TEXT NOT NULL DEFAULT 'needed',   -- 'needed' | 'in_cart'
  updated_at INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0
);

-- delta-sync scan indexes
CREATE INDEX idx_products_updated   ON products (updated_at);
CREATE INDEX idx_stores_updated     ON stores (updated_at);
CREATE INDEX idx_areas_updated      ON areas (updated_at);
CREATE INDEX idx_placements_updated ON placements (updated_at);
CREATE INDEX idx_needs_updated      ON needs (updated_at);

CREATE TABLE app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE tokens (
  token      TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);
