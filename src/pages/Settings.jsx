import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, X, Shield, Trash2, Edit } from 'lucide-react';

const ROLES = ['admin', 'office_manager', 'technician'];

export default function Settings() {
    const { profile } = useAuth();
    const { success, error: showError } = useToast();
    const [users, setUsers] = useState([]);
    const [pricebook, setPricebook] = useState([]);
    const [activeTab, setActiveTab] = useState('pricebook');
    const [showPricebookForm, setShowPricebookForm] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadUsers(); }, []);

    async function loadUsers() {
        const [usersRes, pbRes] = await Promise.all([
            supabase.from('profiles').select('*').order('created_at'),
            supabase.from('pricebook').select('*').order('category')
        ]);
        let pbData = pbRes.data || [];

        // Auto-seed pricebook if empty
        if (pbData.length === 0) {
            const seedData = [
                { category: 'Labor', item_name: 'Diagnostic / Service Call', description: 'Standard residential service call and diagnostic', price: 150 },
                { category: 'Labor', item_name: 'Emergency After-Hours Call', description: 'After-hours or weekend emergency dispatch', price: 250 },
                { category: 'Labor', item_name: 'Preventative Maintenance', description: 'Seasonal tune-up and inspection', price: 120 },
                { category: 'Labor', item_name: 'Hourly Labor - Lead Tech', description: 'Standard hourly labor rate', price: 125 },
                { category: 'Parts', item_name: 'Capacitor 45/5 uF', description: 'Dual run capacitor for condenser', price: 45 },
                { category: 'Parts', item_name: '30A 1-Pole Contactor', description: 'Replacement AC contactor', price: 35 },
                { category: 'Parts', item_name: 'Thermostat (Basic)', description: 'Standard non-programmable thermostat', price: 60 },
                { category: 'Parts', item_name: 'Thermostat (Smart)', description: 'WiFi enabled smart thermostat', price: 250 },
                { category: 'Parts', item_name: 'Furnace Control Board', description: 'OEM replacement control board', price: 180 },
                { category: 'Parts', item_name: 'Flame Sensor', description: 'Standard furnace flame sensor', price: 25 },
                { category: 'Parts', item_name: 'Ignitor', description: 'Hot surface ignitor', price: 45 },
                { category: 'Equipment', item_name: '3-Ton AC Condenser', description: '14 SEER Condensing Unit', price: 2200 },
                { category: 'Equipment', item_name: '80% Gas Furnace', description: '80k BTU Gas Furnace', price: 1400 },
                { category: 'Ducts', item_name: '6" Flex Duct (25ft)', description: 'Insulated R-6 flex ducting', price: 85 },
                { category: 'Refrigerant', item_name: 'R-410A Refrigerant (per lb)', description: 'System refrigerant recharge', price: 65 },
                { category: 'Refrigerant', item_name: 'R-22 Refrigerant (per lb)', description: 'Legacy system refrigerant recharge', price: 120 },
                { category: 'Refrigerant', item_name: 'Nitrogen Pressure Test', description: 'System leak test with nitrogen', price: 75 },
                { category: 'Fees', item_name: 'EPA Disposal Fee', description: 'Safe recovery and disposal of refrigerants', price: 40 },
                { category: 'Fees', item_name: 'City HVAC Permit', description: 'Standard mechanical permit fee', price: 150 },
                { category: 'Fees', item_name: 'Diagnostic Waiver', description: 'Diagnostic fee waived with repair', price: -150 }
            ];

            await supabase.from('pricebook').insert(seedData);

            // Re-fetch after seeding
            const newPbRes = await supabase.from('pricebook').select('*').order('category');
            pbData = newPbRes.data || [];
            success('Automatically seeded standard HVAC Pricebook items!');
        }

        setUsers(usersRes.data || []);
        setPricebook(pbData);
        setLoading(false);
    }

    async function handleSavePricebook(item) {
        if (editItem) {
            const { error } = await supabase.from('pricebook').update(item).eq('id', editItem.id);
            if (error) { showError(error.message); return; }
            success('Item updated');
        } else {
            const { error } = await supabase.from('pricebook').insert(item);
            if (error) { showError(error.message); return; }
            success('Item added to pricebook');
        }
        setShowPricebookForm(false);
        setEditItem(null);
        loadUsers();
    }

    async function deletePricebookItem(id) {
        if (!confirm('Delete this item from the pricebook?')) return;
        await supabase.from('pricebook').delete().eq('id', id);
        success('Item removed');
        loadUsers();
    }

    async function updateRole(userId, newRole) {
        const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
        if (error) { showError(error.message); return; }
        success('Role updated');
        loadUsers();
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Settings</h1>
                    <p>Manage system configuration and users</p>
                </div>
            </div>

            <div className="tabs">
                <button className={`tab ${activeTab === 'pricebook' ? 'active' : ''}`} onClick={() => setActiveTab('pricebook')}>Pricebook & Services</button>
                <button className={`tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>Users & Permissions</button>
            </div>

            {activeTab === 'users' && (
                <>
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Shield size={18} /> User Management</h3>
                        </div>

                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th></tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 'var(--font-xs)' }}>
                                                        {u.full_name?.charAt(0)?.toUpperCase() || '?'}
                                                    </div>
                                                    <strong>{u.full_name || 'Unnamed'}</strong>
                                                    {u.id === profile?.id && <span className="badge badge-blue">You</span>}
                                                </div>
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{u.email || '—'}</td>
                                            <td>
                                                <select
                                                    className="form-select"
                                                    value={u.role || 'technician'}
                                                    onChange={e => updateRole(u.id, e.target.value)}
                                                    disabled={u.id === profile?.id}
                                                    style={{ fontSize: 'var(--font-sm)', padding: '6px 12px', width: 'auto', minWidth: '160px' }}
                                                >
                                                    {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>
                                                {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && <tr><td colSpan={4}><div className="empty-state"><p>No users found</p></div></td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
                        <div className="card-header">
                            <h3 className="card-title">Role Permissions</h3>
                        </div>
                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead><tr><th>Feature</th><th>Admin</th><th>Office Manager</th><th>Technician</th></tr></thead>
                                <tbody>
                                    {[
                                        ['Full Dashboard', '✅', '✅', '❌'],
                                        ['Own Schedule', '✅', '✅', '✅'],
                                        ['Customer Management', '✅', '✅', 'View only'],
                                        ['Job Scheduling', '✅', '✅', 'View own'],
                                        ['Estimates & Invoices', '✅', '✅', '❌'],
                                        ['Technician Management', '✅', '❌', '❌'],
                                        ['User Management', '✅', '❌', '❌'],
                                        ['Update Job Status', '✅', '✅', 'Own jobs'],
                                    ].map(([feature, ...perms], i) => (
                                        <tr key={i}>
                                            <td><strong>{feature}</strong></td>
                                            {perms.map((p, j) => <td key={j} style={{ textAlign: 'center' }}>{p}</td>)}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'pricebook' && (
                <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h3 className="card-title">Pricebook Items</h3>
                        <button className="btn btn-primary btn-sm" onClick={() => { setEditItem(null); setShowPricebookForm(true); }}>
                            <Plus size={16} /> Add Item
                        </button>
                    </div>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead><tr><th>Category</th><th>Item</th><th>Description</th><th>Price</th><th></th></tr></thead>
                            <tbody>
                                {pricebook.map(pb => (
                                    <tr key={pb.id}>
                                        <td><span className="badge badge-blue">{pb.category}</span></td>
                                        <td><strong>{pb.item_name}</strong></td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{pb.description}</td>
                                        <td style={{ fontWeight: 600 }}>${Number(pb.price || 0).toFixed(2)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditItem(pb); setShowPricebookForm(true); }}><Edit size={14} /></button>
                                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => deletePricebookItem(pb.id)}><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {pricebook.length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>Pricebook is empty</p></div></td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showPricebookForm && (
                <PricebookFormModal
                    item={editItem}
                    onSave={handleSavePricebook}
                    onClose={() => { setShowPricebookForm(false); setEditItem(null); }}
                />
            )}
        </div>
    );
}

function PricebookFormModal({ item, onSave, onClose }) {
    const [form, setForm] = useState({
        category: item?.category || 'Labor',
        item_name: item?.item_name || '',
        description: item?.description || '',
        price: item?.price || 0
    });

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{item ? 'Edit Pricebook Item' : 'New Pricebook Item'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Category</label>
                            <select className="form-select" name="category" value={form.category} onChange={handleChange}>
                                <option value="Labor">Labor / Services</option>
                                <option value="Parts">Parts & Hardware</option>
                                <option value="Equipment">Major Equipment</option>
                                <option value="Ducts">Ductwork</option>
                                <option value="Refrigerant">Refrigerant</option>
                                <option value="Fees">Fees & Permits</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Base Price</label>
                            <input className="form-input" name="price" type="number" step="0.01" value={form.price} onChange={handleChange} required />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Item / Service Name</label>
                        <input className="form-input" name="item_name" value={form.item_name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description (Shows on invoice/proposal)</label>
                        <textarea className="form-textarea" name="description" value={form.description} onChange={handleChange} rows={2} />
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" type="submit">Save Item</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
