import { reactive } from 'vue';

export interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction;
  duration: number;
}

const state = reactive<{ items: Toast[] }>({ items: [] });
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export function useToasts() {
  return state;
}

export function dismissToast(id: number): void {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  const i = state.items.findIndex((x) => x.id === id);
  if (i !== -1) state.items.splice(i, 1);
}

export function clearToasts(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  state.items.length = 0;
}

export function showToast(
  message: string,
  opts: { action?: ToastAction; duration?: number } = {},
): number {
  const id = nextId++;
  const duration = opts.duration ?? 5000;
  state.items.push({ id, message, action: opts.action, duration });
  timers.set(
    id,
    setTimeout(() => dismissToast(id), duration),
  );
  // Keep at most 3 on screen.
  while (state.items.length > 3) dismissToast(state.items[0].id);
  return id;
}
