/**
 * A lightweight SQLite query parser that extracts table names and query types.
 * Optimized for performance with caching and minimal regex patterns.
 */

export interface ParsedSql {
  tables: string[]
  type: string
}

// Cache for parsed SQL queries
const CACHE_SIZE = 100
const queryCache = new Map<string, ParsedSql>()

// Basic query types supported by SQLite
const QUERY_TYPES = {
  SELECT: 'SELECT',
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  WITH: 'WITH',
  REPLACE: 'REPLACE',
  CREATE: 'CREATE',
  DROP: 'DROP',
  ALTER: 'ALTER',
} as const

type QueryType = keyof typeof QUERY_TYPES

/**
 * Optimized patterns for table name extraction
 * - Supports quoted identifiers (", ', [])
 * - Handles schema prefixes and aliases
 * - Matches SQLite's flexible identifier rules
 */
const PATTERNS = {
  // Base pattern for table names including quotes and brackets
  TABLE: String.raw`(?:"[^"]*"|'[^']*'|\[[^\]]*\]|[a-zA-Z_][a-zA-Z0-9_]*)`,

  // Common SQL patterns
  get FROM() {
    return new RegExp(String.raw`\sFROM\s+(${this.TABLE}(?:\s*,\s*${this.TABLE})*)`, 'gi')
  },
  get JOIN() {
    return new RegExp(String.raw`\s(?:LEFT|RIGHT|INNER|OUTER|CROSS|NATURAL)?\s*JOIN\s+(${this.TABLE})`, 'gi')
  },
  get UPDATE() {
    return new RegExp(
      String.raw`UPDATE(?:\s+OR\s+(?:ROLLBACK|ABORT|REPLACE|FAIL|IGNORE))?\s+(${this.TABLE}(?:\s*,\s*${this.TABLE})*)`,
      'gi',
    )
  },
  get INSERT() {
    return new RegExp(
      String.raw`INSERT(?:\s+OR\s+(?:ROLLBACK|ABORT|REPLACE|FAIL|IGNORE))?\s+INTO\s+(${this.TABLE})`,
      'gi',
    )
  },
  get CREATE_TABLE() {
    return new RegExp(String.raw`CREATE\s+(?:TEMP|TEMPORARY\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(${this.TABLE})`, 'gi')
  },
} as const

/**
 * Extracts and normalizes table names from a SQL string using a regex pattern
 * @param sql The SQL query string
 * @param pattern The regex pattern to match table names
 * @returns Array of table names preserving their original case
 */
const extractTableNames = (sql: string, pattern: RegExp): string[] => {
  const tables = new Set<string>()
  const matches = sql.matchAll(pattern)

  for (const match of matches) {
    if (!match[1]) continue

    for (const tablePart of match[1].split(',')) {
      let tableName = tablePart.trim()

      // Remove schema prefix if exists, but preserve the table name case
      const schemaIndex = tableName.indexOf('.')
      if (schemaIndex !== -1) {
        tableName = tableName.slice(schemaIndex + 1)
      }

      // Remove quotes/brackets and aliases while preserving original case
      const quoteChars = ['"', "'", '[']
      const firstChar = tableName[0]

      if (quoteChars.includes(firstChar)) {
        const lastChar = tableName[tableName.length - 1]
        if (
          (firstChar === '"' && lastChar === '"') ||
          (firstChar === "'" && lastChar === "'") ||
          (firstChar === '[' && lastChar === ']')
        ) {
          tableName = tableName.slice(1, -1)
        }
      }

      // Remove alias while preserving case
      tableName = tableName.split(/\s+(?:AS\s+)?/i)[0]

      if (tableName) {
        tables.add(tableName)
      }
    }
  }

  return Array.from(tables)
}

/**
 * Gets the query type from a SQL string
 * @param sql The SQL query string
 * @returns The query type or "unknown"
 */
const getQueryType = (sql: string): string => {
  const match = sql.match(/^\s*([A-Za-z]+)/)
  if (!match || !match[1]) return 'unknown'

  const firstWord = match[1].toUpperCase() as string
  return firstWord in QUERY_TYPES ? firstWord.toLowerCase() : 'unknown'
}

/**
 * Parses a SQL query to extract table names and query type
 * Includes caching for better performance on repeated queries
 * @param sql The SQL query to parse
 * @returns ParsedSql object containing tables and query type
 */
export const parseSql = (sql: string): ParsedSql => {
  // Check cache first
  const cacheKey = sql.trim()
  const cached = queryCache.get(cacheKey)
  if (cached) return cached

  // Use case-insensitive matching for keywords but preserve table names
  const upperSql = sql.trim().toUpperCase()
  const tables = new Set<string>()
  const type = getQueryType(upperSql)

  // Extract tables based on query type
  switch (type) {
    case 'select':
      extractTableNames(sql, PATTERNS.FROM).forEach((t) => tables.add(t))
      extractTableNames(sql, PATTERNS.JOIN).forEach((t) => tables.add(t))
      break

    case 'update':
      extractTableNames(sql, PATTERNS.UPDATE).forEach((t) => tables.add(t))
      extractTableNames(sql, PATTERNS.FROM).forEach((t) => tables.add(t))
      break

    case 'insert':
      extractTableNames(sql, PATTERNS.INSERT).forEach((t) => tables.add(t))
      break

    case 'create':
      extractTableNames(sql, PATTERNS.CREATE_TABLE).forEach((t) => tables.add(t))
      break
  }

  const result = {
    tables: Array.from(tables),
    type,
  }

  // Update cache with LRU-like behavior
  if (queryCache.size >= CACHE_SIZE) {
    const firstKey = queryCache.keys().next().value
    if (firstKey) queryCache.delete(firstKey)
  }
  queryCache.set(cacheKey, result)

  return result
}
