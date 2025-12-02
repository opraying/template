import { join, resolve } from 'node:path'
import { workspaceRoot } from '@nx/devkit'
import defaultPreset from './tailwind-presets/default'

/**
 * @param {string} dir
 * @param {import('tailwindcss').Config} options
 */
function projectConfig(dir, options = {}) {
  const project = resolve(workspaceRoot, dir, '../')
  const packagesDir = join(workspaceRoot, 'packages')

  const pkgs = [
    `${packagesDir}/lib/src`,
    `${packagesDir}/errors/src`,
    `${packagesDir}/form/src`,
    `${packagesDir}/emails/src`,
    `${packagesDir}/app/src`,
    `${packagesDir}/app-kit/src`,
    `${packagesDir}/user-kit/src`,
    `${packagesDir}/local-first/src`,
  ]

  const projectPkgs = [
    `${project}/website`,
    `${project}/studio`,
    `${project}/web`,
    `${project}/desktop`,
    `${project}/client`,
    `${project}/shared`,
    `${project}/apps`,
  ]

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
