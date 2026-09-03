const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:skVXtIrKNfkEV6cW@db.vtnpjhmuolnqralehkvr.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT count(*) FROM public.pricebook');
  console.log('Pricebook rows:', res.rows[0].count);
  client.end();
}
run().catch(console.error);
