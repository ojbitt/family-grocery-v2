<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router';
import TabBar from '@/components/TabBar.vue';
import ToastHost from '@/components/ToastHost.vue';
import LoginScreen from '@/screens/LoginScreen.vue';
import { useAppStore } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';

const app = useAppStore();
const auth = useAuthStore();

onMounted(() => {
  app.applyTheme();
  void auth.init();
});
</script>

<template>
  <div class="shell">
    <div v-if="auth.checking" class="splash">Loading…</div>

    <LoginScreen v-else-if="!auth.isAuthed" />

    <template v-else>
      <main class="shell__body">
        <RouterView v-slot="{ Component }">
          <Transition name="page" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
      <TabBar />
    </template>

    <ToastHost />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
@media (display-mode: standalone) {
  /* see the html/body rule in tokens.css for why this is needed */
  .shell {
    min-height: calc(100% + env(safe-area-inset-top));
  }
}
.shell__body {
  flex: 1;
  min-height: 0;
  padding-bottom: calc(var(--tabbar-h) + var(--safe-b));
}
.splash {
  flex: 1;
  display: grid;
  place-items: center;
  color: var(--c-text-dim);
}

/* soften the reflow when switching screens (chrome differs page to page) */
.page-enter-active,
.page-leave-active {
  transition: opacity 110ms var(--ease);
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
