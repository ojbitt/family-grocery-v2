<script setup lang="ts">
import { useRoute } from 'vue-router';
import GroceriesGlyph from './GroceriesGlyph.vue';

const route = useRoute();

const tabs = [
  { to: '/shop', tab: 'shop', label: 'Shop', icon: 'cart' },
  { to: '/products', tab: 'products', label: 'Products', icon: 'list' },
  { to: '/stores', tab: 'stores', label: 'Stores', icon: 'store' },
  { to: '/settings', tab: 'settings', label: 'Settings', icon: 'gear' },
] as const;
</script>

<template>
  <nav class="tabbar" aria-label="Primary">
    <RouterLink
      v-for="t in tabs"
      :key="t.tab"
      :to="t.to"
      class="tabbar__item"
      :class="{ 'is-active': route.meta.tab === t.tab }"
    >
      <GroceriesGlyph v-if="t.icon === 'cart'" class="tabbar__icon" />
      <svg
        v-else
        class="tabbar__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path v-if="t.icon === 'list'" d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
        <path
          v-else-if="t.icon === 'store'"
          d="M4 9 5.5 4h13L20 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16M9 20v-5h6v5"
        />
        <template v-else>
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.22.65.22 1v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </template>
      </svg>
      <span class="tabbar__label">{{ t.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: var(--app-edge);
  right: var(--app-edge);
  bottom: 0;
  z-index: 20;
  display: flex;
  height: calc(var(--tabbar-h) + var(--safe-b));
  padding-bottom: var(--safe-b);
  background: var(--c-surface);
  border-top: 1px solid var(--c-border);
  box-shadow: var(--e-up);
}
.tabbar__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: none;
  background: none;
  text-decoration: none;
  color: var(--c-text-faint);
  transition: color var(--dur) var(--ease);
  -webkit-tap-highlight-color: transparent;
}
.tabbar__item.is-active {
  color: var(--c-accent);
}
.tabbar__item:active {
  opacity: 0.6;
}
.tabbar__icon {
  width: 24px;
  height: 24px;
}
.tabbar__label {
  font-size: var(--t-tab);
  font-weight: 600;
  letter-spacing: 0.01em;
  /* the body line-height (1.4) adds more visual space below the label's
     baseline than above the icon, so the pair reads as bottom-heavy within
     the tab bar; a tight line-height keeps the label's box close to its ink. */
  line-height: 1;
}
</style>
