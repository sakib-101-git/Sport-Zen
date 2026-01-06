/**
 * Jest test setup file
 * Runs before each test file
 */

// Extend Jest matchers if needed
// import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/sportzen_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.SSLCOMMERZ_STORE_ID = 'test_store';
process.env.SSLCOMMERZ_STORE_PASSWORD = 'test_password';
process.env.SSLCOMMERZ_IS_SANDBOX = 'true';
process.env.API_URL = 'http://localhost:3001';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Global test utilities
beforeAll(async () => {
  // Any global setup needed before all tests
});

afterAll(async () => {
  // Any global cleanup needed after all tests
});

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
