const fs = require('fs');

function updateFile(file, isProposal = false) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Ensure pricebook state and loading in Context/Component
    if (!content.includes('const [pricebook, setPricebook] = useState([]);')) {
        content = content.replace(
            /const \[loading, setLoading\] = useState\(true\);/,
            'const [pricebook, setPricebook] = useState([]);\n    const [loading, setLoading] = useState(true);'
        );
    }

    // 2. Add Pricebook to loadData block
    if (!content.includes("supabase.from('pricebook')")) {
        content = content.replace(
            /(const \[.*\] = await Promise\.all\(\[[\s\S]*?)(\]\);)/,
            "$1    supabase.from('pricebook').select('*').order('category')\n        $2"
        );
        content = content.replace(
            /setJobs\((.*?)\);/,
            "setJobs($1);\n        setPricebook(arguments[0][arguments[0].length-1]?.data || []);"
        ); // Kinda hacky, let's do a better replace for loadData depending on structure
    }

    // Better loadData replace for the known structure:
    content = content.replace(
        /const \[invRes, custRes, jobsRes\] = await Promise\.all\(\[(.*?)\]\);[\s\n]*setInvoices\(invRes\.data \|\| \[\]\);[\s\n]*setCustomers\(custRes\.data \|\| \[\]\);[\s\n]*setJobs\(jobsRes\.data \|\| \[\]\);/gs,
        `const [invRes, custRes, jobsRes, pbRes] = await Promise.all([$1, supabase.from('pricebook').select('*')]);
        setInvoices(invRes.data || []); setCustomers(custRes.data || []); setJobs(jobsRes.data || []); setPricebook(pbRes?.data || []);`
    );
    // For proposals:
    content = content.replace(
        /const \[invRes, custRes, jobsRes\] = await Promise\.all\(\[(.*?)\]\);[\s\n]*setProposals\(invRes\.data \|\| \[\]\);[\s\n]*setCustomers\(custRes\.data \|\| \[\]\);[\s\n]*setJobs\(jobsRes\.data \|\| \[\]\);/gs,
        `const [invRes, custRes, jobsRes, pbRes] = await Promise.all([$1, supabase.from('pricebook').select('*')]);
        setProposals(invRes.data || []); setCustomers(custRes.data || []); setJobs(jobsRes.data || []); setPricebook(pbRes?.data || []);`
    );
    
    // Pass pricebook to modal
    content = content.replace(/customers=\{customers\}/g, "customers={customers}\n                    pricebook={pricebook}");

    // 3. Update the Modal component's props
    const formName = isProposal ? 'ProposalFormModal' : 'InvoiceFormModal';
    content = content.replace(new RegExp(`function ${formName}\\(\\{(.*?)\\}\\) \\{`), `function ${formName}({$1, pricebook = []}) {`);

    // 4. Update Modal Form State to include discount
    content = content.replace(
        /taxRate: (.*?),/,
        `taxRate: $1,\n        discount_type: item?.discount_type || 'fixed',\n        discount_value: item?.discount_value || 0,`
    );

    // 5. Update the calculations inside effectively
    // Search for subtotal calculation
    const calcBlock = `    const subtotal = form.items.reduce((s, i) => s + (i.quantity * i.rate), 0);
    const discountAmt = form.discount_type === 'percent' ? (subtotal * (Number(form.discount_value) || 0) / 100) : (Number(form.discount_value) || 0);
    const taxableAmount = Math.max(0, subtotal - discountAmt);
    const tax = taxableAmount * (Number(form.taxRate) || 0) / 100;
    const total = taxableAmount + tax;`;
    
    content = content.replace(
        /const subtotal = .*?const total = subtotal \+ tax;/gs,
        calcBlock
    );
    // There are two places (form modal and print view)
    content = content.replace(
        /const printSubtotal = .*?const printTotal = printSubtotal \+ printTax;/gs,
        `const printSubtotal = p.items.reduce((s, i) => s + (i.quantity * i.rate), 0);
    const printDiscount = p.discount_type === 'percent' ? (printSubtotal * (Number(p.discount_value) || 0) / 100) : (Number(p.discount_value) || 0);
    const printTaxable = Math.max(0, printSubtotal - printDiscount);
    const printTax = printTaxable * ((p.tax || 0) / printSubtotal) || 0; // rough backward compat
    const printTotal = printTaxable + printTax;` // Just for print view
    );

    // Actually, print view uses p.subtotal and p.tax from db usually, but if relying on items:
    content = content.replace(
        /const subtotal = p\.items\?\.reduce.*?const total = subtotal \+ tax;/gs,
         `const subtotal = p.items?.reduce((s, i) => s + (i.quantity * i.rate), 0) || 0;
                            const discountAmt = p.discount_type === 'percent' ? (subtotal * (Number(p.discount_value) || 0) / 100) : (Number(p.discount_value) || 0);
                            const taxable = Math.max(0, subtotal - discountAmt);
                            const tax = p.tax || (taxable * 0.08875);
                            const total = taxable + tax;`
    );

    // 6. Update the line items UI in the modal
    // Delete "+ Promo"
    content = content.replace(/<button type="button" className="btn btn-ghost btn-sm" onClick=\{.*?\}\s*>\s*<Plus size=\{14\} \/> Promo\s*<\/button>/g, '');

    // Add state for searchable dropdown
    content = content.replace(/const \[form, setForm\] = useState\(\{/g, `const [activeSearch, setActiveSearch] = useState(null);\n    const [form, setForm] = useState({`);

    // Replace the plain input with searchable input
    const oldInput = `<input className="form-input" style={{ flex: 1 }} placeholder="Description" value={item.description} onChange={e => updateItem(index, 'description', e.target.value)} required />`;
    
    const newInput = `<div style={{ flex: 1, position: 'relative' }}>
        <input 
            className="form-input" 
            style={{ width: '100%' }} 
            placeholder="Search pricebook or type custom description..." 
            value={item.description}
            onChange={e => updateItem(index, 'description', e.target.value)}
            onFocus={() => setActiveSearch(index)}
            onBlur={() => setTimeout(() => setActiveSearch(null), 250)}
            required 
        />
        {activeSearch === index && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', zIndex: 50, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {pricebook.filter(pb => pb.item_name.toLowerCase().includes((item.description || '').toLowerCase())).map(pb => (
                    <div 
                        key={pb.id} 
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}
                        onClick={() => {
                            let newItems = [...form.items];
                            newItems[index] = { ...newItems[index], description: pb.item_name, rate: pb.price };
                            setForm(prev => ({ ...prev, items: newItems }));
                            setActiveSearch(null);
                        }}
                    >
                        <div>
                            <strong>{pb.item_name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{pb.category}</div>
                        </div>
                        <strong style={{ alignSelf: 'center' }}>\${pb.price}</strong>
                    </div>
                ))}
            </div>
        )}
    </div>`;
    content = content.replace(oldInput, newInput);
    
    // Also remove the explicit Pricebook <select> if it exists since we built it into the search
    content = content.replace(/<select className="form-select".*?value="" onChange=\{e => \{.*?<\/select>/gs, '');

    // Add Discount controls near Tax Rate
    const taxBlock = `<div className="form-group" style={{ maxWidth: '200px' }}>
                                <label className="form-label">Tax Rate (%)</label>
                                <input className="form-input" type="number" step="0.001" value={form.taxRate} onChange={e => setForm(p => ({ ...p, taxRate: e.target.value }))} />
                            </div>`;
                            
    const discountAndTaxBlock = `<div style={{ display: 'flex', gap: '16px' }}>
                                <div className="form-group" style={{ maxWidth: '200px' }}>
                                    <label className="form-label">Tax Rate (%)</label>
                                    <input className="form-input" type="number" step="0.001" value={form.taxRate} onChange={e => setForm(p => ({ ...p, taxRate: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ maxWidth: '150px' }}>
                                    <label className="form-label">Discount Type</label>
                                    <select className="form-select" value={form.discount_type} onChange={e => setForm(p => ({ ...p, discount_type: e.target.value }))}>
                                        <option value="fixed">Fixed ($)</option>
                                        <option value="percent">Percent (%)</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ maxWidth: '150px' }}>
                                    <label className="form-label">Discount Val</label>
                                    <input className="form-input" type="number" step="0.01" value={form.discount_value} onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))} />
                                </div>
                            </div>`;
    
    content = content.replace(taxBlock, discountAndTaxBlock);

    // Adding discount row in the summary table of the form
    const formSummary = `                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
                                    <strong>\${subtotal.toFixed(2)}</strong>
                                </div>
                                {discountAmt > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ color: 'var(--error)' }}>Discount ({form.discount_type === 'percent' ? form.discount_value + '%' : '$' + form.discount_value})</span>
                                    <strong style={{ color: 'var(--error)' }}>-\${discountAmt.toFixed(2)}</strong>
                                </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Tax ({form.taxRate}%)</span>
                                    <strong>\${tax.toFixed(2)}</strong>
                                </div>`;
    // Find the current subtotal section and replace
    content = content.replace(/<div style=\{\{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var\(--border\)' \}\}>\s*<span style=\{\{ color: 'var\(--text-secondary\)' \}\}>Subtotal<\/span>[\s\S]*?Tax \(\{form.taxRate\}%\)<\/span>\s*<strong>\$\{tax\.toFixed\(2\)\}<\/strong>\s*<\/div>/, formSummary);


    // Adding discount row in the Print mode
    // We search for `<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span>Subtotal:</span>`
    const printSummaryOld = /<div style=\{\{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' \}\}>\s*<span>Subtotal:<\/span>\s*<span>\$\{subtotal\.toFixed\(2\)\}<\/span>\s*<\/div>/;
    const printSummaryNew = `<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span>Subtotal:</span>
                                        <span>\${subtotal.toFixed(2)}</span>
                                    </div>
                                    {discountAmt > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#c00' }}>
                                        <span>Discount:</span>
                                        <span>-\${discountAmt.toFixed(2)}</span>
                                    </div>
                                    )}`;
    content = content.replace(printSummaryOld, printSummaryNew);

    fs.writeFileSync(file, content);
}

// Execute on both
updateFile('src/pages/Invoices.jsx', false);
updateFile('src/pages/Proposals.jsx', true);
console.log('Done refactoring UI');
