const buildCSP = (directives: Record<string, string[]>): string => {
  return (
    Object.entries(directives)
      .map(([key, values]) => `${key} ${values.join(' ')}`)
      .join('; ') + ';'
  )
}

const commonDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'insight.opraying.com', 'cdn.paddle.com'],
  'style-src': ["'self'", "'unsafe-inline'", 'cdn.paddle.com'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'connect-src': ["'self'", 'insight.opraying.com'],
  'font-src': ["'self'"],
  'frame-src': ["'self'", 'buy.paddle.com'],
  'img-src': ["'self'", 'data:', 'cdn.sanity.io', 'static-template.opraying.com'],
  'manifest-src': ["'self'"],
  'media-src': ["'self'"],
  'worker-src': ["'self'"],
}

const developmentDirectives = {
  ...commonDirectives,
  'img-src': [...commonDirectives['img-src'], 'template.opraying.com'],
  'style-src': [...commonDirectives['style-src'], 'sandbox-cdn.paddle.com'],
  'frame-src': [...commonDirectives['frame-src'], 'sandbox-buy.paddle.com'],
}

const stagingDirectives = {
  ...commonDirectives,
  'style-src': [...commonDirectives['style-src'], 'sandbox-cdn.paddle.com'],
  'frame-src': [...commonDirectives['frame-src'], 'sandbox-buy.paddle.com'],
}

export const headers = {
  'Cross-Origin-Resource-Policy': 'same-origin',

  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'on',
  'X-Download-Options': 'noopen',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'origin-when-cross-origin',

  ...(process.env.NODE_ENV === 'development'
    ? {
        'Content-Security-Policy': buildCSP(developmentDirectives),
      }
    : {
        'X-Frame-Options': 'DENY',
        ...(process.env.STAGE === 'production'
          ? {
              'Content-Security-Policy': buildCSP(commonDirectives),
            }
          : {
              'Content-Security-Policy': buildCSP(stagingDirectives),
            }),
      }),
}
