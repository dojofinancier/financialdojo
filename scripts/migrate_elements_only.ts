import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BATCH_SIZE = 200; // Increased batch size for simpler table

// Initialize PG Client for SOURCE database
const sourceClient = new Client({
    connectionString: process.env.DIRECT_URL,
});

// Initialize PG Client for TARGET database
const targetClient = new Client({
    connectionString: process.env.TARGET_DIRECT_URL,
});

async function migrateElements() {
    console.log('--- STARTING MIGRATION: chunk_elements ---');
    try {
        console.log('DEBUG: Connecting to databases...');
        await sourceClient.connect();
        await targetClient.connect();
        console.log('DEBUG: Connected successfully.');

        // Get total count
        const elementsCountResult = await sourceClient.query('SELECT count(*) FROM chunk_elements');
        const totalElements = Number(elementsCountResult.rows[0].count);
        console.log(`DEBUG: Total elements to migrate: ${totalElements}`);

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
                    // 6 columns
                    for (let i = 0; i < 6; i++) {
                        rowParams.push(`$${paramIndex}`);
                        paramIndex++;
                    }
                    valueStrings.push(`(${rowParams.join(',')})`);

                    values.push(
                        row.chunk_id, row.element_id, row.course, row.created_at, row.discovered_via, row.relevance_score
                    );
                }

                const insertQuery = `
                INSERT INTO chunk_elements (chunk_id, element_id, course, created_at, discovered_via, relevance_score)
                VALUES ${valueStrings.join(',')}
                ON CONFLICT (chunk_id, element_id, course) DO NOTHING;
            `;

                await targetClient.query(insertQuery, values);

                processedElements += batch.length;
                const progress = ((processedElements / totalElements) * 100).toFixed(1);

                if (processedElements % 1000 === 0 || processedElements >= totalElements) {
                    console.log(`Processed ${processedElements} / ${totalElements} elements (${progress}%).`);
                }

            } catch (err) {
                console.error(`FATAL Error in batch at offset ${processedElements}:`, err);
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
        process.exit(0);
    }
}

migrateElements();
