import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const targetDbUrl = process.env.TARGET_DIRECT_URL;

if (!targetDbUrl) {
    console.error('Error: TARGET_DIRECT_URL is not defined in .env');
    process.exit(1);
}

const client = new Client({
    connectionString: targetDbUrl,
});

async function setupTargetDatabase() {
    try {
        console.log('Connecting to target database...');
        await client.connect();
        console.log('Connected successfully.');

        // 1. Enable vector extension
        console.log('Enabling vector extension...');
        await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

        // 2. Create primary_store_chunks table
        console.log('Creating primary_store_chunks table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS primary_store_chunks (
        chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chunk_text TEXT,
        chunk_index INTEGER,
        embedding VECTOR(1536),
        token_count INTEGER,
        section_path TEXT,
        document_id TEXT,
        content_hash TEXT,
        source_type TEXT,
        http_status INTEGER,
        retrieved_at TIMESTAMPTZ,
        version INTEGER DEFAULT 1,
        source_id TEXT,
        canonical_url TEXT,
        final_url TEXT,
        title TEXT,
        tier TEXT,
        reliability_score DOUBLE PRECISION,
        language TEXT,
        status TEXT,
        course TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

        // 3. Create chunk_elements table
        console.log('Creating chunk_elements table...');
        await client.query(`
      CREATE TABLE IF NOT EXISTS chunk_elements (
        chunk_id UUID REFERENCES primary_store_chunks(chunk_id) ON DELETE CASCADE,
        element_id TEXT NOT NULL,
        course TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        discovered_via TEXT,
        relevance_score DOUBLE PRECISION,
        PRIMARY KEY (chunk_id, element_id, course)
      );
    `);

        // 4. Create Index
        console.log('Creating index on embedding...');
        await client.query(`
      CREATE INDEX IF NOT EXISTS idx_primary_store_chunks_embedding 
      ON primary_store_chunks USING hnsw (embedding vector_cosine_ops);
    `);

        console.log('Target database setup complete.');

    } catch (error) {
        console.error('Error setting up target database:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

setupTargetDatabase();
