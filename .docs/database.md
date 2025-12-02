# Model-Repository-Service 分层架构指南

本文档提供了关于我们项目中数据库操作层的详细指南。这一层建立在 Effect 和 `effect/schema` 系统之上，使我们能够构建可靠、可维护和可测试的数据访问代码, 提供了类型安全、声明式的数据库交互方式。

遵循本指南中的模式和最佳实践，能够确保数据库操作的一致性和类型安全性，同时充分利用TypeScript的类型系统提供的优势，利用这些工具将显著提高开发效率并减少运行时错误。

- [目录结构](#目录结构建议)
- [Model 层](#model)
- [Repository 层](#repository)
- [Service 层](#service)
- [事务管理](#事务管理)
- [依赖注入（DI）](#依赖注入di)
- [测试策略](#测试策略)
- [总结](#总结)

```bash
┌─────────────┐
│   Service   │   业务逻辑编排、事务管理
├─────────────┤
│  Repository │   数据访问、SQL 生成
├─────────────┤
│   Model     │   数据结构、验证规则
└─────────────┘
```

## 目录结构建议

```bash
src/
├── model/
│   └── billing/
│       ├── receipt.ts
│       └── invoice.ts
├── service/
│   └── billing/
│       ├── receipt.repo.ts
│       └── invoice.repo.ts
│       ├── invoice.service.ts
│       └── payment.service.ts
├── db/
│   ├── database.ts    # Kysely 实例
│   └── schema.ts      # 共享 Schema 工具
├── error.ts            # 错误类型定义
└── index.ts
```

## Model

职责

- **定义数据结构** - 使用 Schema 定义数据结构
- **类型转换** - 在应用类型和数据库类型间进行安全转换
- **派生逻辑**：纯函数计算（如日期格式化）

整体数据流如下：`应用程序 <--> Schema编解码 <--> 数据库操作 <--> 数据库`

禁止行为

- 包含业务逻辑
- 直接访问数据库
- 动态修改 Schema

文件结构

```bash
src/model/<domain>/<entity>.ts
model/receipt.ts
```

代码示例

每个 Model 在内部有三个部分结构

- 查询模型：定义表的查询结果返回的字段
- 插入模型：定义创建新记录时需要的字段
- 更新模型：定义更新记录时可能修改的字段

```typescript
import { Schema } from '@effect/schema'

export class Receipt extends Model.Class<Receipt>('Receipt')({
  id: GroupId.schema,
  name: Schema.string,
  amount: Schema.Decimal,
  createdAt: Schema.Date,
  defaultCurrency: Schema.string,
}) {
  get amountWithTax() {
    return this.amount * 1.1 // 派生属性
  }

  static parseJson = Schema.decodeUnknown(Receipt)
}
export type ReceiptType = Schema.Schema.Type<typeof Receipt>
```

## Repository

职责

- 封装数据库操作
- 类型安全 SQL 生成（使用 Kysely）
- 数据编解码

禁止行为

- 包含业务逻辑
- 返回原始数据库对象
- 跨 Repository 直接调用

文件结构

```bash
src/repository/<domain>/<entity>.repo.ts
billing/receipt.repo.ts
```

可以选择中 Model 中派生出对于模型的 Select, Insert, Update 相关方法再次封装

`makeRepository` 函数接收模型定义，返回一个包含 `select`、`insert` 和 `update` 操作的存储库对象。

```typescript
import { Kysely } from 'kysely'

const repo = yield * makeRepository(Group)

export class ReceiptRepository {
  findById(id: string) {
    const repo = yield * makeRepository(Receipt)
    return repo.select(db.selectFrom('receipts').selectAll())
  }
}

// 错误类型
type RepositoryError = { _tag: 'DbError'; error: unknown } | { _tag: 'DecodeError'; error: Schema.ParseError }
```

## Service

职责

- 组合业务操作
- 事务管理
- 错误转换

文件结构

```bash
src/<domain>/<feature>.service.ts
src/billing/invoice.service.ts
```

```typescript
export class InvoiceService {
  constructor(
    private receiptRepo: ReceiptRepository,
    private invoiceRepo: InvoiceRepository,
  ) {}

  createInvoice(userId: string) {
    return pipe(
      this.receiptRepo.findByUser(userId),
      Effect.flatMap(this.validateReceipts),
      Effect.flatMap(this.invoiceRepo.generate),
      Effect.catchAll((error) => Effect.fail({ _tag: 'InvoiceCreationFailed', reason: error.message })),
    )
  }
}

// 错误类型
type BillingError = { _tag: 'InvoiceCreationFailed'; reason: string } | { _tag: 'NoReceiptsError' }
```

## 事务管理

禁止行为

- 直接执行 SQL
- 处理存储细节
- 循环依赖

```typescript
processRefund(invoiceId: string) {
  return pipe(
    this.invoiceRepo.startTransaction(),
    Effect.flatMap(trx =>
      pipe(
        this.invoiceRepo.lockInvoice(invoiceId, trx),
        Effect.flatMap(() => trx.commit()),
        Effect.catchAll(error => trx.rollback().pipe(Effect.fail(error)))
      )
  );
}
```

## 依赖注入（DI）

```typescript
import { Layer, Context } from 'effect'

export const ReceiptRepository = Context.Tag<ReceiptRepository>()
export const InvoiceService = Context.Tag<InvoiceService>()

const RepositoryLive = Layer.effect(
  ReceiptRepository,
  Effect.map(Database, (db) => new ReceiptRepository(db)),
)

const AppLive = Layer.merge(RepositoryLive, ServiceLive)
```

## 测试策略

- 对于数据库的访问都通过内存数据库
- 使用 `effect/schema` 对 sql 查询结果进行编解码验证

## 总结

严格分层，Model 仅纯数据定义，无副作用 在 Model 中调用数据库 API，Repository 仅数据访问，原子操作， Service 仅组合业务逻辑，管理事务。

类型安全，所有 SQL 通过 `kysely` 生成，输入/输出通过 `effect/schema` 校验。

错误处理，分层定义错误类型，Service 层转换业务错误。

事务管理，事务控制在 Repository/Service 层，避免跨 Service 事务。

可测试性，通过 DI 实现 Mock，隔离测试各层逻辑。

### 1. 明确定义模型

确保每个表都有明确定义的模型，包括主模型、插入模型和更新模型。

```typescript
class User extends Model.Class<User>('User', {
  id: UserId,
  name: Schema.String,
  createdAt: Schema.Date,
  defaultCurrency: Schema.String,
}) {}
```

### 2. 使用字段选择而非类型断言

优先使用字段选择而非类型断言来细化类型：

```typescript
// 推荐
repo.select.decode(User.select.pick('id', 'name'), query)

// 不推荐
repo.select.decode(userPartialSchema as any, query)
```

### 3. 处理NULL值

明确处理可能为NULL的字段：

```typescript
// 在Schema定义中使用optional
Schema.struct({
  required: Schema.String,
  optional: Schema.String.pipe(Schema.optional),
})
```

### 4. 错误处理

优雅地处理可能的错误：

```typescript
import * as Exit from "effect/Exit";

const result = yield* repo.select(...).pipe(
  Effect.catchTag("ParseError", (error) => {
    console.error("Failed to parse data:", error);
    return Effect.fail("DataParsingFailed");
  }),
  Effect.catchTag("SqlError", (error) => {
    console.error("Database error:", error);
    return Effect.fail("DatabaseOperationFailed");
  })
);
```

## 数据库操作层使用指南

### SELECT 操作

读取数据的基本操作：

```typescript
// 基本查询 - 获取所有组
const allGroups = repo.select(db.selectFrom('group').selectAll())

// 获取单个结果
const singleGroup = allGroups.single

// 选择特定字段
const namesOnly = repo.select.decode(
  Group.select.pick('name', 'defaultCurrency'),
  db.selectFrom('group').select(['name', 'defaultCurrency']),
)

// 带条件的查询
const filteredGroup = repo.select.encode(
  Group.select.pick('id'),
  (input) => db.selectFrom('group').where('id', '=', input.id).selectAll(),
  { id: specificId },
)
```

### INSERT 操作

插入数据的基本操作：

```typescript
// 创建插入数据
const newGroup = Group.insert.make({
  name: 'Marketing',
  defaultCurrency: 'EUR',
})

// 基本插入
const inserted = repo.insert((input) => db.insertInto('group').values(input).returningAll(), newGroup)

// 不关心返回值的插入
const insertedVoid = inserted.void

// 获取详细结果（包括影响行数）
const insertResult = inserted.result

// 自定义返回字段
const insertWithCustomReturn = repo.insert.decode(
  Group.select.pick('id'),
  (input) => db.insertInto('group').values(input).returning('id'),
  newGroup,
)
```

### UPDATE 操作

更新数据的基本操作：

```typescript
// 创建更新数据
const updateData = Group.update.make({
  id: specificId,
  name: 'New Marketing Name',
})

// 基本更新
const updated = repo.update(
  (input) => db.updateTable('group').set(input).where('id', '=', input.id).returningAll(),
  updateData,
)

// 不关心返回值的更新
const updatedVoid = updated.void

// 获取详细结果
const updateResult = updated.result

// 部分字段更新
const partialUpdate = repo.update.encode(
  Group.update.pick('id', 'name'),
  (input) => db.updateTable('group').set({ name: input.name }).where('id', '=', input.id).returningAll(),
  updateData,
)
```

## 高级操作

### 字段选择

使用 `pick` 来选择特定字段：

```typescript
// 只包含 id 和 name 字段
const schema = Group.select.pick('id', 'name')
```

### 组合编解码

当需要在同一操作中进行编码和解码时：

```typescript
const result = repo.select.codec(
  Group.select.pick('id'), // 用于编码输入
  Group.select.pick('name'), // 用于解码输出
  (input) => db.selectFrom('group').where('id', '=', input.id).select('name'),
)
```

## 数据流

### SELECT 操作流程

`数据库 → Schema解码 → 应用程序对象`

1. 从数据库获取数据
2. 通过Schema解码转换为应用程序类型
3. 返回给调用者

### INSERT 操作流程

`应用程序对象 → Schema编码 → 数据库 → Schema解码 → 应用程序对象`

1. 接收应用程序对象
2. 编码为数据库可接受的格式，确保数据为数组格式（支持单条或多条数据）
3. 发送到数据库执行插入
4. 解码返回的数据
5. 返回给调用者

### UPDATE 操作流程

`应用程序对象 → Schema编码 → 数据库 → Schema解码 → 应用程序对象`

1. 接收应用程序对象
2. 编码为数据库可接受的格式
3. 发送到数据库执行更新
4. 解码返回的数据
5. 返回给调用者

### 核心类型

- **SelectableEffect** - 表示查询操作的结果，包含 `single` 方法获取第一条记录
- **InsertableEffect** - 表示插入操作的结果，包含 `void` 和 `result` 方法
- **UpdateableEffect** - 表示更新操作的结果，包含 `void` 和 `result` 方法

### 错误处理

操作可能产生三类错误：

- **数据库错误(SqlError)** - 数据库操作失败
- **解析错误(ParseError)** - 数据编解码失败
- **自定义错误(E)** - 用户自定义的错误类型

所有操作都会正确传播这些错误，使用 Effect 的错误处理机制。

## 常见问题解答

### Q: 如何处理复杂的联表查询？

A: 您可以在SQL查询中使用联表操作，然后使用适当的Schema来解码结果：

```typescript
const joinQuery = db
  .selectFrom('user')
  .innerJoin('profile', 'user.id', 'profile.userId')
  .select(['user.id', 'user.name', 'profile.bio'])

const joinResults = repo.select.decode(
  JoinedSchema, // 定义联表结果的Schema
  joinQuery,
)
```

### Q: 如何执行批量操作？

A: `insert` 操作原生支持批量插入：

```typescript
// 批量插入
const batchInsert = repo.insert(
  (input) => db.insertInto('table').values(input).returningAll(),
  [item1, item2, item3], // 传入数组
)
```

---

## 完整示例

以下是一个完整的工作示例，展示了如何定义模型、创建存储库并执行各种操作：

```typescript
import * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'
import * as Model from '@effect/sql/Model'
import * as SqlClient from '@effect/sql/SqlClient'
import { makeRepository } from './db'

// 定义ID类型
const UserId = Schema.UUID.pipe(Schema.brand('UserId'))
type UserId = Schema.Schema.Type<typeof UserId>

// 定义主模型
const User = Model.make(
  Schema.struct({
    id: UserId,
    name: Schema.string,
    email: Schema.string,
    createdAt: Schema.Date,
  }),
)

// 应用程序入口
const program = Effect.gen(function* (_) {
  // 创建存储库
  const userRepo = yield* makeRepository(User)
  const db = yield* SqlClient.SqlClient

  // 查询所有用户
  const allUsers = yield* userRepo.select(db.selectFrom('user').selectAll())

  // 创建新用户
  const newUser = User.insert.make({
    name: 'John Doe',
    email: 'john@example.com',
  })

  const inserted = yield* userRepo.insert((input) => db.insertInto('user').values(input).returningAll(), newUser)

  // 更新用户
  const updateData = User.update.make({
    id: inserted.id,
    name: 'John Updated',
  })

  const updated = yield* userRepo.update(
    (input) => db.updateTable('user').set(input).where('id', '=', input.id).returningAll(),
    updateData,
  )

  return {
    allUsers,
    inserted,
    updated,
  }
})

// 运行程序
Effect.runPromise(program).then(console.log).catch(console.error)
```

## 数据库迭代的流程

- Database: SQLite, MySQL, PostgreSQL
- Runtime: D1, Node, Browser SQLite WASM

### DB Seed

执行时机：

- 手动执行
- 执行 migrate reset 命令之后
- prisma migrate dev 后

执行 seed/seed.ts 文件中导出的 start 函数

```bash
nx db:seed
```

### DB Push

Db push命令在不使用迁移的情况下将Prisma模式的状态推送到数据库。如果数据库不存在，它会创建数据库。

### DB Dump

将 schema 导出到文件 db/schema.sql

```bash
nx db:dump
```

### DB Execute

> <https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-dev>

执行 SQL 字符串或者文件

```bash
nx db:execute --file ./script.sql
```

#### 实现方式

如果是 D1 使用 Wrangler

```bash
wrangler d1 execute ${name} --command=${sql} --persist-to=${path} --preview/--local/--remote
```

```bash
const migrate = new Migrate(schemaPath)
migrate.engine.dbExecute({
  script: ${sql},
  datasourceType,
})
```

### Migrate Dev

```bash
nx db:dev --name add-test-field
```

实现方式: 如果不存在历史迁移则从空数据库开始，否则找到最新的迁移纪录作为起点

```bash
prisma migrate diff --from-empty --to-schema-datamodel ${schema} --script --output migrations/${name}.sql
```

```bash
#从已有迁移开始
prisma migrate diff --from-url ${url} --to-schema-datamodel ${schema} --script --output migrations/${name}.sql
```

迁移纪录创建完成后执行迁移, 如果是 D1 使用 Wrangler 进行迁移，如果是其他的类型则用 Prisma Migrate 进行迁移

```bash
wrangler d1 migrations apply ${name} --persist-to=${path} --preview/--local/--remote
```

```bash
# Prisma Migrate
migrate.applyMigrations()
```

### Reset

- 如果可能，则删除数据库/模式¹；如果环境不允许删除数据库/模式¹，则执行软重置
- 如果数据库/模式¹被删除，则创建一个具有相同名称的新数据库/模式¹
- 应用所有迁移
- 运行种子脚本

如果是 D1 找到DB文件所在，删除以后重新创建并初始化 CF 相关的表。

```bash
# empty local .db file
# .wrangler/state/d1/${name}
rm -rf .wrangler/state/v3/d1/${name}
touch .wrangler/state/v3/d1/${name}

wrangler d1 execute ${name} --command=${sql}
wrangler d1 migrations apply ${name} --persist-to=${path} --local
```

### Deploy

使用现有的 Migration 进行部署

```bash
nx db:deploy
```

### Resolve

待定

### Note

- 如果增加列，修改列的属性（默认值，类型），会先删除原来的表，再创建新的表
