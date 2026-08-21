const defaultTestDatabaseUrl =
  'postgresql://postgres:postgres@localhost:5433/allosta_test?schema=public';
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? defaultTestDatabaseUrl;
const parsed = new URL(testDatabaseUrl);
const databaseName = decodeURIComponent(parsed.pathname.slice(1));

if (
  !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
  parsed.port !== '5433' ||
  databaseName !== 'allosta_test'
) {
  throw new Error(
    'Integration tests require the disposable local database at localhost:5433/allosta_test',
  );
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = testDatabaseUrl;
process.env.JWT_SECRET = 'local-integration-test-secret';
