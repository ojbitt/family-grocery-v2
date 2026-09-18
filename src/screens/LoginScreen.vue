<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import GroceriesGlyph from '@/components/GroceriesGlyph.vue';

const auth = useAuthStore();
const password = ref('');
const show = ref(false);
const busy = ref(false);

async function submit() {
  if (password.value.length < 4 || busy.value) return;
  busy.value = true;
  try {
    await auth.unlock(password.value);
    password.value = '';
  } catch {
    /* error surfaced via store */
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="login">
    <div class="login__inner">
      <div class="login__mark" aria-hidden="true">
        <GroceriesGlyph style="width: 34px; height: 34px" />
      </div>
      <h1 class="login__title">Family Grocery</h1>
      <p id="login-label" class="login__sub">
        {{ auth.configured ? 'Enter the family password' : 'Choose a family password' }}
      </p>

      <form class="login__form" @submit.prevent="submit">
        <div class="login__field">
          <input
            :type="show ? 'text' : 'password'"
            v-model="password"
            class="login__input"
            aria-labelledby="login-label"
            :placeholder="auth.configured ? 'Password' : 'New password'"
            autocomplete="current-password"
            autocapitalize="off"
            autocorrect="off"
            :disabled="busy"
            enterkeyhint="go"
          />
          <button
            type="button"
            class="login__peek hit"
            :aria-label="show ? 'Hide password' : 'Show password'"
            @click="show = !show"
          >
            {{ show ? 'Hide' : 'Show' }}
          </button>
        </div>

        <button
          type="submit"
          class="btn-primary"
          :disabled="busy || password.length < 4"
        >
          {{ busy ? '…' : auth.configured ? 'Unlock' : 'Create' }}
        </button>

        <p v-if="auth.error" class="login__err">{{ auth.error }}</p>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login {
  flex: 1;
  display: grid;
  place-items: center;
  padding: var(--s-5);
  padding-top: calc(var(--safe-t) + var(--s-6));
}
.login__inner {
  width: 100%;
  max-width: 360px;
  text-align: center;
}
.login__mark {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  margin: 0 auto var(--s-4);
  border-radius: var(--r-lg);
  background: var(--c-accent-soft);
  color: var(--c-accent);
}
.login__title {
  margin: 0 0 var(--s-1);
  font-size: var(--t-screen);
  letter-spacing: -0.02em;
}
.login__sub {
  margin: 0 0 var(--s-5);
  color: var(--c-text-dim);
  line-height: 1.5;
}
.login__form {
  display: flex;
  flex-direction: column;
  gap: var(--s-3);
}
.login__field {
  display: flex;
  align-items: center;
  min-height: var(--control-h);
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: var(--r-md);
  padding-right: var(--s-2);
}
.login__input {
  flex: 1;
  min-width: 0;
  padding: 0 var(--s-3);
  border: none;
  background: none;
  border-radius: var(--r-md);
}
.login__input:focus {
  outline: none;
}
.login__field:focus-within {
  border-color: var(--c-accent);
  box-shadow: 0 0 0 3px var(--c-accent-soft);
}
.login__peek {
  border: none;
  background: none;
  color: var(--c-text-dim);
  font-size: var(--t-caption);
  font-weight: 600;
  padding: var(--s-2);
}
.login__err {
  margin: 0;
  color: var(--c-danger);
  font-size: var(--t-body-sm);
}
</style>
