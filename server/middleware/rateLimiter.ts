import { defineEventHandler, getRequestIP, createError } from 'h3';
import { useRuntimeConfig } from '#imports';

// In-memory store for request timestamps
const requestTimestamps = new Map<string, number[]>();

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const { requests: MAX_REQUESTS_PER_WINDOW, interval: WINDOW_SIZE_IN_SECONDS } = config.rateLimit;

  // 1. Target specific routes
  const path = event.path;
  // Regex to match /api/businesses/:id/checks or /api/businesses/:id/checks/...
  const targetRouteRegex = /^\/api\/businesses\/[^\/]+\/checks(\/.*)?$/;
  if (!targetRouteRegex.test(path)) {
    return; // Not a target route, do nothing
  }

  // 2. Get IP address
  const ip = getRequestIP(event);

  if (!ip) {
    // Unable to get IP, proceed without rate limiting
    return;
  }

  const now = Date.now();
  const windowStartTime = now - (WINDOW_SIZE_IN_SECONDS * 1000);

  // Get timestamps for this IP
  let timestamps = requestTimestamps.get(ip) || [];

  // 5. Clean up old timestamps
  timestamps = timestamps.filter(timestamp => timestamp > windowStartTime);

  // 3. Implement fixed-window rate-limiting algorithm
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    // 4. Send HTTP 429 error
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests. Please try again later.',
    });
  }

  // Record current timestamp
  timestamps.push(now);
  requestTimestamps.set(ip, timestamps);

  // Allow the request to proceed
});
