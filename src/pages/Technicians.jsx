import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { Plus, Search, X, Phone, Wrench, DollarSign, Calendar, Edit, Trash2, User } from 'lucide-react';

export default function Technicians() {
    const { success, error: showError } = useToast();
    const [technicians, setTechnicians] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editTech, setEditTech] = useState(null);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, []);

    async function load() {
        const { data } = await supabase.from('technicians').select('*, jobs(count)').order('name');
        setTechnicians(data || []);
        setLoading(false);
    }

    async function handleSave(tech) {
        if (editTech) {
            const { error } = await supabase.from('technicians').update(tech).eq('id', editTech.id);
            if (error) { showError(error.message); return; }
            success('Technician updated');
        } else {
            const { error } = await supabase.from('technicians').insert(tech);
            if (error) { showError(error.message); return; }
            success('Technician added');
        }
        setShowForm(false);
        setEditTech(null);
        load();
    }

    async function handleDelete(id) {
        if (!confirm('Delete this technician?')) return;
        await supabase.from('technicians').delete().eq('id', id);
        success('Technician removed');
        load();
    }

    const filtered = technicians.filter(t => !search || t.name?.toLowerCase().includes(search.toLowerCase()));

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Technicians</h1>
                    <p>{technicians.length} team members</p>
                </div>
                <button className="btn btn-primary" onClick={() => { setEditTech(null); setShowForm(true); }}>
                    <Plus size={18} /> Add Technician
                </button>
            </div>

            <div className="filter-bar">
                <div className="search-box">
                    <Search size={16} />
                    <input placeholder="Search technicians..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
                {filtered.map(tech => (
                    <div key={tech.id} className="card" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                            <div className="user-avatar" style={{ width: 48, height: 48, fontSize: 'var(--font-lg)', background: 'var(--gradient-blue)' }}>
                                {tech.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                                <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700 }}>{tech.name}</h3>
                                {tech.phone && <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {tech.phone}</p>}
                            </div>
                        </div>

                        <div className="detail-row">
                            <span className="label">Email</span>
                            <span className="value">{tech.email || '—'}</span>
                        </div>
                        <div className="detail-row">
                            <span className="label">Team</span>
                            <span className="badge badge-purple">{tech.team === 'install' ? 'Installation' : 'Repair'}</span>
                        </div>
                        <div className="detail-row">
                            <span className="label">Hourly Rate</span>
                            <span className="value">{tech.hourly_rate ? `$${tech.hourly_rate}/hr` : '—'}</span>
                        </div>
                        <div className="detail-row">
                            <span className="label">Skills</span>
                            <span className="value">{tech.skills || '—'}</span>
                        </div>
                        <div className="detail-row">
                            <span className="label">Total Jobs</span>
                            <span className="value">{tech.jobs?.[0]?.count || 0}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-lg)' }}>
                            <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setEditTech(tech); setShowForm(true); }}>
                                <Edit size={14} /> Edit
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tech.id)}>
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && <div className="empty-state" style={{ gridColumn: '1 / -1' }}><User size={32} /><p>No technicians found</p></div>}
            </div>

            {showForm && (
                <TechFormModal
                    tech={editTech}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditTech(null); }}
                />
            )}
        </div>
    );
}

function TechFormModal({ tech, onSave, onClose }) {
    const [form, setForm] = useState({
        name: tech?.name || '',
        team: tech?.team || 'repair',
        email: tech?.email || '',
        phone: tech?.phone || '',
        hourly_rate: tech?.hourly_rate || '',
        skills: tech?.skills || '',
        certifications: tech?.certifications || '',
    });
    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{tech ? 'Edit Technician' : 'Add Technician'}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Name *</label><input className="form-input" name="name" value={form.name} onChange={handleChange} required /></div>
                        <div className="form-group">
                            <label className="form-label">Team</label>
                            <select className="form-select" name="team" value={form.team} onChange={handleChange}>
                                <option value="install">Installation Team</option>
                                <option value="repair">Repair Team</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Email</label><input className="form-input" name="email" type="email" value={form.email} onChange={handleChange} /></div>
                        <div className="form-group"><label className="form-label">Phone</label><input className="form-input" name="phone" value={form.phone} onChange={handleChange} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">Hourly Rate ($)</label><input className="form-input" name="hourly_rate" type="number" value={form.hourly_rate} onChange={handleChange} min={0} step={0.5} /></div>
                    <div className="form-group"><label className="form-label">Skills</label><input className="form-input" name="skills" value={form.skills} onChange={handleChange} placeholder="e.g. AC repair, furnace install, ductwork" /></div>
                    <div className="form-group"><label className="form-label">Certifications</label><input className="form-input" name="certifications" value={form.certifications} onChange={handleChange} placeholder="e.g. EPA 608, NATE" /></div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" type="submit">{tech ? 'Update' : 'Add'} Technician</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
