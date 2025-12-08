const compilerRules = {
  exclude: [
    /\/node_modules/,
    /\.css$/,
    /\.server\.tsx?$/,
    /.*\/locales/,
    /packages\/lib\/src\/hooks\/.*/,
    /packages\/lib\/src\/ui\/.*/,
    /packages\/sqlite/,
    /packages\/cms/,
    /packages\/fx\/.*/,
    /.*\/server/,
    /.*\/db/,
    /client\/worker-runner\.ts/,
    /client\/worker-pool\.ts/,
    /client\/api-client\.ts/,
  ],
  include: [/(hooks|components|ui|atom)\/.*\.tsx?/, /hooks\.tsx?$/, /packages\/sqlite\/src\/.*\.ts/, /.*\.tsx/],
}

// Cache for compiler rule matching results
const compilerRuleCache = new Map()

module.exports = (api) => {
  api.cache(true)
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          unstable_transformImportMeta: true,
          jsxImportSource: 'nativewind',
          lazyImports: true,
          worklets: true,
          reanimated: true,
          'react-compiler': {
            sources: (filename) => {
              // Check cache first
              if (compilerRuleCache.has(filename)) {
                return compilerRuleCache.get(filename)
              }

              // Check against compiler rules
              const isExcluded = compilerRules.exclude.some((rule) => rule.test(filename))
              const isIncluded = compilerRules.include.some((rule) => rule.test(filename))

              // Include file if it matches include rules and not excluded
              const result = isIncluded && !isExcluded

              // Cache the result
              compilerRuleCache.set(filename, result)

              return result
            },
          },
        },
      ],
      'nativewind/babel',
    ],
    plugins: ['hot-updater/babel-plugin'],
  }
}
