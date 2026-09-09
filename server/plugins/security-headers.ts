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

    // 6. Permissions-Policy - explicitly allow autoplay, fullscreen, encrypted-media
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), browsing-topics=(), autoplay=*, fullscreen=*, encrypted-media=*, picture-in-picture=*';

    // 7. Content-Security-Policy (CSP) — strict, but with the specific
    // exceptions the video player genuinely needs.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://*.youtube.com https://*.ytimg.com https://s.ytimg.com https://www.youtube-nocookie.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.youtube.com https://*.youtube.com https://*.googlevideo.com https://*.google.com",
      "media-src 'self' https: blob: data:",
      "frame-src 'self' https://www.google.com/maps/ https://www.youtube.com https://*.youtube.com https://www.youtube-nocookie.com https://*.youtube-nocookie.com https://drive.google.com https://player.vimeo.com blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');

    response.headers['Content-Security-Policy'] = csp;
  });
});
