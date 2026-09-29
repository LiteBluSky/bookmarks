import { relations } from 'drizzle-orm'
import {
  foreignKey,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/mysql-core'

// A folder can nest inside another folder. parentId = null means root level.
export const folders = mysqlTable(
  'folders',
  {
    id: int().primaryKey().autoincrement(),
    name: varchar({ length: 255 }).notNull(),
    parentId: int('parent_id'),
    position: int().notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }).onDelete(
      'cascade',
    ),
    index('folders_parent_idx').on(t.parentId),
  ],
)

// A link lives in a folder, or at root level when folderId = null.
export const links = mysqlTable(
  'links',
  {
    id: int().primaryKey().autoincrement(),
    title: varchar({ length: 255 }).notNull(),
    url: varchar({ length: 2048 }).notNull(),
    description: text(),
    folderId: int('folder_id').references(() => folders.id, {
      onDelete: 'cascade',
    }),
    position: int().notNull().default(0),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' })
      .notNull()
      .defaultNow()
      .onUpdateNow(),
  },
  (t) => [index('links_folder_idx').on(t.folderId)],
)

export const foldersRelations = relations(folders, ({ one, many }) => ({
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'folder_parent',
  }),
  children: many(folders, { relationName: 'folder_parent' }),
  links: many(links),
}))

export const linksRelations = relations(links, ({ one }) => ({
  folder: one(folders, { fields: [links.folderId], references: [folders.id] }),
}))

export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert
export type Link = typeof links.$inferSelect
export type NewLink = typeof links.$inferInsert
