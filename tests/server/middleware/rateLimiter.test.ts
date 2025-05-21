import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { H3Event, createError, defineEventHandler, getRequestIP } from 'h3';
import rateLimiterMiddleware from '~/server/middleware/rateLimiter'; // Adjust path if needed

// Mock H3 utilities
vi.mock('h3', async (importOriginal) => {
  const original = await importOriginal<typeof import('h3')>();
  return {
    ...original,
    getRequestIP: vi.fn(),
    createError: vi.fn((opts) => {
      const err = new Error(opts.statusMessage || 'Error') as any;
      err.statusCode = opts.statusCode;
      err.statusMessage = opts.statusMessage;
      return err;
    }),
    defineEventHandler: vi.fn(handler => handler), // Simplified: just returns the handler
  };
});

// Mock runtime config
const mockRuntimeConfig = {
  rateLimit: {
    requests: 3, // Lower for easier testing
    interval: 10, // 10 seconds
  },
};
vi.mock('#imports', () => ({
  useRuntimeConfig: vi.fn(() => mockRuntimeConfig),
}));

// Helper to create a mock H3Event
const createMockEvent = (path: string): H3Event => {
  // IP will be set by getRequestIP mock directly in tests
  return { path } as H3Event;
};

describe('Rate Limiter Middleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks(); // Clear all mocks

    // Reset modules to ensure the middleware's internal state (requestTimestamps map) is new
    vi.resetModules();

    // Re-apply mocks after resetModules
    vi.mock('h3', async (importOriginal) => {
      const original = await importOriginal<typeof import('h3')>();
      return {
        ...original,
        getRequestIP: vi.fn(), // Will be mocked per test / per call
        createError: vi.fn((opts) => { // Mock createError to check its calls
          const err = new Error(opts.statusMessage || 'Error') as any;
          err.statusCode = opts.statusCode;
          err.statusMessage = opts.statusMessage;
          // Store the error details for assertion if needed, or just check calls
          err.details = opts; // for easier assertions on what it was called with
          return err;
        }),
        defineEventHandler: vi.fn(handler => handler), // Pass through the handler
      };
    });
    vi.mock('#imports', () => ({
      useRuntimeConfig: vi.fn(() => mockRuntimeConfig), // Provide mock config
    }));

    // Re-import the middleware to get a fresh instance with reset state
    // This is crucial because rateLimiter.ts has a module-level Map.
    import('~/server/middleware/rateLimiter').then(module => {
      rateLimiterMiddlewareInstance = module.default;
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers(); // Run any timers that were set up by the code under test
    vi.useRealTimers(); // Restore real timers
  });

  // This will hold the type-casted middleware instance for each test
  let rateLimiterMiddlewareInstance: (event: H3Event) => Promise<void>;

  beforeEach(async () => {
    // Re-import and re-assign the middleware for each test to ensure isolation
    const module = await import('~/server/middleware/rateLimiter');
    rateLimiterMiddlewareInstance = module.default as (event: H3Event) => Promise<void>;
  });

  const targetedPath = '/api/businesses/123/checks';
  const nonTargetedPath = '/api/other/route';
  const ip1 = '192.168.1.1';
  const ip2 = '192.168.1.2';

  it('should allow requests below the limit', async () => {
    for (let i = 0; i < mockRuntimeConfig.rateLimit.requests; i++) {
      const event = createMockEvent(targetedPath);
      (getRequestIP as vi.Mock).mockReturnValue(ip1);
      await expect(rateLimiterMiddlewareInstance(event)).resolves.toBeUndefined();
    }
    expect(createError).not.toHaveBeenCalled();
  });

  it('should block requests exceeding the limit', async () => {
    // Send allowed requests
    for (let i = 0; i < mockRuntimeConfig.rateLimit.requests; i++) {
      const event = createMockEvent(targetedPath);
      (getRequestIP as vi.Mock).mockReturnValue(ip1);
      await expect(rateLimiterMiddlewareInstance(event)).resolves.toBeUndefined();
    }

    // Send one more request (should be blocked)
    const eventExceed = createMockEvent(targetedPath);
    (getRequestIP as vi.Mock).mockReturnValue(ip1);
    await expect(rateLimiterMiddlewareInstance(eventExceed))
      .rejects.toMatchObject({ statusCode: 429 });
    
    expect(createError).toHaveBeenCalledWith({
      statusCode: 429,
      statusMessage: 'Too many requests. Please try again later.',
    });
  });

  it('should reset rate limit after the window period', async () => {
    // Exceed the limit
    for (let i = 0; i < mockRuntimeConfig.rateLimit.requests; i++) {
      const event = createMockEvent(targetedPath);
      (getRequestIP as vi.Mock).mockReturnValue(ip1);
      await expect(rateLimiterMiddlewareInstance(event)).resolves.toBeUndefined();
    }
    const eventExceed = createMockEvent(targetedPath);
    (getRequestIP as vi.Mock).mockReturnValue(ip1);
    await expect(rateLimiterMiddlewareInstance(eventExceed))
      .rejects.toMatchObject({ statusCode: 429 });
    
    expect(createError).toHaveBeenCalledTimes(1);
    (createError as vi.Mock).mockClear(); // Clear mock for next assertions

    // Advance time beyond the window
    vi.advanceTimersByTime((mockRuntimeConfig.rateLimit.interval + 1) * 1000);

    // Send another request (should be allowed)
    const eventAfterReset = createMockEvent(targetedPath);
    (getRequestIP as vi.Mock).mockReturnValue(ip1);
    await expect(rateLimiterMiddlewareInstance(eventAfterReset)).resolves.toBeUndefined();
    expect(createError).not.toHaveBeenCalled();
  });

  it('should handle requests from different IPs independently', async () => {
    // Exceed limit for IP1
    for (let i = 0; i < mockRuntimeConfig.rateLimit.requests; i++) {
      const event = createMockEvent(targetedPath);
      (getRequestIP as vi.Mock).mockReturnValue(ip1);
      await expect(rateLimiterMiddlewareInstance(event)).resolves.toBeUndefined();
    }
    const eventIp1Exceed = createMockEvent(targetedPath);
    (getRequestIP as vi.Mock).mockReturnValue(ip1);
    await expect(rateLimiterMiddlewareInstance(eventIp1Exceed))
      .rejects.toMatchObject({ statusCode: 429 });
    expect(createError).toHaveBeenCalledTimes(1);

    // Send requests from IP2 (should be allowed)
    for (let i = 0; i < mockRuntimeConfig.rateLimit.requests; i++) {
      const event = createMockEvent(targetedPath);
      (getRequestIP as vi.Mock).mockReturnValue(ip2); // Different IP
      await expect(rateLimiterMiddlewareInstance(event)).resolves.toBeUndefined();
    }
    // IP1 is still blocked, IP2 is not - createError should still be 1 from IP1
    expect(createError).toHaveBeenCalledTimes(1); 

    // Exceed limit for IP2
    const eventIp2Exceed = createMockEvent(targetedPath);
    (getRequestIP as vi.Mock).mockReturnValue(ip2);
    await expect(rateLimiterMiddlewareInstance(eventIp2Exceed))
      .rejects.toMatchObject({ statusCode: 429 });
    expect(createError).toHaveBeenCalledTimes(2); // Now 2 calls, one for each IP
  });

  it('should not rate limit non-targeted routes', async () => {
    for (let i = 0; i <= mockRuntimeConfig.rateLimit.requests + 5; i++) { // Send many requests
      const event = createMockEvent(nonTargetedPath);
      (getRequestIP as vi.Mock).mockReturnValue(ip1);
      await expect(rateLimiterMiddlewareInstance(event)).resolves.toBeUndefined();
    }
    expect(createError).not.toHaveBeenCalled();
  });
  
  it('should allow request if IP cannot be determined', async () => {
    const event = createMockEvent(targetedPath); 
    (getRequestIP as vi.Mock).mockReturnValue(''); // Simulate undefined/empty IP
    await expect(rateLimiterMiddlewareInstance(event)).resolves.toBeUndefined();
    expect(createError).not.toHaveBeenCalled();
  });

  it('should correctly apply to paths like /api/businesses/:id/checks/some-sub-path', async () => {
    const subPath = `${targetedPath}/sub/path`;
    for (let i = 0; i < mockRuntimeConfig.rateLimit.requests; i++) {
      const event = createMockEvent(subPath);
      (getRequestIP as vi.Mock).mockReturnValue(ip1);
      await expect(rateLimiterMiddlewareInstance(event)).resolves.toBeUndefined();
    }
    const eventExceed = createMockEvent(subPath);
    (getRequestIP as vi.Mock).mockReturnValue(ip1);
    await expect(rateLimiterMiddlewareInstance(eventExceed))
      .rejects.toMatchObject({ statusCode: 429 });
    expect(createError).toHaveBeenCalledWith({
      statusCode: 429,
      statusMessage: 'Too many requests. Please try again later.',
    });
  });

  it('should NOT apply to paths like /api/businesses/checks (no id)', async () => {
    const noIdPath = '/api/businesses/checks';
     for (let i = 0; i <= mockRuntimeConfig.rateLimit.requests + 2; i++) {
      const event = createMockEvent(noIdPath);
      (getRequestIP as vi.Mock).mockReturnValue(ip1);
      await expect(rateLimiterMiddlewareInstance(event)).resolves.toBeUndefined();
    }
    expect(createError).not.toHaveBeenCalled();
  });
});
