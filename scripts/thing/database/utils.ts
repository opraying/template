import slugify from '@sindresorhus/slugify'

export function formatMigrationName(name: string): string {
  // Truncate if longer
  const maxMigrationNameLength = 200

  return slugify(name, { separator: '_' }).substring(0, maxMigrationNameLength)
}
