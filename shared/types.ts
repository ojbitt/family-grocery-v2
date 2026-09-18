// Shared domain + sync types — used by both the Worker and the client.
// See docs/specs.md §3 and §6.

export type EntityTable = 'products' | 'stores' | 'areas' | 'placements' | 'needs';

export const ENTITY_TABLES: EntityTable[] = [
  'products',
  'stores',
  'areas',
  'placements',
  'needs',
];

export interface BaseRow {
  id: string;
  updated_at: number;
  deleted: 0 | 1;
}

export interface Product extends BaseRow {
  name: string;
  default_qty: string | null;
  note: string | null;
}

export interface Store extends BaseRow {
  name: string;
}

export interface Area extends BaseRow {
  store_id: string;
  name: string;
  position: number;
}

export interface Placement extends BaseRow {
  /** id === `${product_id}:${store_id}` */
  product_id: string;
  store_id: string;
  area_id: string | null;
  position: number;
}

export type NeedStatus = 'needed' | 'in_cart';

export interface Need extends BaseRow {
  /** id === product_id */
  product_id: string;
  qty: string | null;
  note: string | null;
  status: NeedStatus;
}

export interface TableRowMap {
  products: Product;
  stores: Store;
  areas: Area;
  placements: Placement;
  needs: Need;
}

export type ChangeSet = {
  [K in EntityTable]?: TableRowMap[K][];
};

export interface SyncRequest {
  /** last server cursor the client holds; 0 means full pull */
  cursor: number;
  changes: ChangeSet;
}

export interface SyncResponse {
  cursor: number;
  changes: ChangeSet;
}

export interface AuthResponse {
  token: string;
}

export type AuthEventKind = 'setup' | 'unlock' | 'logout-all';

export interface AuthLogEntry {
  at: number;
  kind: AuthEventKind;
  ok: 0 | 1;
  user_agent: string | null;
  ip: string | null;
}

export interface AuthLogResponse {
  entries: AuthLogEntry[];
}

export interface ApiError {
  error: string;
}
