import { join, resolve } from 'node:path'
import { readdirSync, statSync } from 'node:fs'
import { workspaceRoot } from '@nx/devkit'
import defaultPreset from './tailwind-presets/default'

/**
 * @param {string} dir
 * @param {import('tailwindcss').Config} options
 */
function projectConfig(dir, options = {}) {
  const currentProject = resolve(workspaceRoot, dir)
  const packagesDir = join(workspaceRoot, 'packages')
  const parentDir = resolve(currentProject, '../')

  const pkgs = [
    'lib/src',
    'errors/src',
    'form/src',
    'emails/src',
    'app/src',
    'app-kit/src',
    'user-kit/src',
    'local-first/src',
  ].map((item) => join(packagesDir, item))

  const filterList = ['native']
  const projectPkgs = readdirSync(parentDir)
    .filter((item) => {
      const fullPath = join(parentDir, item)
      return statSync(fullPath).isDirectory() && !filterList.includes(item)
    })
    .map((item) => join(parentDir, item))

  const content = pkgs.concat(projectPkgs).map((item) => `${item}/**/*.tsx`)

  /** @type {import('tailwindcss').Config} */
  const config = {
    content,
    darkMode: 'class',
    ...options,
    presets: [defaultPreset, ...(options.presets || [])],
  }

  return config
}

export { projectConfig }

function libConfig(dir, options = {}) {
  const project = join(workspaceRoot, dir)
  const content = [`${project}/**/*.tsx`]

  /** @type {import('tailwindcss').Config} */
  const config = {
    content,
    darkMode: 'class',
    ...options,
    presets: [defaultPreset, ...(options.presets || [])],
  }

  return config
}
export { libConfig }
