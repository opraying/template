import '@glideapps/glide-data-grid/dist/index.css'
import {
  DataEditor,
  type GridCell,
  GridCellKind,
  type GridColumn,
  GridColumnIcon,
  type Item,
} from '@glideapps/glide-data-grid'
import { DebugPanelDrawerItem } from '@xstack/app/debug/components'
import { DBService } from '@xstack/app/debug/database/hooks'
import { uuidString } from '@xstack/fx/utils'
import useSize from 'ahooks/es/useSize'
import * as Cause from 'effect/Cause'
import * as Option from 'effect/Option'
import * as MsgPack from 'msgpackr'
import { Suspense, useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

export const DatabaseItem = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => {
      setVisible(true)
    }, 2000)
  }, [])

  return (
    <DebugPanelDrawerItem
      icon={'❇️'}
      title={
        visible && (
          <ErrorBoundary fallback="DB">
            <DBTitle />
          </ErrorBoundary>
        )
      }
    >
      <DatabaseView />
    </DebugPanelDrawerItem>
  )
}

function DBTitle() {
  const dbService = DBService.useAtom
  const { value: lockAcquire } = dbService.lockAcquire()

  return (
    <span className="flex items-center gap-1">
      <span className="font-medium">DB</span>
      {lockAcquire && <span className="text-yellow-500">🔑</span>}
    </span>
  )
}

function DatabaseView() {
  const dbService = DBService.useAtom
  const [selectModule, setSelectModule] = dbService.selectModule.use()

  return (
    <div className="flex flex-1 px-4">
      {/* Left column */}
      <div className="flex flex-col gap-4 min-w-[240px]">
        <div className="flex flex-col gap-2">
          <Button onClick={() => setSelectModule('runner')}>Runner</Button>
          <Button onClick={() => setSelectModule('migration')}>Migration</Button>
          <Separator />
          <div className="flex justify-around">
            <Button variant={'ghost'} size="icon" className="" onClick={() => dbService.export({})}>
              <i className="i-lucide-download" />
            </Button>

            <Button variant={'ghost'} size="icon" className="" type="button">
              <Input
                type="file"
                className="size-full"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    const file = e.target.files[0]
                    dbService.import(file)
                  }
                }}
              />
              <i className="i-lucide-upload" />
            </Button>
          </div>
        </div>
        <Separator />
        <Suspense fallback={<div>Loading...</div>}>
          <Tables />{' '}
        </Suspense>
      </div>
      {/* Right area */}
      <div className="flex-1 flex flex-col pl-4">
        {selectModule === 'runner' && (
          <Suspense fallback={<div>Loading...</div>}>
            <QueryEditor />
          </Suspense>
        )}
        {selectModule === 'migration' && (
          <Suspense fallback={<div>Loading...</div>}>
            <Migrations />
          </Suspense>
        )}
        {selectModule === 'table' && (
          <Suspense fallback={<div>Loading...</div>}>
            <TableView />
          </Suspense>
        )}
      </div>
    </div>
  )
}

