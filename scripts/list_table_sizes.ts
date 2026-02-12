import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sourceClient = new Client({ connectionString: process.env.DIRECT_URL });
const targetClient = new Client({ connectionString: process.env.TARGET_DIRECT_URL });

async function listTableSizes() {
    const query = `
    SELECT
      relname AS table_name,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
      pg_total_relation_size(relid) AS total_size_bytes
    FROM pg_catalog.pg_statio_user_tables
    ORDER BY pg_total_relation_size(relid) DESC;
  `;

    try {
        console.log('Connecting...');
        await sourceClient.connect();
        await targetClient.connect();

        console.log('\n--- SOURCE DATABASE TABLES ---');
        const sourceRes = await sourceClient.query(query);
        console.table(sourceRes.rows.map(r => ({ Table: r.table_name, Size: r.total_size })));

        console.log('\n--- TARGET DATABASE TABLES ---');
        const targetRes = await targetClient.query(query);
        console.table(targetRes.rows.map(r => ({ Table: r.table_name, Size: r.total_size })));

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

listTableSizes();
