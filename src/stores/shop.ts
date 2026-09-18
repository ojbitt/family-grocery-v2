import { defineStore } from 'pinia';

const KEY = 'grocery:store';
const BOUGHT_KEY = 'grocery:showBought';

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export const useShopStore = defineStore('shop', {
  state: () => ({
    // '' means "Any store"
    storeId: (() => {
      try {
        return localStorage.getItem(KEY) ?? '';
      } catch {
        return '';
      }
    })(),
    collapsed: new Set<string>(),
    showBought: readBool(BOUGHT_KEY),
  }),
  actions: {
    selectStore(id: string) {
      this.storeId = id;
      try {
        localStorage.setItem(KEY, id);
      } catch {
        /* ignore */
      }
    },
    toggleGroup(key: string) {
      if (this.collapsed.has(key)) this.collapsed.delete(key);
      else this.collapsed.add(key);
    },
    setShowBought(v: boolean) {
      this.showBought = v;
      try {
        localStorage.setItem(BOUGHT_KEY, v ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
  },
});
