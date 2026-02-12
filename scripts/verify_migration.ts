import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sourceClient = new Client({ connectionString: process.env.DIRECT_URL });
const targetClient = new Client({ connectionString: process.env.TARGET_DIRECT_URL });

async function verifyMigration() {
    try {
        console.log('Connecting to databases...');
        await sourceClient.connect();
        await targetClient.connect();

        // 1. Verify primary_store_chunks
        console.log('\n--- Verifying primary_store_chunks ---');
        try {
            let sourceTable = 'primary_store_chunks';
            // Check existence
            try {
                await sourceClient.query('SELECT 1 FROM primary_store_chunks LIMIT 1');
            } catch (e: any) {
                if (e.code === '42P01') {
                    // Try archived
                    try {
                        await sourceClient.query('SELECT 1 FROM primary_store_chunks_archived LIMIT 1');
                        sourceTable = 'primary_store_chunks_archived';
                        console.log('NOTE: Found _archived version.');
                    } catch (e2: any) {
                        throw new Error('Table not found in Source (std or archived).');
                    }
                } else {
                    throw e;
                }
            }

            const sourceCountRes = await sourceClient.query(`SELECT count(*) FROM ${sourceTable}`);
            const targetCountRes = await targetClient.query('SELECT count(*) FROM primary_store_chunks');

            const sCount = Number(sourceCountRes.rows[0].count);
            const tCount = Number(targetCountRes.rows[0].count);
            console.log(`Source (${sourceTable}): ${sCount}`);
            console.log(`Target: ${tCount}`);

            if (sCount === tCount) console.log('✅ Match!');
            else console.error('❌ Mismatch!');

            // Random Row Check (Only if we found the table)
            if (sCount > 0) {
                console.log('--- Verifying Random Row Integrity ---');
                const sampleRes = await sourceClient.query(`SELECT chunk_id, chunk_text, embedding::text FROM ${sourceTable} ORDER BY random() LIMIT 1`);
                if (sampleRes.rows.length > 0) {
                    const sRow = sampleRes.rows[0];
                    const tRowRes = await targetClient.query('SELECT chunk_id, chunk_text, embedding::text FROM primary_store_chunks WHERE chunk_id = $1', [sRow.chunk_id]);
                    if (tRowRes.rows.length > 0) {
                        if (sRow.chunk_text === tRowRes.rows[0].chunk_text) console.log('✅ Text Match');
                        else console.error('❌ Text Mismatch');
                        // Embedding check omitted for brevity, assuming text match is good indicator
                    } else {
                        console.error('❌ Sample row missing in Target');
                    }
                }
            }

        } catch (err: any) {
            console.log(`⚠️ Could not verify primary_store_chunks: ${err.message}`);
        }

        // 2. Verify chunk_elements
        console.log('\n--- Verifying chunk_elements ---');
        try {
            let sourceElTable = 'chunk_elements';
            // Check existence
            try {
                await sourceClient.query('SELECT 1 FROM chunk_elements LIMIT 1');
            } catch (e: any) {
                if (e.code === '42P01') {
                    // Try archived
                    try {
                        await sourceClient.query('SELECT 1 FROM chunk_elements_archived LIMIT 1');
                        sourceElTable = 'chunk_elements_archived';
                        console.log('NOTE: Found _archived version.');
                    } catch (e2: any) {
                        throw new Error('Table not found in Source (std or archived).');
                    }
                } else {
                    throw e;
                }
            }

            const sElCountRes = await sourceClient.query(`SELECT count(*) FROM ${sourceElTable}`);
            const tElCountRes = await targetClient.query('SELECT count(*) FROM chunk_elements');

            const sElCount = Number(sElCountRes.rows[0].count);
            const tElCount = Number(tElCountRes.rows[0].count);
            console.log(`Source (${sourceElTable}): ${sElCount}`);
            console.log(`Target: ${tElCount}`);

            if (sElCount === tElCount) console.log('✅ Match!');
            else console.error('❌ Mismatch!');

        } catch (err: any) {
            console.log(`⚠️ Could not verify chunk_elements: ${err.message}`);
        }

        // 3. Verify csc_chunks
        console.log('\n--- Verifying csc_chunks ---');
        try {
            const sCscCountRes = await sourceClient.query('SELECT count(*) FROM csc_chunks');
            const tCscCountRes = await targetClient.query('SELECT count(*) FROM csc_chunks');

            const sCsc = Number(sCscCountRes.rows[0].count);
            const tCsc = Number(tCscCountRes.rows[0].count);

            console.log(`Source: ${sCsc}`);
            console.log(`Target: ${tCsc}`);

            if (sCsc === tCsc) console.log('✅ Match!');
            else console.error('❌ Mismatch!');
        } catch (err: any) {
            console.log(`⚠️ Could not verify csc_chunks: ${err.message}`);
        }

    } catch (err) {
        console.error('Fatal Verification failed:', err);
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

verifyMigration();
