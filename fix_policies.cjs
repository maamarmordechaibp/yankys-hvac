const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:skVXtIrKNfkEV6cW@db.vtnpjhmuolnqralehkvr.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  const sql = `
    ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS customer_documents_all ON public.customer_documents;
    CREATE POLICY customer_documents_all ON public.customer_documents FOR ALL USING (auth.role() = 'authenticated');

    ALTER TABLE public.pricebook ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS pricebook_all ON public.pricebook;
    CREATE POLICY pricebook_all ON public.pricebook FOR ALL USING (auth.role() = 'authenticated');

    ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS proposals_all ON public.proposals;
    CREATE POLICY proposals_all ON public.proposals FOR ALL USING (auth.role() = 'authenticated');

    ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS proposal_items_all ON public.proposal_items;
    CREATE POLICY proposal_items_all ON public.proposal_items FOR ALL USING (auth.role() = 'authenticated');
  `;
  await client.query(sql);
  console.log('Successfully set policies.');
  client.end();
}
run().catch(console.error);
