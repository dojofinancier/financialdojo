import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables for convenience if argument is missing
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionString = process.argv[2] && process.argv[2].startsWith('postgres')
    ? process.argv[2]
    : process.env.DIRECT_URL;

if (!connectionString) {
    console.error('Usage: npx tsx scripts/db_sizes.ts <connection_string>');
    process.exit(1);
}

const client = new Client({ connectionString });

async function getDbSizes() {
    const query = `
    SELECT
      relname AS table_name,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
      pg_total_relation_size(relid) AS size_bytes
    FROM pg_catalog.pg_statio_user_tables
    ORDER BY pg_total_relation_size(relid) DESC;
  `;

    try {
        console.log(`Connecting to DB...`);

        await client.connect();
        const res = await client.query(query);

        console.table(res.rows.map(r => ({ Table: r.table_name, Size: r.total_size })));

    } catch (err) {
        console.error('Error fetching DB sizes:', err);
    } finally {
        await client.end();
    }
}

getDbSizes();
