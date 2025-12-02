import babel from '@babel/core'
import { transform } from 'oxc-transform'
import type { FilterPattern } from 'vite'

export const reactCompilerPlugin = ({
  projectRoot,
  development = false,
  target,
  include,
  exclude,
}: {
  projectRoot: string
  development?: boolean | undefined
  target?: string[] | string | undefined
  include?: FilterPattern | undefined
  exclude?: FilterPattern | undefined
}) => {
  return {
    name: 'react-compiler-plugin',
    enforce: 'pre',
    transform: {
      filter: {
        id: { exclude: exclude ?? [], include: include ?? [] },
      },
      handler(code: string, id: string) {
        const [filepath] = id.split('?')

        return transform(id, code, {
          jsx: 'preserve',
          typescript: {
            onlyRemoveTypeImports: true,
          },
          sourcemap: true,
          sourceType: 'module',
          target: 'esnext',
          lang: 'tsx',
        }).then((output) =>
          babel
            .transformAsync(output.code, {
              configFile: false,
              babelrc: false,
              root: projectRoot,
              filename: id,
              sourceFileName: filepath,
              inputSourceMap: {
                file: output.map!.file!,
                sources: output.map!.sources,
                mappings: output.map!.mappings,
                names: output.map!.names,
                version: output.map!.version,
                sourceRoot: output.map!.sourceRoot,
                sourcesContent: output.map!.sourcesContent,
              },
              retainLines: false,
              targets: target ?? [],
              parserOpts: {
                sourceType: 'module',
                allowAwaitOutsideFunction: true,
                plugins: ['jsx'],
              },
              generatorOpts: {
                importAttributesKeyword: 'with',
                decoratorsBeforeExport: true,
                // https://github.com/babel/babel/issues/9804#issuecomment-480075309
                jsescOption: {
                  minimal: true,
                },
              },
              plugins: [
                ['babel-plugin-react-compiler', {}],
                [
                  development
                    ? '@babel/plugin-transform-react-jsx/lib/development'
                    : '@babel/plugin-transform-react-jsx',
                  { runtime: 'automatic' },
                ],
              ].filter((_) => !!_),
              sourceMaps: 'both',
              ast: false,
            })
            .then((result) => ({ code: result?.code ?? '', map: result?.map })),
        )
      },
    },
  }
}
