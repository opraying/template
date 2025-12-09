import { describe, it } from '@effect/vitest'
import * as Database from '@xstack/db'
import * as Schema from 'effect/Schema'
import * as Prisma from '../src/prisma'

const g = (tables: Prisma.Tables) => Prisma.generate({ provider: 'sqlite' }, tables)

describe('Prisma schema generate', () => {
  it.skip('should generate prisma schema', () => {
    class Organization extends Database.Class<Organization>('Organization')(
      {
        id: Database.Generated(
          Schema.String.pipe(
            Database.IdConfig({
              generate: 'autoincrement',
              description: 'Organization unique identifier',
            }),
          ),
        ),
        name: Schema.NonEmptyTrimmedString.pipe(
          Database.ColumnConfig({
            unique: true,
            description: 'Organization display name',
          }),
        ),
        slug: Schema.NonEmptyTrimmedString.pipe(
          Database.ColumnConfig({
            unique: true,
            description: 'URL-friendly organization identifier',
          }),
        ),
        status: Schema.Literal('active', 'inactive', 'suspended').pipe(
          Database.ColumnConfig({
            description: 'Current organization status',
          }),
          Schema.propertySignature,
          Schema.withConstructorDefault(() => 'active' as const),
        ),
        settings: Schema.Record({
          key: Schema.String,
          value: Schema.Unknown,
        }).pipe(
          Database.ColumnConfig({
            description: 'Organization configuration settings',
          }),
          Database.JsonFromString,
        ),
        createdAt: Database.DateTimeInsert,
        updatedAt: Database.DateTimeUpdate,
      },
      {
        ...Database.ModelConfig({
          namespace: 'User',
          author: 'John Doe',
          description: 'An organization',
          documentation: `
            An organization.
            Organizations can have multiple users.
          `,
          relations: [
            {
              name: 'users',
              type: 'one-to-many',
              fields: ['id'],
              references: ['organizationId'],
              referencedModel: 'User',
            },
          ],
        }),
      },
    ) {}

    // Represents a user account
    class User extends Database.Class<User>('User')(
      {
        id: Database.Generated(
          Schema.String.pipe(
            Database.IdConfig({
              generate: 'autoincrement',
              description: 'User unique identifier',
            }),
          ),
        ),
        email: Schema.String.pipe(
          Database.ColumnConfig({
            unique: true,
            description: "User's email address",
            index: 'name_email',
          }),
        ),
        name: Schema.String.pipe(
          Database.ColumnConfig({
            description: "User's full name",
            index: 'name_email',
          }),
        ),
        status: Schema.Literal('active', 'inactive').pipe(
          Database.ColumnConfig({
            description: 'User status',
            unique: 'status_role_unique', // Participates in composite unique constraint
          }),
        ),
        role: Schema.Literal('admin', 'user', 'guest').pipe(
          Database.ColumnConfig({
            description: 'User role',
            unique: 'status_role_unique', // Same unique constraint name creates a composite unique index
          }),
          Schema.propertySignature,
          Schema.withConstructorDefault(() => 'user' as const),
        ),
        organizationId: Schema.String.pipe(
          Schema.annotations({
            description: "Reference to user's organization",
          }),
        ),
        metadata: Schema.Record({
          key: Schema.String,
          value: Schema.Unknown,
        }).pipe(
          Database.ColumnConfig({
            description: 'Additional user metadata',
          }),
          Database.JsonFromString,
        ),
        lastLoginAt: Schema.Date.pipe(
          Database.ColumnConfig({
            description: 'Timestamp of last successful login',
          }),
          Schema.optional,
        ),
        createdAt: Database.DateTimeInsert,
        updatedAt: Database.DateTimeUpdate,
      },
      {
        ...Database.ModelConfig({
          namespace: 'User',
          author: 'John Doe',
          description: 'A user account',
          // markdown
          documentation: `
            A user account. for ***testing***
            Users can be associated with an organization.
            The first purpose of this is to track the customer's inflow path in detail,
            and it is for cases where the same person enters as a non-member, reads a
            {@link drive_repository_files repository file} in advance, and registers/logs
            in at the moment for modification. It is the second. Lastly, it is to
            accurately track the activities that a person performs at the drive system
            in various ways like below.
            - [x] item 1
            - [ ] item 2
            - [ ] item 3
          `,
          relations: [
            {
              name: 'organization',
              description: "Reference to user's organization",
              type: 'many-to-one',
              fields: ['organizationId'],
              references: ['id'],
              referencedModel: 'Organization',
            },
            {
              name: 'posts',
              description: 'Posts written by the user',
              type: 'one-to-many',
              fields: ['id'],
              references: ['authorId'],
              referencedModel: 'Post',
              onDelete: 'Cascade',
            },
            {
              name: 'profile',
              description: "User's profile information",
              type: 'one-to-one',
              referencedModel: 'Profile',
              fields: ['id'],
              references: ['userId'],
              onDelete: 'Cascade',
            },
            {
              name: 'blogs',
              description: "User's blogs",
              type: 'one-to-many',
              fields: ['id'],
              references: ['authorId'],
              referencedModel: 'Blog',
            },
          ],
        }),
      },
    ) {}

    class Profile extends Database.Class<Profile>('Profile')(
      {
        id: Database.Generated(Schema.String.pipe(Database.IdConfig({ generate: 'autoincrement' }))),
        userId: Schema.String.pipe(
          Database.ColumnConfig({
            description: 'Reference to user',
            unique: true,
          }),
        ),
      },
      {
        ...Database.ModelConfig({
          namespace: 'User',
          author: 'John Doe',
          relations: [
            {
              name: 'user',
              description: 'Reference to user',
              type: 'one-to-one',
              referencedModel: 'User',
              // fields: ["userId"],
              // references: ["id"],
              // onDelete: "Cascade",
            },
          ],
        }),
      },
    ) {}

    class Post extends Database.Class<Post>('Post')(
      {
        id: Database.Generated(Schema.String.pipe(Database.IdConfig({ generate: 'autoincrement' }))),
        title: Schema.String.pipe(Schema.annotations({ description: 'Post title' })),
        content: Schema.String.pipe(Schema.annotations({ description: 'Post content' })),
        authorId: Schema.String.pipe(Schema.annotations({ description: 'Reference to post author' })),
      },
      {
        ...Database.ModelConfig({
          namespace: 'User',
          author: 'John Doe',
          relations: [
            {
              name: 'user',
              description: 'Reference to post author',
              type: 'many-to-one',
              fields: ['authorId'],
              references: ['id'],
              referencedModel: 'User',
              onDelete: 'Cascade',
            },
          ],
        }),
      },
    ) {}

    class Category extends Database.Class<Category>('Category')(
      {
        id: Database.Generated(
          Schema.String.pipe(
            Database.IdConfig({
              generate: 'autoincrement',
              description: 'Category unique identifier',
            }),
          ),
        ),
        name: Schema.NonEmptyTrimmedString.pipe(
          Database.ColumnConfig({
            description: 'Category display name',
          }),
        ),
        slug: Schema.NonEmptyTrimmedString.pipe(
          Database.ColumnConfig({
            unique: true,
            description: 'URL-friendly category identifier',
          }),
        ),
        description: Schema.String.pipe(
          Database.ColumnConfig({
            description: 'Category description',
          }),
          Schema.optional,
        ),
        parentId: Schema.String.pipe(
          Database.ColumnConfig({
            description: 'Reference to parent category',
            unique: true,
            nullable: true,
          }),
          Schema.optional,
        ),
        organizationId: Schema.String.pipe(
          Schema.annotations({
            description: 'Reference to owning organization',
          }),
        ),
        sortOrder: Schema.Number.pipe(
          Database.ColumnConfig({
            description: 'Order for display purposes',
            index: true,
          }),
          Schema.propertySignature,
          Schema.withConstructorDefault(() => 0),
        ),
        createdAt: Database.DateTimeInsert,
        updatedAt: Database.DateTimeUpdate,
      },
      {
        ...Database.ModelConfig({
          namespace: 'Product',
          author: 'John Doe',
          description: 'A category for organizing products',
          documentation: `
      A category for organizing products.
      Categories can be nested to create a tree structure.
      Each category can have a parent category, forming a hierarchy.
      Categories help organize products and improve searchability.`,
          relations: [
            // category -> categorys
            {
              name: 'childrens',
              description: 'Subcategories of this category',
              relationName: 'children',
              type: 'one-to-many',
              referencedModel: 'Category',
            },
            {
              name: 'parent',
              description: 'Parent category',
              relationName: 'children',
              type: 'one-to-one',
              fields: ['id'],
              references: ['parentId'],
              referencedModel: 'Category',
            },

            // category -> category
            // {
            //   name: "parent",
            //   type: "one-to-one",
            //   fields: ["id"],
            //   references: ["parentId"],
            //   referencedModel: "Category",
            // },
            // category -> products
            {
              name: 'products',
              description: 'Products in this category',
              type: 'one-to-many',
              referencedModel: 'Product',
            },
          ],
        }),
      },
    ) {}

    // Represents a product
    class Product extends Database.Class<Product>('Product')(
      {
        id: Database.Generated(
          Schema.String.pipe(
            Database.IdConfig({
              generate: 'autoincrement',
              description: 'Product unique identifier',
            }),
          ),
        ),
        name: Schema.NonEmptyTrimmedString.pipe(
          Database.ColumnConfig({
            description: 'Product display name',
          }),
        ),
        slug: Schema.NonEmptyTrimmedString.pipe(
          Database.ColumnConfig({
            unique: true,
            description: 'URL-friendly product identifier',
          }),
        ),
        description: Schema.String.pipe(
          Database.ColumnConfig({
            description: 'Product description',
          }),
          Schema.optional,
        ),
        price: Schema.Number.pipe(
          Database.ColumnConfig({
            description: 'Product price in cents',
          }),
        ),
        status: Schema.Literal('draft', 'published', 'archived').pipe(
          Database.ColumnConfig({
            description: 'Product status',
            index: true,
          }),
          Schema.propertySignature,
          Schema.withConstructorDefault(() => 'draft' as const),
        ),
        categoryId: Schema.String.pipe(
          Schema.annotations({
            description: 'Reference to product category',
          }),
        ),
        organizationId: Schema.String.pipe(
          Schema.annotations({
            description: 'Reference to owning organization',
          }),
        ),
        metadata: Schema.Record({
          key: Schema.String,
          value: Schema.Unknown,
        }).pipe(
          Database.ColumnConfig({
            description: 'Additional product metadata',
          }),
          Database.JsonFromString,
        ),
        tags: Database.StringFromCommaSeparated.pipe(
          Database.ColumnConfig({
            description: 'Product tags',
          }),
        ),
        isPublished: Schema.Boolean.pipe(
          Database.ColumnConfig({
            description: 'Whether the product is published',
            index: 'published_idx',
            default: false,
          }),
        ),
        searchTerms: Schema.String.pipe(
          Database.ColumnConfig({
            description: 'Additional search terms for the product',
            index: true,
          }),
          Schema.optional,
        ),
        createdAt: Database.DateTimeInsert,
        updatedAt: Database.DateTimeUpdate,
      },
      {
        ...Database.ModelConfig({
          namespace: 'Product',
          author: 'John Doe',
          description: 'A product',
          documentation: `
            A product.
            Products can be associated with a category and organization.
          `,
          relations: [
            {
              name: 'category',
              description: 'Reference to product category',
              type: 'one-to-one',
              fields: ['categoryId'],
              references: ['id'],
              referencedModel: 'Category',
            },
          ],
        }),
      },
    ) {}

    // Test the schema generation
    const _result = g({
      Organization,
      User,
      Profile,
      Post,
      Category,
      Product,
    })

    // console.log(result)
  })

  it('field option', () => {
    class Test extends Database.Class<Test>('Test')({
      id: Database.Generated(Schema.String.pipe(Database.IdConfig({ generate: 'autoincrement' }))),
      title: Schema.String.pipe(
        Database.ColumnConfig({
          nullable: true,
        }),
        Database.FieldOption,
      ),
    }) {}

    const result = g({
      Test,
    })

    console.log(result)
  })
})
