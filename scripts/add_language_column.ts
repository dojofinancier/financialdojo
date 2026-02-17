
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

async function addLanguageColumn() {
    try {
        await client.connect();
        console.log('Connected to target database.');

        for (const table of tables) {
            console.log(`Processing table: ${table}...`);
            try {
                // Check if column exists first to avoid errors or just use IF NOT EXISTS if supported (Postgres 9.6+)
                // Using IF NOT EXISTS for simplicity and safety
                await client.query(`
          ALTER TABLE "${table}" 
          ADD COLUMN IF NOT EXISTS "language" text NOT NULL DEFAULT 'en';
        `);
                console.log(`  - Successfully added/verified 'language' column in ${table}.`);
            } catch (err: any) {
                console.error(`  - Error updating ${table}:`, err.message);
            }
        }

        console.log('All tables processed.');

    } catch (err) {
        console.error('Error connecting or executing', err);
    } finally {
        await client.end();
    }
}

addLanguageColumn();
