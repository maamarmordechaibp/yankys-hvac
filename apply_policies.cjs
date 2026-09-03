const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: 'postgresql://postgres:skVXtIrKNfkEV6cW@db.vtnpjhmuolnqralehkvr.supabase.co:5432/postgres' });
async function run() {
  await client.connect();
  const sql = fs.readFileSync(process.env.TEMP + '/setup2.sql', 'utf8');
  await client.query(sql);
  console.log('Policies applied successfully!');
  client.end();
}
run().catch(console.error);
