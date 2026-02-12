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

async function setupCscTable() {
    try {
        console.log('Connecting to target database...');
        await client.connect();

        console.log('Creating csc_chunks table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS csc_chunks (
                chunk_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                course TEXT DEFAULT 'csc',
                source_file TEXT,
                chunk_text TEXT,
                embedding VECTOR(1536),
                token_count INTEGER,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        `);

        // Index
        console.log('Creating index on embedding...');
        // Note: Creating index might take time if data exists, but here table is empty/new.
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_csc_chunks_embedding 
            ON csc_chunks USING hnsw (embedding vector_cosine_ops);
        `);

        console.log('Target table csc_chunks setup complete.');

    } catch (error) {
        console.error('Error setting up csc_chunks:', error);
    } finally {
        await client.end();
    }
}

setupCscTable();
