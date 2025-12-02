import type { SqlStorage } from '@cloudflare/workers-types'

/**
 * fork from https://github.com/outerbase/starbasedb
 */
export class DoSqliteHelper {
  readonly sql: SqlStorage

  constructor(sql: SqlStorage) {
    this.sql = sql
  }

  private getTableData(tableName: string): Array<any> {
    // Verify if the table exists
    const tableExistsResult = this.sql
      .exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`)
      .toArray()

    if (tableExistsResult.length === 0) {
      return []
    }

    // Get table data
    const dataResult = this.sql.exec(`SELECT * FROM '${tableName}'`).toArray()

    return dataResult
  }

  private parseValue(value: string, columnType: string): any {
    if (value === '') return null

    switch (columnType.toUpperCase()) {
      case 'BOOLEAN':
        return value.toLowerCase() === 'true' ? 1 : 0
      case 'INTEGER':
        return Number.parseInt(value, 10)
      case 'REAL':
        return Number.parseFloat(value)
      default:
        return value
    }
  }

  async importFromCSV(csvData: CsvData, table: string): Promise<ImportResponse> {
    function parseCSV(csv: string): Record<string, string>[] {
      const lines = csv.split('\n')
      const headers = lines[0].split(',').map((header) => header.trim())
      const records: Record<string, string>[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        const values: string[] = []
        let inQuotes = false
        let currentValue = ''

        for (let j = 0; j < line.length; j++) {
          const char = line[j]

          if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
              currentValue += '"'
              j++
            } else {
              inQuotes = !inQuotes
            }
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim())
            currentValue = ''
          } else {
            currentValue += char
          }
        }
        values.push(currentValue.trim())

        if (values.length === headers.length) {
          const record: Record<string, string> = {}
          headers.forEach((header, index) => {
            record[header] = values[index].replace(/^"(.*)"$/, '$1')
          })
          records.push(record)
        }
      }

      return records
    }

    try {
      if (!csvData.data) {
        return {
          _tag: 'import',
          success: false,
          message: 'CSV data is empty',
          results: [],
        }
      }

      const { data: csvContent, columnMapping = {} } = csvData
      const records = parseCSV(csvContent)

      if (records.length === 0) {
        return {
          _tag: 'import',
          success: false,
          message: 'Invalid CSV format or empty data',
          results: [],
        }
      }

      const results: ImportResponse['results'] = []
      let successCount = 0

      // 获取表结构信息
      const tableInfo = this.sql.exec(`PRAGMA table_info(${table})`).toArray()
      const columnTypes = tableInfo.reduce<Record<string, string>>((acc, col) => {
        if (typeof col.name === 'string' && typeof col.type === 'string') {
          acc[col.name] = col.type
        }
        return acc
      }, {})

      for (const record of records) {
        const mappedRecord = mapRecord(record, columnMapping)
        const columns = Object.keys(mappedRecord)
        const values = columns.map((col) => this.parseValue(mappedRecord[col], columnTypes[col]))
        const placeholders = values.map(() => '?').join(', ')

        const statement = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`

        try {
          this.sql.exec(statement, ...values)
          successCount++
          results.push({ success: true, statement })
        } catch (error: any) {
          results.push({
            statement,
            success: false,
            error: error.message || 'Unknown error',
          })
        }
      }

      const totalRecords = records.length
      const failedCount = results.filter((r) => !r.success).length

