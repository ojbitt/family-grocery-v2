import { onMounted, onUnmounted, ref } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const deferred = ref<BeforeInstallPromptEvent | null>(null);
const installed = ref(
  typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches,
);

export function usePwaInstall() {
  function onPrompt(e: Event) {
    e.preventDefault();
    deferred.value = e as BeforeInstallPromptEvent;
  }
  function onInstalled() {
    installed.value = true;
    deferred.value = null;
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
  });
  onUnmounted(() => {
    window.removeEventListener('beforeinstallprompt', onPrompt);
    window.removeEventListener('appinstalled', onInstalled);
  });

  async function promptInstall() {
    const e = deferred.value;
    if (!e) return;
    await e.prompt();
    await e.userChoice;
    deferred.value = null;
  }

  return { canInstall: deferred, installed, promptInstall };
}
