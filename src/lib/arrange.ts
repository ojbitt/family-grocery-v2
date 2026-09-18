import { computed, type ComputedRef } from 'vue';
import type { Placement, Product } from '@shared/types';
import { useDataStore } from '@/stores/data';
import { areasForStore, placementsForStore } from './domain';
import { needId } from './ids';

export interface ArrangeItem {
  product: Product;
  placement: Placement;
  needed: boolean;
}

export interface ArrangeGroup {
  /** area id, or 'unsorted' */
  key: string;
  title: string;
  items: ArrangeItem[];
}

/** Products placed at a store, grouped by aisle in walking order — for arranging on the Products tab. */
export function useArrangeView(storeId: ComputedRef<string>): ComputedRef<ArrangeGroup[]> {
  const data = useDataStore();

  return computed(() => {
    if (!storeId.value) return [];
    const products = new Map(data.active('products').map((p) => [p.id, p]));
    const placements = placementsForStore(storeId.value).filter((p) =>
      products.has(p.product_id),
    );
    const isNeeded = (pid: string) => {
      const n = data.get('needs', needId(pid));
      return Boolean(n && !n.deleted);
    };
    const toItem = (placement: Placement): ArrangeItem => ({
      placement,
      product: products.get(placement.product_id)!,
      needed: isNeeded(placement.product_id),
    });
    const bySort = (a: ArrangeItem, b: ArrangeItem) =>
      a.placement.position - b.placement.position;

    const groups: ArrangeGroup[] = [];
    for (const area of areasForStore(storeId.value)) {
      const items = placements
        .filter((p) => p.area_id === area.id)
        .map(toItem)
        .sort(bySort);
      if (items.length) groups.push({ key: area.id, title: area.name, items });
    }
    const unsorted = placements
      .filter((p) => p.area_id === null)
      .map(toItem)
      .sort(bySort);
    if (unsorted.length) groups.push({ key: 'unsorted', title: 'Unsorted', items: unsorted });
    return groups;
  });
}
