import { execSync } from 'child_process';

// Rebuilds the test database from the migrations before the test run
export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://sabriii@localhost/omda_test?host=/var/run/postgresql';
  if (!/test/i.test(new URL(url).pathname)) {
    throw new Error(`Refusing to reset "${url}": the test database name must contain "test"`);
  }
  execSync('npx prisma migrate reset --force --skip-seed --skip-generate', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
