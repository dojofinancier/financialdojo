import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BATCH_SIZE = 50; // Conservative batch size for vectors
const DELAY_MS = 100; // Small delay to be nice to the DB

const sourceClient = new Client({ connectionString: process.env.DIRECT_URL });
const targetClient = new Client({ connectionString: process.env.TARGET_DIRECT_URL });

async function migrateCscChunks() {
    console.log('--- STARTING MIGRATION: csc_chunks ---');
    try {
        console.log('DEBUG: Connecting to databases...');
        await sourceClient.connect();
        await targetClient.connect();
        console.log('DEBUG: Connected successfully.');

        // Drop index for speed
        console.log('DEBUG: Dropping index idx_csc_chunks_embedding...');
        await targetClient.query('DROP INDEX IF EXISTS idx_csc_chunks_embedding;');
        console.log('DEBUG: Index dropped.');

        // Get total count
        const countRes = await sourceClient.query('SELECT count(*) FROM csc_chunks');
        const totalChunks = Number(countRes.rows[0].count);
        console.log(`DEBUG: Total csc_chunks to migrate: ${totalChunks}`);

        let processed = 0;

        while (processed < totalChunks) {
            // Fetch batch
            const fetchQuery = `
                SELECT 
                    chunk_id, course, source_file, chunk_text, 
                    embedding::text as embedding_str, 
                    token_count, metadata, created_at
                FROM csc_chunks
                ORDER BY chunk_id ASC
                LIMIT $1 OFFSET $2
            `;

            const result = await sourceClient.query(fetchQuery, [BATCH_SIZE, processed]);
            const batch = result.rows;

            if (batch.length === 0) break;

            // Prepare inserts
            // Using inline values for vectors to avoid protocol limits
            let valueStrings: string[] = [];
            let flatValues: any[] = [];
            let paramIndex = 1;

            for (const row of batch) {
                const vectorStr = row.embedding_str;
                // formatted as "[0.123, ...]" string from PG

                // We will parameterize everything EXCEPT the vector string
                // params: chunk_id, course, source_file, chunk_text, token_count, metadata, created_at

                valueStrings.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, '${vectorStr}'::vector, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6})`);

                flatValues.push(
                    row.chunk_id,
                    row.course,
                    row.source_file,
                    row.chunk_text,
                    // vector is inlined
                    row.token_count,
                    row.metadata,
                    row.created_at
                );

                paramIndex += 7;
            }

            const insertQuery = `
                INSERT INTO csc_chunks (
                    chunk_id, course, source_file, chunk_text, embedding, token_count, metadata, created_at
                )
                VALUES ${valueStrings.join(',')}
                ON CONFLICT (chunk_id) DO NOTHING;
            `;

            await targetClient.query(insertQuery, flatValues);

            processed += batch.length;
            const progress = ((processed / totalChunks) * 100).toFixed(1);
            if (processed % 500 === 0 || processed >= totalChunks) {
                console.log(`Processed ${processed} / ${totalChunks} chunks (${progress}%).`);
            }

            // Optional delay
            // await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }

        console.log('✅ csc_chunks data migration complete.');

        // Recreate index
        console.log('DEBUG: Recreating index idx_csc_chunks_embedding...');
        await targetClient.query(`
            CREATE INDEX IF NOT EXISTS idx_csc_chunks_embedding 
            ON csc_chunks USING hnsw (embedding vector_cosine_ops);
        `);
        console.log('DEBUG: Index recreated.');

    } catch (err) {
        console.error('FATAL Error:', err);
        process.exit(1);
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

migrateCscChunks();
