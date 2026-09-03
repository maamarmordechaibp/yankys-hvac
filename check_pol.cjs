const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:skVXtIrKNfkEV6cW@db.vtnpjhmuolnqralehkvr.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const res = await client.query(`SELECT tablename, policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'pricebook';`);
  console.log(JSON.stringify(res.rows, null, 2));
  client.end();
}
run().catch(console.error);
