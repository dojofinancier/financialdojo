
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.env.TARGET_DIRECT_URL;

if (!connectionString) {
    console.error('Error: TARGET_DIRECT_URL not found in .env');
    process.exit(1);
}

const client = new Client({
    connectionString: connectionString,
});

const tables = ['chunk_elements', 'csc_chunks', 'primary_store_chunks'];

async function verifyLanguageColumn() {
    try {
        await client.connect();
        console.log('Connected to target database for verification.');

        for (const table of tables) {
            const res = await client.query(`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = 'language';
      `, [table]);

            if (res.rows.length > 0) {
                const col = res.rows[0];
                console.log(`[PASS] ${table}: 'language' column found.`);
                console.log(`       Type: ${col.data_type}, Default: ${col.column_default}, Nullable: ${col.is_nullable}`);
            } else {
                console.error(`[FAIL] ${table}: 'language' column NOT found.`);
            }
        }

    } catch (err) {
        console.error('Error executing verification', err);
    } finally {
        await client.end();
    }
}

verifyLanguageColumn();
