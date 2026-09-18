<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{ checked: boolean; label: string; variant?: 'check' | 'add' }>(),
  { variant: 'check' },
);
const emit = defineEmits<{ toggle: [] }>();

// "pop" only on a genuine check-off, never when mounting already-checked
// (e.g. every bought row when you open the Shop tab)
const popping = ref(false);
watch(
  () => props.checked,
  (now, was) => {
    if (now && !was && props.variant === 'check') {
      popping.value = true;
      setTimeout(() => (popping.value = false), 260);
    }
  },
);
</script>

<template>
  <button
    class="check"
    :class="{
      'is-on': checked && variant === 'check',
      'is-pending': variant === 'check' && !checked,
      'is-add': variant === 'add' && !checked,
      'is-remove': variant === 'add' && checked,
      'is-pop': popping,
    }"
    :aria-pressed="checked"
    :aria-label="label"
    @click.stop="emit('toggle')"
  >
    <!-- The SVG fills the circle; the glyph is centred by the viewBox, so it
         can't drift a sub-pixel off centre on fractional-DPR / Display-Zoom
         screens (which is what "box-in-box" centring does). -->
    <svg v-if="variant === 'check'" viewBox="-7 -7 38 38" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>

    <!-- Products: + to add, − to remove -->
    <svg v-else-if="variant === 'add'" viewBox="-7 -7 38 38" aria-hidden="true">
      <path
        v-if="!checked"
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        stroke-width="2.6"
        stroke-linecap="round"
      />
      <path v-else d="M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" />
    </svg>
  </button>
</template>

<style scoped>
.check {
  flex: none;
  display: block;
  position: relative;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid var(--c-border);
  border-radius: var(--r-full);
  background: var(--c-surface);
  transition:
    background var(--dur) var(--ease),
    border-color var(--dur) var(--ease),
    color var(--dur) var(--ease),
    transform var(--dur) var(--ease);
}
.check svg {
  width: 100%;
  height: 100%;
}
.check::after {
  /* enlarge the touch target to ~46px without changing the visual */
  content: '';
  position: absolute;
  inset: -9px;
}
.check.is-pending {
  /* to buy: a filled teal chip — clearly "active" */
  border-color: var(--c-accent);
  background: var(--c-accent-soft);
  color: var(--c-accent);
}
.check.is-add {
  border-color: var(--c-accent);
  color: var(--c-accent);
}
.check.is-remove {
  border-color: var(--c-danger);
  color: var(--c-danger);
  background: var(--c-danger-soft);
}
.check.is-on {
  /* bought: faded outline — recedes next to the filled teal "to buy" chips */
  border-color: var(--c-border);
  background: transparent;
  color: var(--c-text-faint);
}
.check.is-pop {
  animation: pop 0.25s var(--ease);
}
.check:active {
  transform: scale(0.9);
}
@keyframes pop {
  40% {
    transform: scale(1.18);
  }
}
</style>
