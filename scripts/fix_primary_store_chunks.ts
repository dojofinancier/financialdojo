
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

async function fixPrimaryStoreChunks() {
    try {
        await client.connect();
        console.log('Connected to target database.');

        const table = 'primary_store_chunks';
        console.log(`Fixing table: ${table}...`);

        // Set default to 'en'
        await client.query(`
      ALTER TABLE "${table}" 
      ALTER COLUMN "language" SET DEFAULT 'en';
    `);
        console.log(`  - Set default to 'en'.`);

        // Update existing nulls to 'en'
        await client.query(`
      UPDATE "${table}" 
      SET "language" = 'en' 
      WHERE "language" IS NULL;
    `);
        console.log(`  - Updated existing NULL values to 'en'.`);

        // Set NOT NULL constraint
        await client.query(`
      ALTER TABLE "${table}" 
      ALTER COLUMN "language" SET NOT NULL;
    `);
        console.log(`  - Set NOT NULL constraint.`);

        console.log('Table fixed.');

    } catch (err: any) {
        console.error(`Error fixing ${'primary_store_chunks'}:`, err.message);
    } finally {
        await client.end();
    }
}

fixPrimaryStoreChunks();
