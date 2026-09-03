import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { Plus, Search, X, DollarSign, Send, Check, AlertTriangle, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function Proposals() {
    const { success, error: showError } = useToast();
    const [proposals, setProposals] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [editProposal, setEditProposal] = useState(null);
    const [printProposal, setPrintProposal] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        const [invRes, custRes, jobsRes] = await Promise.all([
            supabase.from('proposals').select('*, customers(name), proposal_items(*)').order('created_at', { ascending: false }),
            supabase.from('customers').select('id, name'),
            supabase.from('jobs').select('id, job_type, customer_id, customers(name)').eq('status', 'completed'),
        ]);
        setProposals(invRes.data || []);
        setCustomers(custRes.data || []);
        setJobs(jobsRes.data || []);
        setLoading(false);
    }

    async function handleSave(proposalData, items, customTaxRate) {
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const tax = subtotal * customTaxRate;
        const total = subtotal + tax;

        const proposalPayload = {
            ...proposalData,
            subtotal,
            tax,
            total,
            proposal_number: editProposal?.proposal_number || Date.now(),
        };

        let proposalId;
        if (editProposal) {
            const { error } = await supabase.from('proposals').update(proposalPayload).eq('id', editProposal.id);
            if (error) { showError(error.message); return; }
            proposalId = editProposal.id;
            await supabase.from('proposal_items').delete().eq('proposal_id', proposalId);
        } else {
            const { data, error } = await supabase.from('proposals').insert(proposalPayload).select().single();
            if (error) { showError(error.message); return; }
            proposalId = data.id;
        }

        if (items.length > 0) {
            const itemsPayload = items.map(item => ({ ...item, proposal_id: proposalId }));
            await supabase.from('proposal_items').insert(itemsPayload);
        }

        success(editProposal ? 'Proposal updated' : 'Proposal created');
        setShowForm(false);
        setEditProposal(null);
        loadData();
    }

    async function updateStatus(id, status) {
        const update = { status };
        if (status === 'accepted') update.accepted_date = new Date().toISOString().split('T')[0];
        const { error } = await supabase.from('proposals').update(update).eq('id', id);
        if (error) { showError(error.message); return; }
        success(`Proposal marked as ${status}`);
        loadData();
    }

    async function deleteProposal(id) {
        if (!confirm('Delete this proposal?')) return;
        await supabase.from('proposal_items').delete().eq('proposal_id', id);
        await supabase.from('proposals').delete().eq('id', id);
        success('Proposal deleted');
        loadData();
    }

    const filtered = proposals.filter(inv => {
        const matchSearch = !search || inv.customers?.name?.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const stats = {
        total: proposals.reduce((s, i) => s + (i.total || 0), 0),
        accepted: proposals.filter(i => i.status === 'accepted').reduce((s, i) => s + (i.total || 0), 0),
        outstanding: proposals.filter(i => ['sent'].includes(i.status)).reduce((s, i) => s + (i.total || 0), 0),
    };

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Proposals</h1>
                    <p>{proposals.length} total proposals</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditProposal(null); setShowForm(true); }}>
                    <Plus size={18} /> New Proposal
                </button>
            </div>

            <div className="kpi-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                <div className="kpi-card green">
                    <div className="kpi-icon green"><DollarSign size={20} /></div>
                    <div className="kpi-label">Total Billed</div>
                    <div className="kpi-value" style={{ fontSize: 'var(--font-2xl)' }}>${stats.total.toLocaleString()}</div>
                </div>
                <div className="kpi-card blue">
                    <div className="kpi-icon blue"><Check size={20} /></div>
                    <div className="kpi-label">Accepted</div>
                    <div className="kpi-value" style={{ fontSize: 'var(--font-2xl)' }}>${stats.accepted.toLocaleString()}</div>
                </div>
                <div className="kpi-card orange">
                    <div className="kpi-icon orange"><AlertTriangle size={20} /></div>
                    <div className="kpi-label">Pending</div>
                    <div className="kpi-value" style={{ fontSize: 'var(--font-2xl)' }}>${stats.outstanding.toLocaleString()}</div>
                </div>
            </div>

            <div className="filter-bar">
                <div className="search-box">
                    <Search size={16} />
                    <input placeholder="Search proposals..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="filter-tabs">
                    {['all', 'draft', 'sent', 'accepted', 'rejected'].map(s => (
                        <button key={s} className={`filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead><tr><th>Proposal #</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        {filtered.map(inv => (
                            <tr key={inv.id}>
                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>EST-{String(inv.proposal_number || '').slice(-4).padStart(4, '0')}</td>
                                <td><strong>{inv.customers?.name || '—'}</strong></td>
                                <td>{inv.created_at ? format(new Date(inv.created_at), 'MMM d, yyyy') : '—'}</td>
                                <td style={{ fontWeight: 700 }}>${(inv.total || 0).toLocaleString()}</td>
                                <td>
                                    <span className={`badge badge-${inv.status === 'accepted' ? 'green' : inv.status === 'rejected' ? 'red' : inv.status === 'sent' ? 'orange' : 'blue'} badge-dot`}>
                                        {inv.status}
                                    </span>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {inv.status === 'draft' && <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(inv.id, 'sent')}><Send size={14} /> Send</button>}
                                        {(inv.status === 'sent' || inv.status === 'rejected') && <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(inv.id, 'accepted')}><DollarSign size={14} /> Accepted</button>}
                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditProposal(inv); setShowForm(true); }}><FileText size={14} /></button>
                                        <button className="btn btn-ghost btn-icon btn-sm" title="Print Proposal" onClick={() => setPrintProposal(inv)}><FileText size={14} /></button>
                                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteProposal(inv.id)}><Trash2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && <tr><td colSpan={6}><div className="empty-state"><p>No proposals found</p></div></td></tr>}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <ProposalFormModal
                    proposal={editProposal}
                    customers={customers}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditProposal(null); }}
                />
            )}

            {printProposal && (
                <PrintableProposal proposal={printProposal} onClose={() => setPrintProposal(null)} />
            )}
        </div>
    );
}

function ProposalFormModal({ proposal, customers, onSave, onClose }) {
    const [form, setForm] = useState({
        customer_id: proposal?.customer_id || '',
        status: proposal?.status || 'draft',
        due_date: proposal?.due_date || '',
        notes: proposal?.notes || '',
    });
    const [items, setItems] = useState(
        proposal?.proposal_items?.length > 0
            ? proposal.proposal_items.map(i => ({ description: i.description, quantity: i.quantity, rate: i.rate }))
            : []
    );
    // Determine initial tax rate based on existing tax / subtotal, or default to 8.875%
    let initialTax = 0.08875;
    if (proposal && proposal.subtotal && proposal.tax) {
        initialTax = proposal.tax / proposal.subtotal;
    }
    const [taxRate, setTaxRate] = useState(initialTax);

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    function addItem() { setItems([...items, { description: '', quantity: 1, rate: 0 }]); }
    function addServiceCall() { setItems([...items, { description: 'Service Call', quantity: 1, rate: 150 }]); }
    function addPromo() { setItems([...items, { description: 'Promo Discount: [Reason]', quantity: 1, rate: -50 }]); }
    function removeItem(i) { setItems(items.filter((_, idx) => idx !== i)); }
    function updateItem(i, field, value) {
        const updated = [...items];
        updated[i] = { ...updated[i], [field]: field === 'description' ? value : Number(value) };
        setItems(updated);
    }

    const subtotal = items.reduce((s, i) => s + (i.quantity * i.rate), 0);
    const tax = Math.max(0, subtotal) * taxRate; // Don't tax negative subtotals
    const total = subtotal + tax;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{proposal ? 'Edit Proposal' : 'New Proposal'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); onSave(form, items, taxRate); }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Customer *</label>
                            <select className="form-select" name="customer_id" value={form.customer_id} onChange={handleChange} required>
                                <option value="">Select...</option>
                                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Due Date</label>
                            <input className="form-input" name="due_date" type="date" value={form.due_date} onChange={handleChange} />
                        </div>
                    </div>

                    <div style={{ marginTop: 'var(--space-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                            <label className="form-label" style={{ margin: 0 }}>Line Items</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn btn-ghost btn-sm" type="button" onClick={addServiceCall}><Plus size={14} /> Service Call</button>
                                <button className="btn btn-ghost btn-sm" type="button" onClick={addPromo}><Plus size={14} /> Promo</button>
                                <button className="btn btn-secondary btn-sm" type="button" onClick={addItem}><Plus size={14} /> Add Item</button>
                            </div>
                        </div>
                        {items.map((item, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 40px', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                                <input className="form-input" placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} />
                                <input className="form-input" type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} min={1} />
                                <input className="form-input" type="number" placeholder="Rate" value={item.rate} onChange={e => updateItem(i, 'rate', e.target.value)} min={0} step={0.01} />
                                {items.length > 0 && <button className="btn btn-ghost btn-icon btn-sm" type="button" onClick={() => removeItem(i)}><X size={14} /></button>}
                            </div>
                        ))}
                        {items.length === 0 && <div className="empty-state" style={{ padding: 'var(--space-xl)' }}><p>No line items added yet.</p></div>}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xl)', alignItems: 'flex-start' }}>
                        <div className="form-group" style={{ width: '250px' }}>
                            <label className="form-label">Tax Rate (%)</label>
                            <input className="form-input" type="number" step="0.001" min="0" max="100" value={(taxRate * 100).toFixed(3)} onChange={e => setTaxRate(Number(e.target.value) / 100)} />
                        </div>
                        <div style={{ width: '250px' }}>
                            <div className="detail-row"><span className="label">Subtotal</span><span className="value">${subtotal.toFixed(2)}</span></div>
                            <div className="detail-row"><span className="label">Tax (8%)</span><span className="value">${tax.toFixed(2)}</span></div>
                            <div className="detail-row" style={{ borderTop: '2px solid var(--border-primary)', fontWeight: 700, fontSize: 'var(--font-lg)' }}>
                                <span className="label">Total</span><span className="value">${total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginTop: 'var(--space-lg)' }}>
                        <label className="form-label">Notes</label>
                        <textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange} rows={2} />
                    </div>

                    <div className="modal-footer">
                        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" type="submit">{proposal ? 'Update' : 'Create'} Proposal</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PrintableProposal({ proposal, onClose }) {
    function handlePrint() {
        window.print();
    }

    return (
        <div className="modal-overlay" style={{ background: 'var(--bg-primary)', zIndex: 1000 }} onClick={onClose}>
            <div className="printable-proposal-container" onClick={e => e.stopPropagation()} style={{ background: 'white', color: 'black', width: '100%', maxWidth: '800px', height: '100vh', overflowY: 'auto', padding: '40px', position: 'relative' }}>

                {/* Non-printable header controls */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '20px' }}>
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handlePrint}>Print / Save PDF</button>
                </div>

                <style>{`
                    @media print {
                        body * { visibility: hidden; }
                        .printable-proposal-container, .printable-proposal-container * { visibility: visible; color: black !important; }
                        .printable-proposal-container { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
                        .no-print { display: none !important; }
                        .badge { border: 1px solid black !important; color: black !important; background: transparent !important; }
                    }
                `}</style>

                {/* Print Content Starts Here */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                    <div>
                        <img src="/logo.png" alt="Company Logo" style={{ height: '60px', marginBottom: '10px' }} />
                        <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#1a1f35' }}>Yanky's HVAC</h2>
                        <p style={{ margin: '4px 0', fontSize: '14px', color: '#666' }}>123 Climate Way<br />Brooklyn, NY 11211<br />(555) 123-4567<br />billing@yankyshvac.com</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <h1 style={{ fontSize: '36px', fontWeight: 300, margin: '0 0 10px 0', color: '#333' }}>INVOICE</h1>
                        <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Status:</strong> <span style={{ textTransform: 'uppercase' }}>{proposal.status}</span></p>
                        <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Proposal #:</strong> EST-{String(proposal.proposal_number || '').slice(-4).padStart(4, '0')}</p>
                        <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Date:</strong> {format(new Date(proposal.created_at || Date.now()), 'MMMM d, yyyy')}</p>
                        {proposal.due_date && <p style={{ margin: '4px 0', fontSize: '14px' }}><strong>Due Date:</strong> {format(new Date(proposal.due_date), 'MMMM d, yyyy')}</p>}
                    </div>
                </div>

                <div style={{ marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '16px', borderBottom: '1px solid #ddd', paddingBottom: '8px', marginBottom: '12px', color: '#333' }}>ESTIMATE FOR:</h3>
                    <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: 600 }}>{proposal.customers?.name}</p>
                    {proposal.customers?.address && (
                        <p style={{ margin: '4px 0', fontSize: '14px', color: '#555' }}>
                            {proposal.customers.address}<br />
                            {proposal.customers.city}, {proposal.customers.state} {proposal.customers.zip}
                        </p>
                    )}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                            <th style={{ padding: '12px 8px', textAlign: 'left', color: '#333', fontWeight: 600 }}>Description</th>
                            <th style={{ padding: '12px 8px', textAlign: 'right', color: '#333', fontWeight: 600 }}>Qty</th>
                            <th style={{ padding: '12px 8px', textAlign: 'right', color: '#333', fontWeight: 600 }}>Rate</th>
                            <th style={{ padding: '12px 8px', textAlign: 'right', color: '#333', fontWeight: 600 }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(proposal.proposal_items || []).map((item, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px 8px', color: '#444' }}>{item.description}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', color: '#444' }}>{item.quantity}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', color: '#444' }}>${Number(item.rate).toFixed(2)}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', color: '#444' }}>${(item.quantity * item.rate).toFixed(2)}</td>
                            </tr>
                        ))}
                        {(!proposal.proposal_items || proposal.proposal_items.length === 0) && (
                            <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No items added</td></tr>
                        )}
                    </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
                    <div style={{ width: '300px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#555' }}>
                            <span>Subtotal</span>
                            <span>${Number(proposal.subtotal || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#555' }}>
                            <span>Tax</span>
                            <span>${Number(proposal.tax || 0).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid #333', fontWeight: 800, fontSize: '20px', color: '#000', marginTop: '8px' }}>
                            <span>Total</span>
                            <span>${Number(proposal.total || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {proposal.notes && (
                    <div style={{ marginTop: '40px', padding: '20px', background: '#f8f9fa', borderRadius: '8px', color: '#555', fontSize: '14px' }}>
                        <strong style={{ color: '#333' }}>Notes / Memo:</strong><br />
                        {proposal.notes}
                    </div>
                )}

                <div style={{ marginTop: '60px', textAlign: 'center', fontSize: '12px', color: '#999' }}>
                    Thank you for your business! Please make checks payable to Yanky's HVAC.
                </div>
            </div>
        </div>
    );
}
