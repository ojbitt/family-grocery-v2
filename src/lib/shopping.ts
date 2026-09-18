import { computed, type ComputedRef } from 'vue';
import type { Need, Placement, Product } from '@shared/types';
import { useDataStore } from '@/stores/data';
import { areasForStore, placementsForStore } from './domain';

export interface ShopItem {
  need: Need;
  product: Product;
  placement?: Placement;
  bought: boolean;
  /** stores (names) that carry this product — for "Any store" mode */
  storeNames: string[];
}

export interface ShopGroup {
  key: string;
  title: string;
  items: ShopItem[];
}

export interface ShoppingView {
  groups: ShopGroup[];
  notSoldHere: ShopItem[];
  /** in-cart items count (shown in the list only when `showBought`) */
  boughtCount: number;
  coverage: { covered: number; total: number };
  /** needed (not yet bought) items this store carries */
  totalToBuy: number;
}

const UNSORTED = 'unsorted';

export function useShoppingView(
  storeId: ComputedRef<string>,
  showBought: ComputedRef<boolean>,
): ComputedRef<ShoppingView> {
  const data = useDataStore();

  return computed(() => {
    const products = new Map(data.active('products').map((p) => [p.id, p]));
    const storeNamesByProduct = (productId: string) =>
      data
        .active('placements')
        .filter((p) => p.product_id === productId)
        .map((p) => data.get('stores', p.store_id)?.name)
        .filter((n): n is string => Boolean(n));

    const needs = data.active('needs').filter((n) => products.has(n.product_id));
    const boughtCount = needs.filter((n) => n.status === 'in_cart').length;
    // rows to place in the list: always the un-bought ones; bought ones only on request
    const listable = needs.filter((n) => n.status === 'needed' || showBought.value);
    const needed = needs.filter((n) => n.status === 'needed');

    const toItem = (need: Need, placement?: Placement): ShopItem => ({
      need,
      placement,
      bought: need.status === 'in_cart',
      product: products.get(need.product_id)!,
      storeNames: storeNamesByProduct(need.product_id),
    });

    // keep every row in its aisle position — bought items stay put (and just
    // hide when `showBought` is off) rather than jumping to the end
    const byOrder = (a: ShopItem, b: ShopItem) =>
      (a.placement?.position ?? 0) - (b.placement?.position ?? 0);

    // "Any store" — one flat list.
    if (!storeId.value) {
      const all = listable
        .map((n) => toItem(n))
        .sort((a, b) => a.product.name.localeCompare(b.product.name));
      return {
        groups: all.length ? [{ key: 'all', title: 'To buy', items: all }] : [],
        notSoldHere: [],
        boughtCount,
        coverage: { covered: needed.length, total: needed.length },
        totalToBuy: needed.length,
      };
    }

    const placementByProduct = new Map(
      placementsForStore(storeId.value).map((p) => [p.product_id, p]),
    );
    const areas = areasForStore(storeId.value);

    const groups: ShopGroup[] = [];
    for (const area of areas) {
      const items = listable
        .filter((n) => placementByProduct.get(n.product_id)?.area_id === area.id)
        .map((n) => toItem(n, placementByProduct.get(n.product_id)))
        .sort(byOrder);
      if (items.length) groups.push({ key: area.id, title: area.name, items });
    }

    const unsorted = listable
      .filter((n) => {
        const p = placementByProduct.get(n.product_id);
        return p && p.area_id === null;
      })
      .map((n) => toItem(n, placementByProduct.get(n.product_id)))
      .sort(byOrder);
    if (unsorted.length) groups.push({ key: UNSORTED, title: 'Unsorted', items: unsorted });

    const notSoldHere = needed
      .filter((n) => !placementByProduct.has(n.product_id))
      .map((n) => toItem(n))
      .sort((a, b) => a.product.name.localeCompare(b.product.name));

    const covered = needed.length - notSoldHere.length;
    return {
      groups,
      notSoldHere,
      boughtCount,
      coverage: { covered, total: needed.length },
      totalToBuy: covered,
    };
  });
}
