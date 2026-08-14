-- Written by hand, drizzle-kit does not generate this from the schema.
-- Neon ships pgvector, the unit tests load it into pglite.
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "chunk" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "chunk_embedding_idx" ON "chunk" USING hnsw ("embedding" vector_cosine_ops) WHERE "chunk"."embedding" is not null;
