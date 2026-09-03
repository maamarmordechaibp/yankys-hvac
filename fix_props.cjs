const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Fix duplicate pricebook
    content = content.replace(/pricebook, onSave, onClose , pricebook = \[\]/g, "pricebook = [], onSave, onClose");
    
    // Make sure we handle others
    content = content.replace(/customers, pricebook, onSave/g, 'customers, pricebook = [], onSave');
    
    // Ensure no duplicates exist in general for pricebook prop
    content = content.replace(/\{ invoice, customers, \s*pricebook( = \[\])?, \s*onSave, \s*onClose\s*, \s*pricebook = \[\]\}/g, "{ invoice, customers, pricebook = [], onSave, onClose }");
    content = content.replace(/\{ proposal, customers, \s*pricebook( = \[\])?, \s*onSave, \s*onClose\s*, \s*pricebook = \[\]\}/g, "{ proposal, customers, pricebook = [], onSave, onClose }");

    fs.writeFileSync(file, content);
}
fix('src/pages/Invoices.jsx');
fix('src/pages/Proposals.jsx');
console.log('Fixed');
