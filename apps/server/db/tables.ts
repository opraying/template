import * as VariantSchema from '@effect/experimental/VariantSchema'
import * as Database from '@xstack/db'
import * as UserKitTable from '@xstack/user-kit/tables'

const TABLES = {
  account: UserKitTable.Account.table,
  user: UserKitTable.User.table,
} as const

export class User extends Database.Class<User>(UserKitTable.User.identifier)({
  ...UserKitTable.User[VariantSchema.TypeId],
}) {
  static table = TABLES.user

  static repo = Database.repo(this)
}

export declare namespace User {}

export class Account extends Database.Class<Account>(UserKitTable.Account.identifier)({
  ...UserKitTable.Account[VariantSchema.TypeId],
}) {
  static table = TABLES.account

  static repo = Database.repo(this)
}

export declare namespace Account {}

export class SessionTable extends Database.Class<SessionTable>(UserKitTable.Session.identifier)({
  ...UserKitTable.Session[VariantSchema.TypeId],
}) {
  static table = UserKitTable.Session.table
}

class EmailVerificationCode extends Database.Class<EmailVerificationCode>(
  UserKitTable.EmailVerificationCode.identifier,
)({
  ...UserKitTable.EmailVerificationCode[VariantSchema.TypeId],
}) {
  static table = UserKitTable.EmailVerificationCode.table
}

const tables_ = [User, Account, SessionTable, EmailVerificationCode] satisfies Database.Tables

export type Tables = Database.TablesRecord<typeof tables_>

export type TablesType = Database.TablesType<Tables>

export type TablesEncoded = Database.TablesEncoded<Tables>

export const tables = Database.tables(tables_)

export const config = {
  provider: 'sqlite',
  runtime: 'd1',
}
