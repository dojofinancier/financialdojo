import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BATCH_SIZE = 50; // Proven batch size

// Initialize PG Client for SOURCE database
const sourceClient = new Client({
    connectionString: process.env.DIRECT_URL,
});

// Initialize PG Client for TARGET database
const targetClient = new Client({
    connectionString: process.env.TARGET_DIRECT_URL,
});

async function migrateChunksV2() {
    console.log('--- STARTING MIGRATION V2 ---');
    try {
        console.log('DEBUG: Connecting to databases...');
        await sourceClient.connect();
        await targetClient.connect();
        console.log('DEBUG: Connected successfully.');

        // --- 0. Drop Index to speed up inserts ---
        console.log('DEBUG: Dropping index idx_primary_store_chunks_embedding...');
        try {
            await targetClient.query(`DROP INDEX IF EXISTS idx_primary_store_chunks_embedding;`);
        } catch (e) { console.error('Index drop error (ignorable):', e); }
        console.log('DEBUG: Index dropped.');

        // --- 1. Migrate primary_store_chunks ---
        console.log('DEBUG: Starting migration of primary_store_chunks...');
        const countResult = await sourceClient.query('SELECT count(*) FROM primary_store_chunks');
        const totalChunks = Number(countResult.rows[0].count);
        console.log(`DEBUG: Total chunks to migrate: ${totalChunks}`);

        let processedChunks = 0;

        // Retry loop logic? Just standard Batch processing
        while (processedChunks < totalChunks) {
            try {
                const fetchQuery = `
                SELECT 
                chunk_id, chunk_text, chunk_index, 
                embedding::text, 
                token_count, section_path, document_id, content_hash, source_type, 
                http_status, retrieved_at, version, source_id, canonical_url, 
                final_url, title, tier, reliability_score, language, status, 
                course, metadata, created_at
                FROM primary_store_chunks
                ORDER BY chunk_id ASC
                LIMIT $1 OFFSET $2
            `;
                const result = await sourceClient.query(fetchQuery, [BATCH_SIZE, processedChunks]);
                const batch = result.rows;

                if (batch.length === 0) break;

                const valueStrings: string[] = [];
                const values: any[] = [];
                let paramIndex = 1;

                for (const row of batch) {
                    const rowParams: string[] = [];
                    values.push(row.chunk_id); rowParams.push(`$${paramIndex++}`);
                    values.push(row.chunk_text); rowParams.push(`$${paramIndex++}`);
                    values.push(row.chunk_index); rowParams.push(`$${paramIndex++}`);

                    // INLINED VECTOR for safety against param limits
                    if (row.embedding) rowParams.push(`'${row.embedding}'::vector`);
                    else rowParams.push(`NULL`);

                    values.push(row.token_count); rowParams.push(`$${paramIndex++}`);
                    values.push(row.section_path); rowParams.push(`$${paramIndex++}`);
                    values.push(row.document_id); rowParams.push(`$${paramIndex++}`);
                    values.push(row.content_hash); rowParams.push(`$${paramIndex++}`);
                    values.push(row.source_type); rowParams.push(`$${paramIndex++}`);
                    values.push(row.http_status); rowParams.push(`$${paramIndex++}`);
                    values.push(row.retrieved_at); rowParams.push(`$${paramIndex++}`);
                    values.push(row.version); rowParams.push(`$${paramIndex++}`);
                    values.push(row.source_id); rowParams.push(`$${paramIndex++}`);
                    values.push(row.canonical_url); rowParams.push(`$${paramIndex++}`);
                    values.push(row.final_url); rowParams.push(`$${paramIndex++}`);
                    values.push(row.title); rowParams.push(`$${paramIndex++}`);
                    values.push(row.tier); rowParams.push(`$${paramIndex++}`);
                    values.push(row.reliability_score); rowParams.push(`$${paramIndex++}`);
                    values.push(row.language); rowParams.push(`$${paramIndex++}`);
                    values.push(row.status); rowParams.push(`$${paramIndex++}`);
                    values.push(row.course); rowParams.push(`$${paramIndex++}`);
                    values.push(row.metadata); rowParams.push(`$${paramIndex++}`);
                    values.push(row.created_at); rowParams.push(`$${paramIndex++}`);

                    valueStrings.push(`(${rowParams.join(',')})`);
                }

                const insertQuery = `
                INSERT INTO primary_store_chunks (chunk_id, chunk_text, chunk_index, embedding, token_count, section_path, document_id, content_hash, source_type, http_status, retrieved_at, version, source_id, canonical_url, final_url, title, tier, reliability_score, language, status, course, metadata, created_at)
                VALUES ${valueStrings.join(',')}
                ON CONFLICT (chunk_id) DO NOTHING;
            `;

                await targetClient.query(insertQuery, values);

                processedChunks += batch.length;
                const progress = ((processedChunks / totalChunks) * 100).toFixed(1);
                if (processedChunks % 500 === 0 || processedChunks >= totalChunks) {
                    console.log(`Processed ${processedChunks} / ${totalChunks} chunks (${progress}%).`);
                }

            } catch (err) {
                console.error(`FATAL Error in batch at offset ${processedChunks}:`, err);
                // Don't quit, try next batch? No, fail fast is safer for data integrity monitoring.
                process.exit(1);
            }
        }

        console.log('✅ primary_store_chunks migration complete.');


        // --- 2. Recreate Index ---
        console.log('Recreating index idx_primary_store_chunks_embedding...');
        await targetClient.query(`
      CREATE INDEX IF NOT EXISTS idx_primary_store_chunks_embedding 
      ON primary_store_chunks USING hnsw (embedding vector_cosine_ops);
    `);
        console.log('Index recreated.');


        // --- 3. Migrate chunk_elements ---
        console.log('Starting migration of chunk_elements...');

        const elementsCountResult = await sourceClient.query('SELECT count(*) FROM chunk_elements');
        const totalElements = Number(elementsCountResult.rows[0].count);
        console.log(`Total elements to migrate: ${totalElements}`);

        let processedElements = 0;

        while (processedElements < totalElements) {
            try {
                const fetchElementQuery = `
                SELECT 
                chunk_id, element_id, course, created_at, discovered_via, relevance_score
                FROM chunk_elements
                ORDER BY chunk_id ASC, element_id ASC, course ASC
                LIMIT $1 OFFSET $2
            `;
                const result = await sourceClient.query(fetchElementQuery, [BATCH_SIZE, processedElements]);
                const batch = result.rows;

                if (batch.length === 0) break;

                const valueStrings: string[] = [];
                const values: any[] = [];
                let paramIndex = 1;

                for (const row of batch) {
                    const rowParams: string[] = [];
                    for (let i = 0; i < 6; i++) {
                        rowParams.push(`$${paramIndex}`);
                        paramIndex++;
                    }
                    valueStrings.push(`(${rowParams.join(',')})`);

                    values.push(
                        row.chunk_id, row.element_id, row.course, row.created_at, row.discovered_via, row.relevance_score
                    );
                }

                await targetClient.query(`
                INSERT INTO chunk_elements (chunk_id, element_id, course, created_at, discovered_via, relevance_score)
                VALUES ${valueStrings.join(',')}
                ON CONFLICT (chunk_id, element_id, course) DO NOTHING;
            `, values);

                processedElements += batch.length;
                const progress = ((processedElements / totalElements) * 100).toFixed(1);
                if (processedElements % 500 === 0 || processedElements >= totalElements) {
                    console.log(`Processed ${processedElements} / ${totalElements} elements (${progress}%).`);
                }
            } catch (err) {
                console.error(`FATAL Error in element batch at offset ${processedElements}:`, err);
                process.exit(1);
            }
        }

        console.log('✅ chunk_elements migration complete.');

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    } finally {
        await sourceClient.end();
        await targetClient.end();
        console.log('--- Migration v2 Completed Successfully ---');
        // Ensure exit
        process.exit(0);
    }
}

migrateChunksV2();
