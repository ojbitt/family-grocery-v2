import { defineStore } from 'pinia';
import { api, getToken, setToken } from '@/lib/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    configured: true,
    checking: true,
    error: '',
  }),
  getters: {
    isAuthed: (s) => Boolean(s.token),
  },
  actions: {
    async init() {
      this.checking = true;
      try {
        const health = await api.health();
        this.configured = health.configured;
      } catch {
        // offline: assume configured so a returning user with a token still gets in
        this.configured = true;
      } finally {
        this.checking = false;
      }
      if (this.token) await this.startSession();
    },

    async unlock(password: string) {
      this.error = '';
      try {
        const { token } = this.configured
          ? await api.auth(password)
          : await api.setup(password);
        setToken(token);
        this.token = token;
        this.configured = true;
        await this.startSession();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'sign in failed';
        throw err;
      }
    },

    async startSession() {
      const { useDataStore } = await import('@/stores/data');
      await useDataStore().load();
      const { initSync } = await import('@/lib/sync');
      initSync();
    },

    /** Revoke every session on the server, then sign this device out too. */
    async logoutEveryone() {
      await api.logoutAll();
      await this.signOut(false);
    },

    async signOut(wipeLocal = false) {
      setToken(null);
      this.token = null;
      if (wipeLocal) {
        const { useDataStore } = await import('@/stores/data');
        await useDataStore().reset();
      }
    },
  },
});
