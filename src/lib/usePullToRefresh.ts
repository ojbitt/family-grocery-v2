import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Minimal pull-to-refresh bound to the window scroll. `distance` (0..1.5) drives
 * an indicator; `onRefresh` fires once the pull passes the threshold.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const distance = ref(0);
  const refreshing = ref(false);
  let startY = 0;
  let pulling = false;
  const THRESHOLD = 70;

  function onStart(e: TouchEvent) {
    if (refreshing.value || window.scrollY > 0) return;
    startY = e.touches[0].clientY;
    pulling = true;
  }
  function onMove(e: TouchEvent) {
    if (!pulling) return;
    const dy = e.touches[0].clientY - startY;
    distance.value = dy > 0 ? Math.min(dy / THRESHOLD, 1.5) : 0;
  }
  async function onEnd() {
    if (!pulling) return;
    pulling = false;
    if (distance.value >= 1) {
      refreshing.value = true;
      try {
        await onRefresh();
      } finally {
        refreshing.value = false;
      }
    }
    distance.value = 0;
  }

  onMounted(() => {
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd);
  });
  onUnmounted(() => {
    document.removeEventListener('touchstart', onStart);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
  });

  return { distance, refreshing };
}
