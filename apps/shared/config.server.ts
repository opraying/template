export const headers = {
  'Cross-Origin-Resource-Policy': 'same-origin',

  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'on',
  'X-Download-Options': 'noopen',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'origin-when-cross-origin',

  ...(process.env.NODE_ENV === 'development'
    ? {
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline' insight.opraying.com cdn.paddle.com; style-src 'self' 'unsafe-inline' cdn.paddle.com sandbox-cdn.paddle.com; object-src 'none'; base-uri 'self'; connect-src 'self' insight.opraying.com; font-src 'self'; frame-src 'self' buy.paddle.com sandbox-buy.paddle.com; img-src 'self' data: cdn.sanity.io template.opraying.com static-template.opraying.com; manifest-src 'self'; media-src 'self'; worker-src 'self';",
      }
    : {
        'X-Frame-Options': 'DENY',
        ...(process.env.STAGE === 'production'
          ? {
              'Content-Security-Policy':
                "default-src 'self'; script-src 'self' 'unsafe-inline' insight.opraying.com cdn.paddle.com; style-src 'self' 'unsafe-inline' cdn.paddle.com; object-src 'none'; base-uri 'self'; connect-src 'self' insight.opraying.com; font-src 'self'; frame-src 'self' buy.paddle.com; img-src 'self' data: cdn.sanity.io static-template.opraying.com; manifest-src 'self'; media-src 'self'; worker-src 'self';",
            }
          : {
              'Content-Security-Policy':
                "default-src 'self'; script-src 'self' 'unsafe-inline' insight.opraying.com cdn.paddle.com; style-src 'self' 'unsafe-inline' cdn.paddle.com sandbox-cdn.paddle.com; object-src 'none'; base-uri 'self'; connect-src 'self' insight.opraying.com; font-src 'self'; frame-src 'self' buy.paddle.com sandbox-buy.paddle.com; img-src 'self' data: cdn.sanity.io static-template.opraying.com; manifest-src 'self'; media-src 'self'; worker-src 'self';",
            }),
      }),
}
