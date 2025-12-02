// @ts-ignore
import * as fs from 'node:fs'
import * as generatorHelper from '@prisma/generator-helper'
import { write as MarkdownWriter } from './markdown'

type Gen = typeof generatorHelper.generatorHandler

const gen: Gen = generatorHelper.generatorHandler || (generatorHelper as any).default.generatorHandler

gen({
  onManifest: () => ({
    version: '0.0.1',
    defaultOutput: './ERD.md',
    prettyName: 'prisma-markdown',
  }),
  onGenerate: async (options) => {
    const content: string = MarkdownWriter(options.dmmf.datamodel, options.generator.config)
    const file: string = options.generator.output?.value ?? './ERD.md'

    fs.writeFileSync(file, content, 'utf8')
  },
})
