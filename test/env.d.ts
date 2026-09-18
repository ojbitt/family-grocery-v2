declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database;
    AUTH_SECRET: string;
    SETUP_KEY?: string;
    AUTH_RL?: RateLimit;
    API_RL?: RateLimit;
    TEST_MIGRATIONS: D1Migration[];
  }
}