function Tables(_props: {}) {
  const dbService = DBService.useAtom
  const { value: tables } = dbService.tables()

  return (
    <div>
      <div className="flex flex-col gap-y-2">
        {tables.map((table) => (
          <Button
            key={table.name}
            variant={'outline' as any}
            className="justify-between"
            onClick={() => {
              dbService.selectedTable(Option.some(table.name))
              dbService.selectModule('table')
            }}
          >
            <span className="flex items-center gap-2 w-9/12 overflow-hidden">
              <i className="i-lucide-table-2" />
              <span className="truncate">{table.name}</span>
            </span>
            <span className="opacity-70">{table.count}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

function QueryEditor() {
  const dbService = DBService.useAtom
  const [result, setResult] = useState<any[]>([])
  const [error, setError] = useState<string>('')

  const formMethods = useForm<{ sql: string }>({})

  const { handleSubmit, register } = formMethods
  const submit = ({ sql }: { sql: string }) => {
    dbService.query
      .promise(sql)
      .then((res) => {
        if (res._tag === 'Failure') {
          if (res.cause._tag === 'Fail' && res.cause.error._tag === 'SqlError') {
            const cause = Cause.fail(res.cause.error.cause)
            return setError(Cause.pretty(cause))
          }

          setError(Cause.pretty(res.cause))
          setResult([])

          return
        }

        setResult(res.value as any)
      })
      .catch((error) => {
        console.log(error)
      })
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <form onSubmit={handleSubmit(submit)}>
        <Textarea {...register('sql')} autoFocus />
        <div className="flex justify-end py-1">
          <Button type="submit">Run</Button>
        </div>
      </form>
      <div className="flex py-1 gap-2">
        <div>
          <Button
            type="button"
            onClick={() => {
              dbService.query(
                `
                  DROP TABLE event_journal;
                  DROP TABLE event_remotes;
                `,
              )
            }}
          >
            Reset Remotes
          </Button>
        </div>
        <div>
          <Button
            type="button"
            onClick={async () => {
              const tables = await dbService.query.promise("SELECT name FROM sqlite_master WHERE type='table'")
              if (tables._tag === 'Failure') {
                return
              }

              const tableNames: string[] = tables.value.map((table) => (table as { name: string }).name)
              const ignorePrefix = ['sqlite_', 'event_', 'x_']
              const clearTables = tableNames.filter((table) => !ignorePrefix.some((prefix) => table.startsWith(prefix)))
              dbService.query(
                `
                  DELETE from sql_migrations;
                  ${clearTables.map((table) => `DROP TABLE ${table};`).join('\n')}
                `,
              )
            }}
          >
            DROP
          </Button>
        </div>
      </div>
      {error && <div className="text-red-800">{error}</div>}
      <div className="flex-grow overflow-y-scroll">
        {result.map((item) => {
          return <div key={item}>{JSON.stringify(item, null, 2)}</div>
        })}
      </div>
    </div>
  )
}

function Migrations() {
  const dbService = DBService.useAtom
  const {
    value: { table, migrations },
  } = dbService.migrations.useSuspenseSuccess()

  return (
    <div>
      <Table>
        <TableCaption>Count: {migrations.length}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Name</TableHead>
            <TableHead>Create Date</TableHead>
            <TableHead>SQL</TableHead>
            <TableHead className="text-right">STATUS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {migrations.map((migration) => (
            <TableRow key={migration.name}>
              <TableCell>{migration.name}</TableCell>
              <TableCell>{migration.createdAt}</TableCell>
              <TableCell>{migration.finishedAt}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function TableView() {
  const dbService = DBService.useAtom
  const selectedTable = dbService.selectedTable.useValue()

  if (Option.isNone(selectedTable)) {
    throw new Error('table is none')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex pb-2 justify-between items-center">
        <div>{selectedTable.value}</div>
        <Button variant={'outline' as any} onClick={() => dbService.table.refresh()}>
          <i className="i-lucide-refresh-ccw" />
        </Button>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <TableData tableName={selectedTable.value} />
      </Suspense>
    </div>
  )
}

// entries, remotes, remote_entry_id
const formatData = (table: string, column: string, data: any) => {
  if (table !== 'entries' && table !== 'remotes' && table !== 'remote_entry_id') {
    return String(data)
  }

  if (column === 'id' || column === 'entryId' || column === 'remoteId') {
    try {
      return uuidString(data)
    } catch {
      return data
    }
  }

  if (column === 'payload') {
    try {
      return MsgPack.decode(data)
    } catch {
      return data
    }
  }

  return data
}

function TableData({ tableName }: { tableName: string }) {
  const dbService = DBService.useAtom
  const { value: table } = dbService.table.useSuspenseSuccess()

  const ref = useRef<HTMLDivElement>(null)
  const size = useSize(ref)

  const getCellContent = (cell: Item): GridCell => {
    const [col, row] = cell

    const dataRow = table.rows[row]
    // dumb but simple way to do this
    const indexes: string[] = table.columnsIndexs
    const dataIndex = indexes[col]
    const data = formatData(tableName, table.columns[col].name, dataRow[dataIndex])

    const column = table.columns[col]

    if (tableName === 'entries') {
      if (column.name === 'payload') {
        // json
        return {
          kind: GridCellKind.Text,
          allowOverlay: false,
          displayData: JSON.stringify(data),
          copyData: JSON.stringify(data),
          data,
        }
      }
    }

    if (column.primaryKey) {
      return {
        kind: GridCellKind.RowID,
        allowOverlay: false,
        readonly: true,
        data: String(data ?? column.defaultValue),
      }
    }

    if (column.type === 'INTEGER') {
      return {
        kind: GridCellKind.Number,
        allowOverlay: false,
        displayData: String(data),
        data,
      }
    }

    if (column.type === 'BOOLEAN') {
      return {
        kind: GridCellKind.Boolean,
        allowOverlay: false,
        data: Boolean(data ?? column.defaultValue),
      }
    }

    if (column.type === 'DATETIME') {
      const dateString = data === 'null' ? 'null' : String(data ? new Date(data).toISOString() : column.defaultValue)
      return {
        kind: GridCellKind.Text,
        allowOverlay: false,
        displayData: dateString,
        data,
      }
    }

    return {
      kind: GridCellKind.Text,
      allowOverlay: false,
      displayData: String(data ?? column.defaultValue),
      data,
    }
  }

  const columns: GridColumn[] = table.columns.map((_) => {
    let icon = GridColumnIcon.HeaderString

    if (_.type === 'PRIMARY') {
      icon = GridColumnIcon.HeaderRowID
    } else if (_.type === 'INTEGER') {
      icon = GridColumnIcon.HeaderNumber
    } else if (_.type === 'BOOLEAN') {
      icon = GridColumnIcon.HeaderBoolean
    } else if (_.type === 'DATETIME') {
      icon = GridColumnIcon.HeaderDate
    }

    return {
      title: _.name,
      id: _.name,
      icon,
    }
  })

  return (
    <div className="flex-grow flex-1 max-w-full max-h-full overflow-hidden" ref={ref}>
      <DataEditor
        rowMarkers="number"
        width={'100%'}
        height={size?.height || '100%'}
        getCellContent={getCellContent}
        columns={columns}
        rows={table.rows.length}
      />
    </div>
  )
}
