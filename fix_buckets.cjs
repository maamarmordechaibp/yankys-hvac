const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:skVXtIrKNfkEV6cW@db.vtnpjhmuolnqralehkvr.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const sql = `
    INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;
    DROP POLICY IF EXISTS public_access_documents ON storage.objects;
    CREATE POLICY public_access_documents ON storage.objects FOR ALL USING (bucket_id = 'documents');
  `;
  await client.query(sql);
  console.log('Successfully set bucket policies.');
  client.end();
}
run().catch(console.error);
