import { defineNitroPlugin } from 'nitropack/runtime';

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:response', (response, { event }) => {
    // 1. Strict Transport Security (HSTS) - Force HTTPS, prevent downgrade attacks
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';

    // 2. X-Content-Type-Options - Prevent MIME-sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff';

    // 3. X-Frame-Options - Prevent Clickjacking (can't embed in iframes)
    response.headers['X-Frame-Options'] = 'DENY';

    // 4. X-XSS-Protection - Legacy browser XSS filter
    response.headers['X-XSS-Protection'] = '1; mode=block';

    // 5. Referrer-Policy - Do not leak referrers to external sites
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin';

    // 6. Content-Security-Policy (CSP) - Ultra strict
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", 
      "style-src 'self' 'unsafe-inline'", 
      "img-src 'self' data: https: blob:", 
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co", 
      "frame-src 'self' https://www.google.com/maps/", 
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'", 
    ].join('; ');

    response.headers['Content-Security-Policy'] = csp;
  });
});
