import PreprocessorDirectives from 'unplugin-preprocessor-directives/vite'
import type { FilterPattern, Plugin } from 'vite'

export const preprocessorDirectivePlugin = ({
  include,
  exclude,
}: {
  include: FilterPattern
  exclude: FilterPattern
}) => {
  const plugin = PreprocessorDirectives({ exclude, include }) as Plugin

  return {
    name: 'preprocessor-directives-plugin',
    enforce: 'pre',
    transform: {
      filter: {
        id: { exclude: exclude ?? [], include: include ?? [] },
      },
      handler(code: string, id: string, meta: any) {
        return (plugin.transform as any).call(this, code, id, meta)
      },
    },
  }
}
