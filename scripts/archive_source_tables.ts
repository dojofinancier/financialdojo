import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const sourceClient = new Client({
    connectionString: process.env.DIRECT_URL,
});

async function archiveTables() {
    try {
        console.log('Connecting to Source Database...');
        await sourceClient.connect();
        console.log('Connected.');

        // 1. Rename chunk_elements
        console.log('Archiving (Renaming) chunk_elements...');
        await sourceClient.query(`
      ALTER TABLE IF EXISTS chunk_elements 
      RENAME TO chunk_elements_archived;
    `);
        console.log('✅ chunk_elements renamed to chunk_elements_archived');

        // 2. Rename primary_store_chunks
        console.log('Archiving (Renaming) primary_store_chunks...');
        await sourceClient.query(`
      ALTER TABLE IF EXISTS primary_store_chunks 
      RENAME TO primary_store_chunks_archived;
    `);
        console.log('✅ primary_store_chunks renamed to primary_store_chunks_archived');

        console.log('\n--- ARCHIVE COMPLETE ---');
        console.log('The tables are now renamed. Your app will no longer see them.');
        console.log('Run your app/tests. If everything works as expected with the NEW database,');
        console.log('you can safely DROP these tables later using:');
        console.log('\nDROP TABLE chunk_elements_archived;');
        console.log('DROP TABLE primary_store_chunks_archived;');

    } catch (err) {
        console.error('Error executing archive:', err);
    } finally {
        await sourceClient.end();
    }
}

archiveTables();
