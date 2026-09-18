/** Random 128-bit hex id for products, stores, areas. */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Placement id is deterministic: one placement per (product, store). */
export function placementId(productId: string, storeId: string): string {
  return `${productId}:${storeId}`;
}

/** Need id is deterministic: a product is either needed or not. */
export function needId(productId: string): string {
  return productId;
}
