
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

async function listTables() {
    try {
        await client.connect();
        console.log('Connected to target database.');

        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

        console.log('Tables in public schema:');
        res.rows.forEach(row => {
            console.log(`- ${row.table_name}`);
        });

    } catch (err) {
        console.error('Error executing query', err);
    } finally {
        await client.end();
    }
}

listTables();
