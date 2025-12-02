#!/usr/bin/env tsx

import { workspaceRoot } from '@nx/devkit'
import { exec } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { ALIAS_DEFINITIONS, PROJECT_DEFINITIONS } from '../project-manifest'
import baseConfig from './generate-tsconfig/base-config.json'
import {
  applyAliasPathsToBaseConfig,
  buildProjectBaseTsconfig,
  DefaultRootConfig,
  generateAppConfigs,
  generateAppLibraryConfigs,
  generatePackageLibraryConfigs,
} from './generate-tsconfig/config'
import type { ProjectItemDeclaration } from './generate-tsconfig/types'

async function generateTsConfigFile({
  filePath,
  config,
  dryRun = true,
}: {
  filePath: string
  config: any
  dryRun?: boolean
}) {
  const content = JSON.stringify(config, null, 2)

  if (dryRun) {
    console.log(`\n📁 ${filePath}`)
    console.log('─'.repeat(60))
    console.log(content)
  } else {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content)
    console.log(`✅ Created: ${filePath}`)
  }
}

async function writeLibraryConfigs({
  projectRoot,
  item,
  dryRun,
}: {
  projectRoot: string
  item: ProjectItemDeclaration
  dryRun: boolean
}) {
  const itemPath = path.join(projectRoot, item.name)
  const isPackage = item.options?.isPackage ?? false

  if (isPackage) {
    const configs = generatePackageLibraryConfigs({ item })

    await generateTsConfigFile({
      filePath: path.join(itemPath, 'tsconfig.json'),
      config: configs.main,
      dryRun,
    })

    await generateTsConfigFile({
      filePath: path.join(itemPath, 'tsconfig.lib.json'),
      config: configs.lib,
      dryRun,
    })

    await generateTsConfigFile({
      filePath: path.join(itemPath, 'tsconfig.test.json'),
      config: configs.test,
      dryRun,
    })

    await generateTsConfigFile({
      filePath: path.join(itemPath, 'tsconfig.check.json'),
      config: configs.check,
      dryRun,
    })

    return
  }

  const configs = generateAppLibraryConfigs({ item })

  await generateTsConfigFile({
    filePath: path.join(itemPath, 'tsconfig.json'),
    config: configs.main,
    dryRun,
  })

  await generateTsConfigFile({
    filePath: path.join(itemPath, 'tsconfig.app.json'),
    config: configs.app,
    dryRun,
  })

  await generateTsConfigFile({
    filePath: path.join(itemPath, 'tsconfig.test.json'),
    config: configs.test,
    dryRun,
  })
}

async function writeApplicationConfigs({
  projectRoot,
  item,
  dryRun,
  allItems,
}: {
  projectRoot: string
  item: ProjectItemDeclaration
  dryRun: boolean
  allItems: ProjectItemDeclaration[]
}) {
  const itemPath = path.join(projectRoot, item.name)
  const configs = generateAppConfigs({ item, allItems })

  await generateTsConfigFile({
    filePath: path.join(itemPath, 'tsconfig.json'),
    config: configs.main,
    dryRun,
  })

  await generateTsConfigFile({
    filePath: path.join(itemPath, 'tsconfig.app.json'),
    config: configs.app,
    dryRun,
  })

  await generateTsConfigFile({
    filePath: path.join(itemPath, 'tsconfig.test.json'),
    config: configs.test,
    dryRun,
  })

  await generateTsConfigFile({
    filePath: path.join(itemPath, 'tsconfig.check.json'),
    config: configs.check,
    dryRun,
  })
}

// 主函数
async function main() {
  try {
    const shouldWrite = process.argv.includes('--write') || process.argv.includes('-w')
    const dryRun = !shouldWrite

    console.log('🚀 Starting TSConfig synchronization...')
    console.log(`📂 Workspace root: ${workspaceRoot}`)
    console.log(`🔧 Mode: ${dryRun ? 'DRY RUN (preview only)' : 'WRITE MODE (will create files)'}`)

    if (dryRun) {
      console.log('💡 Use --write or -w flag to actually write files')
    }

    // 更新 base config 以包含生成的所有 paths
    const updatedBaseConfig = applyAliasPathsToBaseConfig(baseConfig, ALIAS_DEFINITIONS)

    // 首先生成根目录的 tsconfig.base.json
    await generateTsConfigFile({
      dryRun,
      filePath: path.join(workspaceRoot, 'tsconfig.base.json'),
      config: updatedBaseConfig,
    })

    await generateTsConfigFile({
      dryRun,
      filePath: path.join(workspaceRoot, 'tsconfig.json'),
      config: DefaultRootConfig,
    })

    for (const definition of PROJECT_DEFINITIONS) {
      // 生成项目级别的 base config
      console.log(`\n🏗️  Generating configs for project: ${definition.projectName}`)
      console.log('='.repeat(80))

      const projectRoot = path.join(workspaceRoot, definition.projectName)

      for (const item of definition.items) {
        if (item.kind === 'library') {
          await writeLibraryConfigs({
            projectRoot,
            item,
            dryRun,
          })
        } else {
          await writeApplicationConfigs({
            projectRoot,
            item,
            dryRun,
            allItems: definition.items,
          })
        }
      }

      for (const target of definition.baseTargets ?? []) {
        const targetItems = definition.items
        const projectName = definition.projectName + '/' + target.name
        await generateTsConfigFile({
          dryRun,
          filePath: path.join(workspaceRoot, projectName, 'tsconfig.base.json'),
          config: buildProjectBaseTsconfig({
            workspaceRoot,
            projectName,
            baseConfig: updatedBaseConfig,
            items: targetItems,
            aliasOptions: target.alias,
          }),
        })
      }
    }

    console.log('\n✨ Configuration generation completed!')

    // 展示生成的 Vite 别名配置
    if (dryRun) {
      console.log('\n💡 This was a dry run. Use --write flag to actually create the files.')

      return
    }

    exec("rg -t json --files --glob 'tsconfig*.json' | xargs ./node_modules/.bin/prettier --write 2>/dev/null")

    console.log('✅ All configuration files have been written successfully!')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
