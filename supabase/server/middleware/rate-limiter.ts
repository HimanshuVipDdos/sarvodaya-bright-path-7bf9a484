import { defineEventHandler, createError, getHeader } from 'h3';

// Simple in-memory rate store
const rateLimitStore = new Map<string, { count: number; timestamp: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100; // 100 requests per minute

export default defineEventHandler((event) => {
  // Vercel proxy intercepts requests. If we don't read these exact headers,
  // we either get Vercel's internal IP (tracking fails) or a spoofed IP from the hacker.
  // x-vercel-forwarded-for is injected by Vercel and CANNOT be spoofed by the attacker.
  const ip = getHeader(event, 'x-vercel-forwarded-for') || 
             getHeader(event, 'x-real-ip') || 
             getHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() || 
             'unknown';
  
  // Ignore static assets and internal nitro endpoints if needed
  if (event.path.startsWith('/_nitro') || event.path.startsWith('/_server')) {
    return;
  }

  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now - record.timestamp > WINDOW_MS) {
    // First request or window expired
    rateLimitStore.set(ip, { count: 1, timestamp: now });
  } else {
    // Existing record in window
    record.count++;
    if (record.count > MAX_REQUESTS) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Too Many Requests',
        message: 'You have been temporarily blocked for exceeding the rate limit.',
      });
    }
  }
});
