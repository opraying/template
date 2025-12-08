import { join } from 'node:path'
import { workspaceRoot } from '@nx/devkit'

function projectConfig(dir) {
  const projectPath = join(workspaceRoot, dir)

  const config = {
    plugins: {
      'postcss-flexbugs-fixes': {},
      'postcss-preset-env': {
        autoprefixer: {
          flexbox: 'no-2009',
        },
        features: {
          'custom-properties': false,
        },
        stage: 3,
      },
      tailwindcss: {
        config: join(projectPath, 'tailwind.config.mjs'),
      },
    },
  }

  return config
}

export { projectConfig }
