import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/shop' },
  {
    path: '/shop',
    name: 'shop',
    component: () => import('@/screens/ShopScreen.vue'),
    meta: { tab: 'shop' },
  },
  {
    path: '/products',
    name: 'products',
    component: () => import('@/screens/ProductsScreen.vue'),
    meta: { tab: 'products' },
  },
  {
    path: '/stores',
    name: 'stores',
    component: () => import('@/screens/StoresScreen.vue'),
    meta: { tab: 'stores' },
  },
  {
    path: '/stores/:id',
    name: 'store',
    component: () => import('@/screens/StoreScreen.vue'),
    meta: { tab: 'stores' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/screens/SettingsScreen.vue'),
    meta: { tab: 'settings' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/shop' },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});
