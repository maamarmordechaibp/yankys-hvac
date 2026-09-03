import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { Plus, Search, X, Calendar, Wrench, AlertCircle, CheckCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const PLAN_TYPES = ['seasonal_tuneup', 'preventive_maintenance', 'full_coverage', 'filter_change', 'custom'];

export default function ServiceAgreements() {
    const { success, error: showError } = useToast();
    const [agreements, setAgreements] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editAgreement, setEditAgreement] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    async function load() {
        const [agRes, custRes] = await Promise.all([
            supabase.from('service_agreements').select('*, customers(name)').order('end_date'),
            supabase.from('customers').select('id, name'),
        ]);
        setAgreements(agRes.data || []);
        setCustomers(custRes.data || []);
        setLoading(false);
    }

    async function handleSave(data) {
        if (editAgreement) {
            const { error } = await supabase.from('service_agreements').update(data).eq('id', editAgreement.id);
            if (error) { showError(error.message); return; }
            success('Agreement updated');
        } else {
            const { error } = await supabase.from('service_agreements').insert(data);
            if (error) { showError(error.message); return; }
            success('Agreement created');
        }
        setShowForm(false);
        setEditAgreement(null);
        load();
    }

    async function handleDelete(id) {
        if (!confirm('Delete this agreement?')) return;
        await supabase.from('service_agreements').delete().eq('id', id);
        success('Agreement deleted');
        load();
    }

    const today = new Date().toISOString().split('T')[0];
    const filtered = agreements.filter(a => !search || a.customers?.name?.toLowerCase().includes(search.toLowerCase()));
    const active = filtered.filter(a => a.end_date >= today);
    const expired = filtered.filter(a => a.end_date < today);

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Service Plans</h1>
                    <p>{active.length} active, {expired.length} expired</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditAgreement(null); setShowForm(true); }}>
                    <Plus size={18} /> New Agreement
                </button>
            </div>

            <div className="filter-bar">
                <div className="search-box">
                    <Search size={16} />
                    <input placeholder="Search by customer..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            {active.length > 0 && (
                <>
                    <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CheckCircle size={18} style={{ color: 'var(--accent-green)' }} /> Active Plans
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-2xl)' }}>
                        {active.map(ag => <AgreementCard key={ag.id} agreement={ag} onEdit={() => { setEditAgreement(ag); setShowForm(true); }} onDelete={() => handleDelete(ag.id)} />)}
                    </div>
                </>
            )}

            {expired.length > 0 && (
                <>
                    <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                        <AlertCircle size={18} style={{ color: 'var(--accent-orange)' }} /> Expired / Needs Renewal
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-lg)' }}>
                        {expired.map(ag => <AgreementCard key={ag.id} agreement={ag} expired onEdit={() => { setEditAgreement(ag); setShowForm(true); }} onDelete={() => handleDelete(ag.id)} />)}
                    </div>
                </>
            )}

            {filtered.length === 0 && <div className="empty-state"><Wrench size={32} /><p>No service agreements</p></div>}

            {showForm && (
                <AgreementFormModal
                    agreement={editAgreement}
                    customers={customers}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditAgreement(null); }}
                />
            )}
        </div>
    );
}

function AgreementCard({ agreement: ag, expired, onEdit, onDelete }) {
    const daysLeft = differenceInDays(new Date(ag.end_date), new Date());
    const visitProgress = ag.visits_total > 0 ? (ag.visits_used / ag.visits_total) * 100 : 0;

    return (
        <div className="card" style={{ borderLeft: `3px solid ${expired ? 'var(--accent-orange)' : 'var(--accent-green)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                <strong>{ag.customers?.name}</strong>
                <span className={`badge ${expired ? 'badge-orange' : daysLeft < 30 ? 'badge-orange' : 'badge-green'}`}>
                    {expired ? 'Expired' : daysLeft < 30 ? `${daysLeft}d left` : 'Active'}
                </span>
            </div>

            <span className="badge badge-purple" style={{ marginBottom: 'var(--space-md)' }}>
                {ag.plan_type?.replace('_', ' ')}
            </span>

            <div className="detail-row"><span className="label">Period</span><span className="value">{ag.start_date ? format(new Date(ag.start_date), 'MMM d, yyyy') : '—'} – {ag.end_date ? format(new Date(ag.end_date), 'MMM d, yyyy') : '—'}</span></div>

            <div style={{ marginTop: 'var(--space-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    <span>Visits Used</span>
                    <span>{ag.visits_used || 0} / {ag.visits_total || 0}</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${visitProgress}%`, background: visitProgress >= 100 ? 'var(--accent-orange)' : 'var(--accent-green)', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-lg)' }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={onEdit}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
            </div>
        </div>
    );
}

function AgreementFormModal({ agreement, customers, onSave, onClose }) {
    const [form, setForm] = useState({
        customer_id: agreement?.customer_id || '',
        plan_type: agreement?.plan_type || 'seasonal_tuneup',
        start_date: agreement?.start_date || '',
        end_date: agreement?.end_date || '',
        visits_total: agreement?.visits_total || 2,
        visits_used: agreement?.visits_used || 0,
        notes: agreement?.notes || '',
    });
    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{agreement ? 'Edit Agreement' : 'New Service Agreement'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
                    <div className="form-group">
                        <label className="form-label">Customer *</label>
                        <select className="form-select" name="customer_id" value={form.customer_id} onChange={handleChange} required>
                            <option value="">Select...</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Plan Type</label>
                        <select className="form-select" name="plan_type" value={form.plan_type} onChange={handleChange}>
                            {PLAN_TYPES.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" name="start_date" type="date" value={form.start_date} onChange={handleChange} /></div>
                        <div className="form-group"><label className="form-label">End Date</label><input className="form-input" name="end_date" type="date" value={form.end_date} onChange={handleChange} /></div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Total Visits</label><input className="form-input" name="visits_total" type="number" value={form.visits_total} onChange={handleChange} min={1} /></div>
                        <div className="form-group"><label className="form-label">Visits Used</label><input className="form-input" name="visits_used" type="number" value={form.visits_used} onChange={handleChange} min={0} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange} rows={2} /></div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" type="submit">{agreement ? 'Update' : 'Create'} Agreement</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
