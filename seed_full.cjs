const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:skVXtIrKNfkEV6cW@db.vtnpjhmuolnqralehkvr.supabase.co:5432/postgres'
});

const items = [
    { category: 'Labor', item_name: 'Diagnostic / Service Call', description: 'Standard residential service call and diagnostic', price: 150 },
    { category: 'Labor', item_name: 'Emergency After-Hours Call', description: 'After-hours or weekend emergency dispatch', price: 250 },
    { category: 'Labor', item_name: 'Preventative Maintenance', description: 'Seasonal tune-up and inspection (Per System)', price: 120 },
    { category: 'Labor', item_name: 'Hourly Labor - Lead Tech', description: 'Standard hourly rate', price: 125 },
    { category: 'Parts', item_name: 'Dual Run Capacitor 35/5 uF', description: 'Universal replacement capacitor 440V', price: 40 },
    { category: 'Parts', item_name: 'Dual Run Capacitor 45/5 uF', description: 'Universal replacement capacitor 440V', price: 45 },
    { category: 'Parts', item_name: 'Start Capacitor w/ Relay', description: 'Compressor hard start kit', price: 85 },
    { category: 'Parts', item_name: '30A 1-Pole Contactor', description: 'Standard 24V coil contactor', price: 35 },
    { category: 'Parts', item_name: '40A 2-Pole Contactor', description: 'Heavy duty 24V coil contactor', price: 55 },
    { category: 'Parts', item_name: '24V Transformer (40VA)', description: 'Control voltage transformer', price: 30 },
    { category: 'Parts', item_name: 'Condenser Fan Motor (1/4 HP)', description: 'Universal outdoor fan motor', price: 185 },
    { category: 'Parts', item_name: 'Universal Control Board', description: 'OEM replacement control board', price: 180 },
    { category: 'Parts', item_name: 'Hot Surface Ignitor', description: 'Silicon carbide furnace ignitor', price: 45 },
    { category: 'Parts', item_name: 'Flame Sensor', description: 'Standard furnace flame sensing rod', price: 25 },
    { category: 'Parts', item_name: 'Thermostat (Programmable)', description: '5-2 day programmable thermostat', price: 95 },
    { category: 'Parts', item_name: 'Thermostat (Smart / WiFi)', description: 'Smart thermostat (e.g., Ecobee, Nest)', price: 250 },
    { category: 'Equipment', item_name: '2.0-Ton AC Condenser', description: '14 SEER Base Condensing Unit', price: 1800 },
    { category: 'Equipment', item_name: '3.0-Ton AC Condenser', description: '14 SEER Base Condensing Unit', price: 2200 },
    { category: 'Equipment', item_name: '80% Gas Furnace (80k BTU)', description: 'Standard Efficiency Gas Furnace', price: 1400 },
    { category: 'Ducts', item_name: '6" Flex Duct (25ft Box)', description: 'Insulated R-6 flex ducting', price: 85 },
    { category: 'Refrigerant', item_name: 'R-410A Refrigerant (per lb)', description: 'System refrigerant recharge', price: 65 },
    { category: 'Refrigerant', item_name: 'R-22 Refrigerant (per lb)', description: 'Legacy system refrigerant recharge', price: 120 },
    { category: 'Refrigerant', item_name: 'Nitrogen Pressure Test', description: 'System leak test with inert nitrogen', price: 75 },
    { category: 'Fees', item_name: 'EPA Recovery Fee', description: 'Safe recovery per EPA guidelines', price: 40 },
    { category: 'Fees', item_name: 'Diagnostic Waiver', description: 'Diagnostic fee waived with repair completion', price: -150 }
];

async function run() {
  await client.connect();
  
  // Clear out anything existing to ensure a pristine dictionary
  await client.query('DELETE FROM public.pricebook');
  
  // Insert new definitive set
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const text = 'INSERT INTO public.pricebook (category, item_name, description, price) VALUES ($1, $2, $3, $4)';
    const values = [item.category, item.item_name, item.description, item.price];
    await client.query(text, values);
  }
  
  console.log('Successfully seeded database with professional HVAC items!');
  client.end();
}
run().catch(console.error);
