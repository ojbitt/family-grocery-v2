<script setup lang="ts">
import { computed, ref } from 'vue';
import ScreenHeader from '@/components/ScreenHeader.vue';
import ImportSheet from '@/components/ImportSheet.vue';
import ExportSheet from '@/components/ExportSheet.vue';
import ConfirmSheet from '@/components/ConfirmSheet.vue';
import AuthLogSheet from '@/components/AuthLogSheet.vue';
import { useAppStore, type ThemePref } from '@/stores/app';
import { useAuthStore } from '@/stores/auth';
import { useSyncStore } from '@/stores/sync';
import { syncNow } from '@/lib/sync';
import { showToast } from '@/lib/toast';
import { usePwaInstall } from '@/lib/usePwaInstall';

const app = useAppStore();
const auth = useAuthStore();
const sync = useSyncStore();
const { canInstall, promptInstall } = usePwaInstall();

const appVersion = __APP_VERSION__;

const RELOAD_KEY = 'grocery:lastReload';
const lastCheckedAt = ref(Number(localStorage.getItem(RELOAD_KEY)) || 0);
const checkedLabel = computed(() => {
  if (!lastCheckedAt.value) return 'Never checked';
  const mins = Math.round((Date.now() - lastCheckedAt.value) / 60000);
  return mins <= 0 ? 'Checked just now' : `Checked ${mins}m ago`;
});

const themes: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const syncLabel = computed(() => {
  if (sync.status === 'syncing') return 'Syncing…';
  if (sync.status === 'offline') return 'Offline';
  if (sync.status === 'error') return sync.lastError || 'Sync error';
  if (sync.lastSyncedAt) {
    const mins = Math.round((Date.now() - sync.lastSyncedAt) / 60000);
    return mins <= 0 ? 'Synced just now' : `Synced ${mins}m ago`;
  }
  return 'Not synced yet';
});

async function signOut() {
  await auth.signOut(false);
}

async function resetLocal() {
  await auth.signOut(true);
  showToast('Local data cleared');
}

async function logoutEveryone() {
  try {
    await auth.logoutEveryone();
    showToast('All devices signed out');
  } catch {
    showToast('Could not reach the server');
  }
}

async function forceReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    // tells main.ts's controllerchange handler not to reload a second time
    // once the freshly re-registered service worker claims this page
    sessionStorage.setItem('grocery:manualReload', '1');
    localStorage.setItem(RELOAD_KEY, String(Date.now()));
    location.reload();
  }
}

const importOpen = ref(false);
const exportOpen = ref(false);
const authLogOpen = ref(false);
const signOutOpen = ref(false);
const resetOpen = ref(false);
const logoutAllOpen = ref(false);
</script>

