import browserslist from 'browserslist'

// convert the browserslist field in package.json to
export function browserslistBuildTarget(browserslistConfig: string) {
  const SUPPORTED_TARGETS = ['es', 'chrome', 'edge', 'firefox', 'ios', 'node', 'safari']

  // https://github.com/eBay/browserslist-config/issues/16#issuecomment-863870093
  const UNSUPPORTED = ['android 4']

  const replaces: Record<string, string> = {
    android: 'chrome',
    ios_saf: 'ios',
  }

  const separator = ' '

  return (
    browserslist(browserslistConfig)
      // filter out the unsupported ones
      .filter((b) => !UNSUPPORTED.some((u) => b.startsWith(u)))
      // transform into ['chrome', '88']
      .map((b) => b.split(separator))
      // replace the similar browser
      .map((b) => {
        if (replaces[b[0]]) {
          b[0] = replaces[b[0]]
        }

        return b
      })
      // 11.0-12.0 --> 11.0
      .map((b) => {
        if (b[1].includes('-')) {
          b[1] = b[1].slice(0, b[1].indexOf('-'))
        }

        return b
      })
      // 11.0 --> 11
      .map((b) => {
        if (b[1].endsWith('.0')) {
          b[1] = b[1].slice(0, -2)
        }

        return b
      })
      .filter((b) => SUPPORTED_TARGETS.includes(b[0]))
      // only get the oldest version
      .reduce(
        (acc, b) => {
          const existingIndex = acc.findIndex((br) => br[0] === b[0])

          if (existingIndex !== -1) {
            acc[existingIndex][1] = b[1]
          } else {
            acc.push(b)
          }

          return acc
        },
        [] as Array<Array<string>>,
      )
      // remove separator
      .map((b) => b.join(''))
  )
}
