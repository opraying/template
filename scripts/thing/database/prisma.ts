import * as PrismaInternal from '@prisma/internals'
export type { EngineArgs } from '@prisma/migrate'
import * as PrismaMigrate from '@prisma/migrate'

const { formatSchema, loadSchemaContext } = ((PrismaInternal as any).default as typeof PrismaInternal) ?? PrismaInternal

export { formatSchema, loadSchemaContext }

const { SchemaEngineCLI } = ((PrismaMigrate as any).default as typeof PrismaMigrate) ?? PrismaMigrate

export { SchemaEngineCLI }