<template>
  <div class="screen">
    <ScreenHeader title="Settings" />

    <div class="body">
      <section class="grp">
        <h2 class="grp__label u-eyebrow">Appearance</h2>
        <div class="seg" role="group" aria-label="Theme">
          <button
            v-for="t in themes"
            :key="t.value"
            class="seg__btn"
            :class="{ 'is-on': app.theme === t.value }"
            @click="app.setTheme(t.value)"
          >
            {{ t.label }}
          </button>
        </div>
      </section>

      <section class="grp">
        <div class="grp__head">
          <h2 class="grp__label u-eyebrow">Sync</h2>
          <span class="grp__meta">
            <span :class="['dot', `dot--${sync.status}`]" />
            {{ syncLabel }}
            <span v-if="sync.pendingCount" class="row__badge">{{ sync.pendingCount }} pending</span>
          </span>
        </div>
        <button class="link" @click="syncNow()">Sync now</button>
      </section>

      <section v-if="canInstall" class="grp">
        <h2 class="grp__label u-eyebrow">Install</h2>
        <button class="link" @click="promptInstall">Add to Home Screen</button>
      </section>

      <section class="grp">
        <h2 class="grp__label u-eyebrow">Catalog</h2>
        <button class="link" @click="importOpen = true">Import</button>
        <button class="link" @click="exportOpen = true">Export</button>
      </section>

      <section class="grp">
        <h2 class="grp__label u-eyebrow">Sessions</h2>
        <button class="link" @click="authLogOpen = true">Sign-in log</button>
        <button class="link link--danger" @click="logoutAllOpen = true">
          Log out all devices
        </button>
      </section>

      <section class="grp">
        <h2 class="grp__label u-eyebrow">This device</h2>
        <button class="link" @click="signOutOpen = true">Sign out</button>
        <button class="link link--danger" @click="resetOpen = true">
          Sign out &amp; erase this device
        </button>
      </section>

      <section class="grp">
        <div class="grp__head">
          <h2 class="grp__label u-eyebrow">Updates</h2>
          <span class="grp__meta">{{ checkedLabel }}</span>
        </div>
        <button class="link" @click="forceReload">Check for updates</button>
        <p class="ver">Version {{ appVersion }}</p>
      </section>
    </div>

    <ImportSheet v-model:open="importOpen" />
    <ExportSheet v-model:open="exportOpen" />
    <AuthLogSheet v-model:open="authLogOpen" />
    <ConfirmSheet
      v-model:open="signOutOpen"
      title="Sign out?"
      message="You'll need the family password to get back in. Your saved list stays on this device."
      confirm-label="Sign out"
      @confirm="signOut"
    />
    <ConfirmSheet
      v-model:open="resetOpen"
      title="Sign out & erase this device?"
      message="Signs out and deletes this device's local copy of the list. Anything not yet synced is lost. The family data on the server is untouched."
      confirm-label="Erase"
      danger
      @confirm="resetLocal"
    />
    <ConfirmSheet
      v-model:open="logoutAllOpen"
      title="Log out all devices?"
      message="Every family member — including this device — will need to enter the family password again. Use this if a device was lost."
      confirm-label="Log out all"
      danger
      @confirm="logoutEveryone"
    />
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.body {
  padding: var(--s-2) var(--s-4);
  padding-bottom: calc(var(--tabbar-h) + var(--safe-b) + var(--s-5));
}
.grp {
  margin-bottom: var(--s-5);
}
.grp__label {
  margin: 0 0 var(--s-2);
}
.grp__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s-2);
  margin: 0 0 var(--s-2);
}
.grp__head .grp__label {
  margin: 0;
}
.grp__meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--c-text-faint);
  font-size: var(--t-caption);
  font-weight: 400;
  text-transform: none;
}
.seg {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--c-surface-2);
  border-radius: var(--r-md);
}
.seg__btn {
  flex: 1;
  min-height: var(--control-h);
  padding: 0 var(--s-3);
  border: none;
  border-radius: var(--r-sm);
  background: none;
  color: var(--c-text-dim);
  font-weight: 600;
  font-size: var(--t-body-sm);
}
.seg__btn.is-on {
  background: var(--c-surface);
  color: var(--c-text);
  box-shadow: var(--e-1);
}
.row__badge {
  font-size: var(--t-caption);
  color: var(--c-text-dim);
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: var(--r-full);
  background: var(--c-text-faint);
}
.dot--idle {
  background: var(--c-success);
}
.dot--syncing {
  background: var(--c-accent);
}
.dot--offline {
  background: var(--c-text-faint);
}
.dot--error {
  background: var(--c-danger);
}
.link {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: var(--control-h);
  padding: var(--s-2) var(--s-3);
  border: none;
  border-radius: var(--r-md);
  background: var(--c-surface-2);
  color: var(--c-text);
  font-size: var(--t-body);
  text-align: left;
}
.link + .link {
  margin-top: var(--s-3);
}
.link + .link--danger {
  margin-top: var(--s-5);
}
.link:active {
  background: var(--c-border);
}
.link--danger {
  color: var(--c-danger);
}
.ver {
  margin: var(--s-2) 0 0;
  text-align: center;
  color: var(--c-text-faint);
  font-size: var(--t-caption);
}
</style>
