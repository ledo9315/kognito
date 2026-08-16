import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core'

/* -------------------------------------------------------------------------- */
/* Auth. Table and column names are dictated by Better Auth's drizzle adapter. */
/* -------------------------------------------------------------------------- */

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('session_user_idx').on(table.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index('account_user_idx').on(table.userId)],
)

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

/* -------------------------------------------------------------------------- */
/* Application                                                                 */
/* -------------------------------------------------------------------------- */

export const notebook = pgTable(
  'notebook',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    emoji: text('emoji').notNull().default('📓'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  },
  (table) => [index('notebook_owner_idx').on(table.ownerId, table.updatedAt)],
)

/**
 * How a source entered the notebook. Drives the icon and the extractor.
 *
 * `note` is the one kind written inside the app instead of extracted from
 * something. It is a source so that a note can be selected, searched, cited
 * and read like any other, without a second path through the retrieval.
 */
export const sourceKinds = ['pdf', 'doc', 'text', 'web', 'youtube', 'note'] as const
export type SourceKind = (typeof sourceKinds)[number]

/** Extraction runs after upload, so a source is not readable right away. */
export const sourceStatuses = ['processing', 'ready', 'failed'] as const
export type SourceStatus = (typeof sourceStatuses)[number]

export const source = pgTable(
  'source',
  {
    id: text('id').primaryKey(),
    notebookId: text('notebook_id')
      .notNull()
      .references(() => notebook.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: text('kind').$type<SourceKind>().notNull(),
    status: text('status').$type<SourceStatus>().notNull().default('processing'),
    /** Set when status is `failed`, shown to the user. */
    error: text('error'),
    /** Origin for web and youtube sources. */
    url: text('url'),
    content: text('content'),
    summary: text('summary'),
    selected: boolean('selected').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('source_notebook_idx').on(table.notebookId)],
)

/**
 * How many numbers describe the meaning of one passage. Fixed by the model
 * in lib/embeddings.ts, and baked into the column: changing the model means
 * a migration and new embeddings for everything.
 */
export const embeddingSize = 1536

export const chunk = pgTable(
  'chunk',
  {
    id: text('id').primaryKey(),
    sourceId: text('source_id')
      .notNull()
      .references(() => source.id, { onDelete: 'cascade' }),
    /** Position within the source, starting at 0. */
    index: integer('index').notNull(),
    text: text('text').notNull(),
    /** Character offsets into source.content, so a citation can scroll to the
     *  exact passage instead of merely naming the document. */
    charStart: integer('char_start').notNull(),
    charEnd: integer('char_end').notNull(),
    /**
     * Null for everything stored before this column existed, and whenever
     * the embedding model was unreachable. Those sources fall back to going
     * into the prompt whole.
     */
    embedding: vector('embedding', { dimensions: embeddingSize }),
  },
  (table) => [
    uniqueIndex('chunk_source_index_idx').on(table.sourceId, table.index),
    index('chunk_embedding_idx')
      .using('hnsw', table.embedding.op('vector_cosine_ops'))
      .where(sql`${table.embedding} is not null`),
  ],
)

export const messageRoles = ['user', 'assistant'] as const
export type MessageRole = (typeof messageRoles)[number]

export type Citation = {
  index: number
  chunkId: string
  sourceId: string
  quote: string
  charStart: number
  charEnd: number
}

export const message = pgTable(
  'message',
  {
    id: text('id').primaryKey(),
    notebookId: text('notebook_id')
      .notNull()
      .references(() => notebook.id, { onDelete: 'cascade' }),
    role: text('role').$type<MessageRole>().notNull(),
    content: text('content').notNull(),
    /** Empty for user messages. */
    citations: jsonb('citations').$type<Citation[]>().notNull().default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('message_notebook_idx').on(table.notebookId, table.createdAt)],
)

export const artifactKinds = ['briefing', 'faq', 'timeline', 'flashcards'] as const
export type ArtifactKind = (typeof artifactKinds)[number]

export const artifact = pgTable(
  'artifact',
  {
    id: text('id').primaryKey(),
    notebookId: text('notebook_id')
      .notNull()
      .references(() => notebook.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<ArtifactKind>().notNull(),
    title: text('title').notNull(),
    /** Shape depends on kind, validated by the zod schema of its generator. */
    content: jsonb('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('artifact_notebook_idx').on(table.notebookId)],
)