      return {
        _tag: 'import',
        success: true,
        message: `Imported ${successCount} out of ${totalRecords} records successfully. ${failedCount} records failed.`,
        results,
      }
    } catch (error: any) {
      return {
        _tag: 'import',
        success: false,
        message: `Failed to import CSV data: ${error.message}`,
        results: [],
      }
    }
  }

  async importFromJSON(jsonData: JsonData, table: string): Promise<ImportResponse> {
    try {
      if (!Array.isArray(jsonData.data)) {
        return {
          _tag: 'import',
          success: false,
          message: 'Invalid JSON format. Expected an object with "data" array and optional "columnMapping".',
          results: [],
        }
      }

      const { data, columnMapping = {} } = jsonData

      const results: ImportResponse['results'] = []
      let successCount = 0

      const tableInfo = this.sql.exec(`PRAGMA table_info(${table})`).toArray()
      const columnTypes = tableInfo.reduce(
        (acc, col) => {
          if (typeof col.name === 'string' && typeof col.type === 'string') {
            acc[col.name] = col.type
          }
          return acc
        },
        {} as Record<string, string>,
      )

      for (const record of data) {
        const mappedRecord = mapRecord(record, columnMapping)
        const columns = Object.keys(mappedRecord)
        let hasError = false

        // Validate types before insertion
        columns.forEach((col) => {
          const value = mappedRecord[col]
          const type = typeof columnTypes[col] === 'string' ? columnTypes[col].toUpperCase() : columnTypes[col]

          if (type === 'INTEGER' && !Number.isInteger(Number(value))) {
            hasError = true
          } else if (type === 'REAL' && Number.isNaN(Number(value))) {
            hasError = true
          }
        })

        if (hasError) {
          results.push({
            statement: `INSERT INTO ${table}...`,
            success: false,
            error: 'Type validation failed',
          })
          continue
        }

        const values = Object.values(mappedRecord)
        const placeholders = values.map(() => '?').join(', ')

        const statement = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`

        try {
          this.sql.exec(statement, ...values)
          successCount++
          results.push({ statement, success: true })
        } catch (error: any) {
          results.push({
            statement,
            success: false,
            error: error.message || 'Unknown error',
          })
        }
      }

      const totalRecords = data.length
      const failedCount = results.filter((r) => !r.success).length

      return {
        _tag: 'import',
        success: true,
        message: `Imported ${successCount} out of ${totalRecords} records successfully. ${failedCount} records failed.`,
        results,
      }
    } catch (error: any) {
      return {
        _tag: 'import',
        success: false,
        message: `Failed to import JSON data: ${error.message}`,
        results: [],
      }
    }
  }

  async importFromSQL(sqlContent: string): Promise<ImportResponse> {
    function parseSqlStatements(sqlContent: string): string[] {
      const lines = sqlContent.split('\n')
      let currentStatement = ''
      const statements: string[] = []

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith('--') || trimmedLine === '') {
          continue // Skip comments and empty lines
        }

        currentStatement += `${line}\n`

        if (trimmedLine.endsWith(';')) {
          statements.push(currentStatement.trim())
          currentStatement = ''
        }
      }

      // Add any remaining statement without a semicolon
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim())
      }

      return statements
    }

    try {
      if (!sqlContent) {
        return {
          _tag: 'import',
          success: false,
          message: 'SQL content is empty',
          results: [],
        }
      }

      let sql = sqlContent
      // Remove the SQLite format header if present
      if (sqlContent.startsWith('SQLite format 3')) {
        sql = sqlContent.substring(sqlContent.indexOf('\n') + 1)
      }

      const sqlStatements = parseSqlStatements(sql)
      const results: ImportResponse['results'] = []

      for (const statement of sqlStatements) {
        try {
          this.sql.exec(statement)
          results.push({ statement, success: true })
        } catch (error: any) {
          results.push({ statement, success: false, error: error.message })
        }
      }

      const successCount = results.filter((r) => r.success).length
      const failureCount = results.filter((r) => !r.success).length

      if (failureCount === 0) {
        return {
          _tag: 'import',
          success: true,
          message: 'SQL dump import completed.',
          results,
        }
      }

      return {
        _tag: 'import',
        success: false,
        message: `SQL dump import completed. ${successCount} statements succeeded, ${failureCount} failed.`,
        results: results,
      }
    } catch (error: any) {
      return {
        _tag: 'import',
        success: false,
        message: `Failed to import SQL file: ${error.message}`,
        results: [],
      }
    }
  }

  exportAsCSV(table: string): ExportResponse {
    try {
      // First check if table exists
      const tableExistsResult = this.sql
        .exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`)
        .toArray()

      if (tableExistsResult.length === 0) {
        return {
          _tag: 'export',
          success: false,
          message: `Table '${table}' does not exist.`,
          error: '',
        }
      }

      // Get table structure for headers
      const tableInfo = this.sql.exec(`PRAGMA table_info(${table})`).toArray()
      const headers = tableInfo.map((col) => col.name).join(',')

      // Get table data
      const data = this.getTableData(table)
      let csvContent = `${headers}\n`

      if (data.length > 0) {
        data.forEach((row: any) => {
          csvContent +=
            Object.values(row)
              .map((value) => {
                const stringValue =
                  typeof value === 'number' && (value === 0 || value === 1) ? String(Boolean(value)) : String(value)

                if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                  return `"${stringValue.replace(/"/g, '""')}"`
                }
                return stringValue
              })
              .join(',') + '\n'
        })
      }

      return {
        _tag: 'export',
        success: true,
        message: `Successfully exported ${data.length} rows to CSV`,
        data: csvContent,
      }
    } catch (error: any) {
      return {
        _tag: 'export',
        success: false,
        message: 'Failed to export table to CSV',
        error: error.message,
      }
    }
  }

  exportAsJSON(table: string): ExportResponse {
    try {
      const tableResult = this.getTableData(table)
      if (!tableResult || tableResult.length === 0) {
        return {
          _tag: 'export',
          success: true,
          message: `Table '${table}' does not exist.`,
          data: [],
        }
      }

      const processedData = tableResult.map((row) => {
        const newRow = { ...row }
        const tableInfo = this.sql.exec(`PRAGMA table_info(${table})`).toArray()
        tableInfo.forEach((col) => {
          if (
            typeof col.type === 'string' &&
            col.type.toUpperCase() === 'BOOLEAN' &&
            typeof newRow[col.name as keyof typeof newRow] === 'number'
          ) {
            newRow[col.name as keyof typeof newRow] = Boolean(newRow[col.name as keyof typeof newRow])
          }
        })
        return newRow
      })

      return {
        _tag: 'export',
        success: true,
        message: `Successfully exported ${tableResult.length} rows to JSON`,
        data: JSON.stringify(processedData, null, 4),
      }
    } catch (error: any) {
      return {
        _tag: 'export',
        success: false,
        message: 'Failed to export table to JSON',
        error: error.message,
      }
    }
  }

  dump(): ExportResponse {
    try {
      const tablesResult = this.sql.exec("SELECT name FROM sqlite_master WHERE type='table';").toArray()
      if (!tablesResult || tablesResult.length === 0) {
        return {
          _tag: 'export',
          success: true,
          message: 'No tables found in database',
          data: '',
        }
      }

      const tables = tablesResult.map((row: any) => row.name)
      let dumpContent = 'SQLite format 3\0'

      for (const table of tables) {
        const schemaResult = this.sql
          .exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}';`)
          .toArray()

        if (schemaResult.length) {
          const schema = schemaResult[0].sql
          dumpContent += `\n-- Table: ${table}\n${schema};\n\n`
        }

        const dataResult = this.sql.exec(`SELECT * FROM ${table};`).toArray()

        for (const row of dataResult) {
          const values = Object.values(row).map((value) =>
            typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : value,
          )
          dumpContent += `INSERT INTO ${table} VALUES (${values.join(', ')});\n`
        }

        dumpContent += '\n'
      }

      return {
        _tag: 'export',
        success: true,
        message: `Successfully dumped ${tables.length} tables`,
        data: dumpContent,
      }
    } catch (error: any) {
      return {
        _tag: 'export',
        success: false,
        message: 'Failed to create database dump',
        error: error.message,
      }
    }
  }
}

export interface ColumnMapping {
  [key: string]: string
}

export const isExportResponse = (value: any): value is ExportResponse => {
  return value && value._tag === 'export'
}

export type ExportResponse =
  | {
      _tag: 'export'
      message: string
      success: true
      data: any
    }
  | {
      _tag: 'export'
      message: string
      success: false
      error: string
    }

export const isImportResponse = (value: any): value is ImportResponse => {
  return value && value._tag === 'import'
}

export type ImportResponse =
  | {
      _tag: 'import'
      success: true
      message: string
      results: Array<{
        statement: string
        success: boolean
        error?: string
      }>
    }
  | {
      _tag: 'import'
      success: false
      message: string
      results: Array<{
        statement: string
        success: boolean
        error?: string
      }>
    }

export interface CsvData {
  data: string
  columnMapping?: Record<string, string>
}

export interface JsonData {
  data: ReadonlyArray<any>
  columnMapping?: Record<string, string>
}

function mapRecord(record: any, columnMapping: ColumnMapping): any {
  const mappedRecord: any = {}
  for (const [key, value] of Object.entries(record)) {
    const mappedKey = columnMapping[key] || key
    mappedRecord[mappedKey] = value
  }
  return mappedRecord
}
