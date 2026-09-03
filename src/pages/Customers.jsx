import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Phone, Mail, MapPin, Building2, Home, X, MoreVertical, Edit, Trash2 } from 'lucide-react';

export default function Customers() {
    const { isManager } = useAuth();
    const { success, error: showError } = useToast();
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [editCustomer, setEditCustomer] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadCustomers(); }, []);

    async function loadCustomers() {
        const { data, error } = await supabase.from('customers').select('*, jobs(count)').order('name');
        if (!error) setCustomers(data || []);
        setLoading(false);
    }

    async function handleSave(customer) {
        if (editCustomer) {
            const { error } = await supabase.from('customers').update(customer).eq('id', editCustomer.id);
            if (error) { showError(error.message); return; }
            success('Customer updated');
        } else {
            const { error } = await supabase.from('customers').insert(customer);
            if (error) { showError(error.message); return; }
            success('Customer added');
        }
        setShowForm(false);
        setEditCustomer(null);
        loadCustomers();
    }

    async function handleDelete(id) {
        if (!confirm('Delete this customer?')) return;
        const { error } = await supabase.from('customers').delete().eq('id', id);
        if (error) { showError(error.message); return; }
        success('Customer deleted');
        loadCustomers();
    }

    const filtered = customers.filter(c => {
        const matchesSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.email?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search);
        const matchesFilter = filter === 'all' || c.customer_type === filter;
        return matchesSearch && matchesFilter;
    });

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Customers</h1>
                    <p>{customers.length} total customers</p>
                </div>
                {isManager() && (
                    <div className="page-actions">
                        <button className="btn btn-primary" onClick={() => { setEditCustomer(null); setShowForm(true); }}>
                            <Plus size={18} /> Add Customer
                        </button>
                    </div>
                )}
            </div>

            <div className="filter-bar">
                <div className="search-box">
                    <Search size={16} />
                    <input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="filter-tabs">
                    {['all', 'residential', 'commercial'].map(f => (
                        <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Customer</th>
                            <th>Contact</th>
                            <th>Address</th>
                            <th>Type</th>
                            <th>Jobs</th>
                            {isManager() && <th>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(c => (
                            <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/customers/${c.id}`)}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 'var(--font-xs)' }}>
                                            {c.name?.charAt(0)?.toUpperCase()}
                                        </div>
                                        <strong>{c.name}</strong>
                                    </div>
                                </td>
                                <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: 'var(--font-sm)' }}>
                                        {c.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {c.phone}</span>}
                                        {c.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}><Mail size={12} /> {c.email}</span>}
                                    </div>
                                </td>
                                <td><span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--font-sm)' }}><MapPin size={12} /> {c.address || '—'}</span></td>
                                <td>
                                    <span className={`badge ${c.customer_type === 'commercial' ? 'badge-purple' : 'badge-blue'}`}>
                                        {c.customer_type === 'commercial' ? <Building2 size={12} /> : <Home size={12} />}
                                        {c.customer_type || 'residential'}
                                    </span>
                                </td>
                                <td>{c.jobs?.[0]?.count || 0}</td>
                                {isManager() && (
                                    <td onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditCustomer(c); setShowForm(true); }}><Edit size={14} /></button>
                                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(c.id)}><Trash2 size={14} /></button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={6}><div className="empty-state"><p>No customers found</p></div></td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showForm && (
                <CustomerFormModal
                    customer={editCustomer}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditCustomer(null); }}
                />
            )}
        </div>
    );
}

function CustomerFormModal({ customer, onSave, onClose }) {
    const [form, setForm] = useState({
        name: customer?.name || '',
        email: customer?.email || '',
        phone: customer?.phone || '',
        address: customer?.address || '',
        city: customer?.city || '',
        state: customer?.state || '',
        zip: customer?.zip || '',
        customer_type: customer?.customer_type || 'residential',
        notes: customer?.notes || '',
    });

    function handleChange(e) { setForm(prev => ({ ...prev, [e.target.name]: e.target.value })); }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{customer ? 'Edit Customer' : 'Add Customer'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
                    <div className="form-group">
                        <label className="form-label">Name *</label>
                        <input className="form-input" name="name" value={form.name} onChange={handleChange} required />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" name="email" type="email" value={form.email} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-input" name="phone" value={form.phone} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Address</label>
                        <input className="form-input" name="address" value={form.address} onChange={handleChange} />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">City</label>
                            <input className="form-input" name="city" value={form.city} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">State</label>
                            <input className="form-input" name="state" value={form.state} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">ZIP Code</label>
                            <input className="form-input" name="zip" value={form.zip} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Type</label>
                            <select className="form-select" name="customer_type" value={form.customer_type} onChange={handleChange}>
                                <option value="residential">Residential</option>
                                <option value="commercial">Commercial</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange} rows={3} />
                    </div>

                    <div className="modal-footer">
                        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" type="submit">{customer ? 'Update' : 'Add'} Customer</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
