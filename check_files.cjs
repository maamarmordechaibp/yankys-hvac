const fs = require('fs');
const proposals = fs.readFileSync('src/pages/Proposals.jsx', 'utf8');
const invoices = fs.readFileSync('src/pages/Invoices.jsx', 'utf8');

// Just check for "+ Promo" to see where it lives
console.log('Proposals has + Promo:', proposals.includes('+ Promo'));
console.log('Invoices has + Promo:', invoices.includes('+ Promo'));
