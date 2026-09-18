import { fileURLToPath } from 'node:url';
import {
  defineWorkersConfig,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers/config';

const migrationsDir = fileURLToPath(new URL('./migrations', import.meta.url));
const sharedDir = fileURLToPath(new URL('./shared', import.meta.url));

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(migrationsDir);

  return {
    resolve: {
      alias: { '@shared': sharedDir },
    },
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          isolatedStorage: true,
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            bindings: {
              AUTH_SECRET: 'test-secret',
              TEST_MIGRATIONS: migrations,
            },
            ratelimits: {
              AUTH_RL: { simple: { limit: 10, period: 60 } },
              API_RL: { simple: { limit: 200, period: 60 } },
            },
          },
        },
      },
    },
  };
});
