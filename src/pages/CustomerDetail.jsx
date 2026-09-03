import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import {
    ArrowLeft, Phone, Mail, MapPin, Wrench, ClipboardList,
    FileText, Plus, Edit, Trash2, X, Calendar
} from 'lucide-react';
import { format } from 'date-fns';

export default function CustomerDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const [customer, setCustomer] = useState(null);
    const [equipment, setEquipment] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [tab, setTab] = useState('overview');
    const [showEquipForm, setShowEquipForm] = useState(false);
    const [showJobForm, setShowJobForm] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { load(); }, [id]);

    async function load() {
        const [custRes, equipRes, jobsRes, invRes, techRes] = await Promise.all([
            supabase.from('customers').select('*').eq('id', id).single(),
            supabase.from('equipment').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
            supabase.from('jobs').select('*, technicians(name)').eq('customer_id', id).order('scheduled_date', { ascending: false }),
            supabase.from('invoices').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
            supabase.from('technicians').select('id, name, team')
        ]);
        setCustomer(custRes.data);
        setEquipment(equipRes.data || []);
        setJobs(jobsRes.data || []);
        setInvoices(invRes.data || []);
        setTechnicians(techRes.data || []);
        setLoading(false);
    }

    async function saveEquipment(equip) {
        const { error } = await supabase.from('equipment').insert({ ...equip, customer_id: id });
        if (error) { showError(error.message); return; }
        success('Equipment added');
        setShowEquipForm(false);
        load();
    }

    async function deleteEquipment(eid) {
        if (!confirm('Delete this equipment?')) return;
        await supabase.from('equipment').delete().eq('id', eid);
        success('Equipment removed');
        load();
    }

    async function handleSaveJob(jobData, createInvoice) {
        // Force the customer_id to be the current customer
        const insertData = { ...jobData, customer_id: id };
        if (!insertData.technician_id) insertData.technician_id = null;

        const { data, error } = await supabase.from('jobs').insert(insertData).select().single();
        if (error) { showError(error.message); return; }
        success('Job created');

        if (createInvoice) {
            const invoiceData = {
                customer_id: id,
                job_id: data.id,
                invoice_number: Date.now(),
                status: 'draft',
                notes: `Invoice for ${jobData.job_type} job.`
            };
            await supabase.from('invoices').insert(invoiceData);
        }
        setShowJobForm(false);
        load();
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;
    if (!customer) return <div className="empty-state"><p>Customer not found</p></div>;

    return (
        <div>
            <button className="btn btn-ghost" onClick={() => navigate('/customers')} style={{ marginBottom: 'var(--space-lg)' }}>
                <ArrowLeft size={18} /> Back to Customers
            </button>

            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
                    <div className="user-avatar" style={{ width: 56, height: 56, fontSize: 'var(--font-xl)' }}>
                        {customer.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                        <h1>{customer.name}</h1>
                        <span className={`badge ${customer.customer_type === 'commercial' ? 'badge-purple' : 'badge-blue'}`}>
                            {customer.customer_type || 'residential'}
                        </span>
                    </div>
                </div>
            </div>

            <div className="tabs">
                {['overview', 'equipment', 'jobs', 'invoices'].map(t => (
                    <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <div className="detail-grid">
                    <div className="detail-section">
                        <h3><Phone size={16} /> Contact Info</h3>
                        <div className="detail-row"><span className="label">Phone</span><span className="value">{customer.phone || '—'}</span></div>
                        <div className="detail-row"><span className="label">Email</span><span className="value">{customer.email || '—'}</span></div>
                        <div className="detail-row"><span className="label">Address</span><span className="value">{customer.address || '—'}</span></div>
                        <div className="detail-row"><span className="label">City</span><span className="value">{customer.city || '—'}</span></div>
                        <div className="detail-row"><span className="label">State/ZIP</span><span className="value">{customer.state || ''} {customer.zip || ''}</span></div>
                    </div>
                    <div className="detail-section">
                        <h3><ClipboardList size={16} /> Summary</h3>
                        <div className="detail-row"><span className="label">Total Jobs</span><span className="value">{jobs.length}</span></div>
                        <div className="detail-row"><span className="label">Equipment</span><span className="value">{equipment.length} units</span></div>
                        <div className="detail-row"><span className="label">Invoices</span><span className="value">{invoices.length}</span></div>
                        <div className="detail-row"><span className="label">Total Billed</span><span className="value">${invoices.reduce((s, i) => s + (i.total || 0), 0).toLocaleString()}</span></div>
                        {customer.notes && (
                            <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                                <strong>Notes:</strong> {customer.notes}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'equipment' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-lg)' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowEquipForm(true)}><Plus size={16} /> Add Equipment</button>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Type</th><th>Make / Model</th><th>Serial #</th><th>Install Date</th><th>Warranty Ends</th><th></th></tr></thead>
                            <tbody>
                                {equipment.map(e => (
                                    <tr key={e.id}>
                                        <td><span className="badge badge-cyan">{e.equipment_type}</span></td>
                                        <td>{e.make} {e.model}</td>
                                        <td style={{ fontFamily: 'monospace' }}>{e.serial_number || '—'}</td>
                                        <td>{e.install_date ? format(new Date(e.install_date), 'MMM d, yyyy') : '—'}</td>
                                        <td>{e.warranty_end ? format(new Date(e.warranty_end), 'MMM d, yyyy') : '—'}</td>
                                        <td><button className="btn btn-ghost btn-icon btn-sm" onClick={() => deleteEquipment(e.id)}><Trash2 size={14} /></button></td>
                                    </tr>
                                ))}
                                {equipment.length === 0 && <tr><td colSpan={6}><div className="empty-state"><p>No equipment recorded</p></div></td></tr>}
                            </tbody>
                        </table>
                    </div>
                    {showEquipForm && <EquipmentFormModal onSave={saveEquipment} onClose={() => setShowEquipForm(false)} />}
                </div>
            )}

            {tab === 'jobs' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-lg)' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowJobForm(true)}><Plus size={16} /> New Job</button>
                    </div>
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Date</th><th>Type</th><th>Status</th><th>Technician</th><th>Notes</th></tr></thead>
                            <tbody>
                                {jobs.map(j => (
                                    <tr key={j.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/jobs`)}>
                                        <td>{j.scheduled_date ? format(new Date(j.scheduled_date), 'MMM d, yyyy') : '—'}</td>
                                        <td><span className={`badge badge-${j.job_type === 'emergency' ? 'red' : j.job_type === 'repair' ? 'orange' : j.job_type === 'maintenance' ? 'green' : 'blue'}`}>{j.job_type}</span></td>
                                        <td><span className={`badge badge-${getStatusColor(j.status)} badge-dot`}>{j.status?.replace('_', ' ')}</span></td>
                                        <td>{j.technicians?.name || '—'}</td>
                                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.notes || '—'}</td>
                                    </tr>
                                ))}
                                {jobs.length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>No jobs recorded</p></div></td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showJobForm && (
                <CustomerJobFormModal
                    customerName={customer.name}
                    technicians={technicians}
                    onSave={handleSaveJob}
                    onClose={() => setShowJobForm(false)}
                />
            )}

            {tab === 'invoices' && (
                <div className="table-container">
                    <table>
                        <thead><tr><th>Invoice #</th><th>Date</th><th>Amount</th><th>Status</th><th>Due Date</th></tr></thead>
                        <tbody>
                            {invoices.map(inv => (
                                <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/invoices`)}>
                                    <td style={{ fontFamily: 'monospace' }}>INV-{String(inv.invoice_number || inv.id).padStart(4, '0')}</td>
                                    <td>{inv.created_at ? format(new Date(inv.created_at), 'MMM d, yyyy') : '—'}</td>
                                    <td><strong>${(inv.total || 0).toLocaleString()}</strong></td>
                                    <td><span className={`badge badge-${inv.status === 'paid' ? 'green' : inv.status === 'overdue' ? 'red' : inv.status === 'sent' ? 'orange' : 'blue'} badge-dot`}>{inv.status}</span></td>
                                    <td>{inv.due_date ? format(new Date(inv.due_date), 'MMM d, yyyy') : '—'}</td>
                                </tr>
                            ))}
                            {invoices.length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>No invoices</p></div></td></tr>}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function getStatusColor(s) {
    const m = { scheduled: 'blue', en_route: 'cyan', in_progress: 'orange', completed: 'green', invoiced: 'purple', cancelled: 'red' };
    return m[s] || 'blue';
}

function EquipmentFormModal({ onSave, onClose }) {
    const [form, setForm] = useState({ equipment_type: 'ac', make: '', model: '', serial_number: '', install_date: '', warranty_end: '' });
    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Add Equipment</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); onSave(form); }}>
                    <div className="form-group">
                        <label className="form-label">Type</label>
                        <select className="form-select" name="equipment_type" value={form.equipment_type} onChange={handleChange}>
                            <option value="ac">Air Conditioner</option>
                            <option value="furnace">Furnace</option>
                            <option value="heat_pump">Heat Pump</option>
                            <option value="boiler">Boiler</option>
                            <option value="ductwork">Ductwork</option>
                            <option value="thermostat">Thermostat</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Make</label><input className="form-input" name="make" value={form.make} onChange={handleChange} /></div>
                        <div className="form-group"><label className="form-label">Model</label><input className="form-input" name="model" value={form.model} onChange={handleChange} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">Serial Number</label><input className="form-input" name="serial_number" value={form.serial_number} onChange={handleChange} /></div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Install Date</label><input className="form-input" name="install_date" type="date" value={form.install_date} onChange={handleChange} /></div>
                        <div className="form-group"><label className="form-label">Warranty End</label><input className="form-input" name="warranty_end" type="date" value={form.warranty_end} onChange={handleChange} /></div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" type="submit">Add Equipment</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function CustomerJobFormModal({ customerName, technicians, onSave, onClose }) {
    const [form, setForm] = useState({
        technician_id: '',
        job_type: 'repair',
        priority: 'medium',
        status: 'scheduled',
        scheduled_date: '',
        scheduled_time: '',
        estimated_duration: 60,
        notes: '',
    });
    const [createInvoice, setCreateInvoice] = useState(false);

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>New Job for {customerName}</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); onSave(form, createInvoice); }}>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Job Type</label>
                            <select className="form-select" name="job_type" value={form.job_type} onChange={handleChange}>
                                {['install', 'repair', 'maintenance', 'emergency', 'inspection'].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Priority</label>
                            <select className="form-select" name="priority" value={form.priority} onChange={handleChange}>
                                {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Date *</label>
                            <input className="form-input" name="scheduled_date" type="date" value={form.scheduled_date} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Time</label>
                            <input className="form-input" name="scheduled_time" type="time" value={form.scheduled_time} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Technician (Optional)</label>
                            <select className="form-select" name="technician_id" value={form.technician_id} onChange={handleChange}>
                                <option value="">Unassigned</option>
                                {technicians.map(t => <option key={t.id} value={t.id}>{t.name} ({t.team})</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Duration (min)</label>
                            <input className="form-input" name="estimated_duration" type="number" value={form.estimated_duration} onChange={handleChange} min={15} step={15} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange} rows={3} />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                        <input type="checkbox" id="createInvoice" checked={createInvoice} onChange={e => setCreateInvoice(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                        <label htmlFor="createInvoice" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>Generate an empty invoice for this job</label>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" type="submit">Create Job</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
