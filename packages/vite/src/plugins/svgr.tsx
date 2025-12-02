import type { FilterPattern } from 'vite'
import { transform, type Config as SvgrConfig } from '@svgr/core'
import { default as jsx } from '@svgr/plugin-jsx'
import * as viteModule from 'vite'
import * as fs from 'node:fs'

export const svgrPlugin = ({
  include,
  exclude,
  svgrOptions,
}: {
  include?: FilterPattern | undefined
  exclude?: FilterPattern | undefined
  svgrOptions?: SvgrConfig | undefined
} = {}) => {
  const postfixRE = /[?#].*$/s
  return {
    name: 'svgr-plugin',
    enforce: 'pre',
    transform: {
      filter: {
        id: { exclude: exclude ?? [], include: include ?? '**/*.svg?react' },
      },
      async handler(_code: string, id: string) {
        const filePath = id.replace(postfixRE, '')
        const svgCode = await fs.promises.readFile(filePath, 'utf8')
        const componentCode = await transform(
          svgCode,
          {
            plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
            icon: true,
            memo: true,
            expandProps: 'end',
            exportType: 'default',
            jsxRuntime: 'automatic',
            svgo: true,
            svgoConfig: {
              plugins: [
                {
                  name: 'preset-default',
                  params: {
                    overrides: {
                      cleanupIds: true,
                      removeTitle: true,
                      minifyStyles: true,
                      removeViewBox: false,
                    },
                  },
                } as any,
              ],
            },
            typescript: false,
            ...svgrOptions,
          },
          {
            componentName: 'ReactComponent',
            filePath,
            caller: {
              defaultPlugins: [jsx],
            },
          },
        )
        const result = await viteModule.transformWithOxc!(componentCode, id, { lang: 'jsx' })

        return {
          code: result.code,
          map: result.map,
        }
      },
    },
  }
}
