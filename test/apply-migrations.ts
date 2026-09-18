import { applyD1Migrations, env } from 'cloudflare:test';

// Each isolated test worker gets a fresh D1; apply the schema before any test runs.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
