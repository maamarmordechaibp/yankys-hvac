import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Search, Clock, User, AlertTriangle, Plus, X } from 'lucide-react';
import { format } from 'date-fns';

const STATUSES = ['all', 'scheduled', 'en_route', 'in_progress', 'completed', 'invoiced', 'cancelled'];

export default function Jobs() {
    const { profile, isManager } = useAuth();
    const { success, error: showError } = useToast();
    const [jobs, setJobs] = useState([]);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [viewMode, setViewMode] = useState('board');
    const [loading, setLoading] = useState(true);
    const [showJobForm, setShowJobForm] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [technicians, setTechnicians] = useState([]);

    useEffect(() => { loadJobs(); loadFormData(); }, []);

    async function loadFormData() {
        const [custRes, techRes] = await Promise.all([
            supabase.from('customers').select('id, name'),
            supabase.from('technicians').select('id, name, team')
        ]);
        setCustomers(custRes.data || []);
        setTechnicians(techRes.data || []);
    }

    async function loadJobs() {
        let query = supabase.from('jobs').select('*, customers(name, address), technicians(name)').order('scheduled_date', { ascending: false });
        if (profile?.role === 'technician' && profile?.technician_id) {
            query = query.eq('technician_id', profile.technician_id);
        }
        const { data, error } = await query;
        if (!error) setJobs(data || []);
        setLoading(false);
    }

    async function updateStatus(jobId, newStatus) {
        const { error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', jobId);
        if (error) { showError(error.message); return; }
        success(`Job marked as ${newStatus.replace('_', ' ')}`);

        if (newStatus === 'completed') {
            const { data: existingMap } = await supabase.from('invoices').select('id').eq('job_id', jobId).single();
            if (!existingMap) {
                const job = jobs.find(j => j.id === jobId);
                if (job) {
                    await supabase.from('invoices').insert({
                        customer_id: job.customer_id,
                        job_id: jobId,
                        invoice_number: Date.now(),
                        status: 'draft',
                        notes: `Auto-generated invoice for completed ${job.job_type || 'job'}.`
                    });
                    success('Draft invoice automatically generated');
                }
            }
        }
        loadJobs();
    }

    async function handleSaveJob(jobData, createInvoice) {
        const insertData = { ...jobData };
        if (!insertData.technician_id) insertData.technician_id = null;

        const { data, error } = await supabase.from('jobs').insert(insertData).select().single();
        if (error) { showError(error.message); return; }
        success('Job created');

        if (createInvoice) {
            const invoiceData = {
                customer_id: jobData.customer_id,
                job_id: data.id,
                invoice_number: Date.now(),
                status: 'draft',
                notes: `Invoice for ${jobData.job_type} job.`
            };
            await supabase.from('invoices').insert(invoiceData);
        }
        setShowJobForm(false);
        loadJobs();
    }

    const filtered = jobs.filter(j => {
        const matchSearch = !search || j.customers?.name?.toLowerCase().includes(search.toLowerCase()) || j.job_type?.includes(search.toLowerCase());
        const matchStatus = statusFilter === 'all' || j.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const statusGroups = ['scheduled', 'en_route', 'in_progress', 'completed'];
    const grouped = {};
    statusGroups.forEach(s => { grouped[s] = filtered.filter(j => j.status === s); });

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Jobs</h1>
                    <p>{jobs.length} total jobs</p>
                </div>
                <div className="filter-tabs" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                        <button className={`filter-tab ${viewMode === 'board' ? 'active' : ''}`} onClick={() => setViewMode('board')}>Board</button>
                        <button className={`filter-tab ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>List</button>
                    </div>
                    {isManager() && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowJobForm(true)}>
                            New Job
                        </button>
                    )}
                </div>
            </div>

            <div className="filter-bar">
                <div className="search-box">
                    <Search size={16} />
                    <input placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {viewMode === 'list' && (
                    <div className="filter-tabs">
                        {STATUSES.map(s => (
                            <button key={s} className={`filter-tab ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                                {s === 'all' ? 'All' : s.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {viewMode === 'board' ? (
                <div className="board-columns">
                    {statusGroups.map(status => (
                        <div key={status} className="board-column">
                            <div className="board-column-header">
                                <div className="board-column-title">
                                    <span className="activity-dot" style={{ background: getStatusColor(status), display: 'inline-block' }} />
                                    {status.replace('_', ' ')}
                                </div>
                                <span className="board-column-count">{grouped[status]?.length || 0}</span>
                            </div>
                            {(grouped[status] || []).map(job => (
                                <div key={job.id} className="board-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <strong style={{ fontSize: 'var(--font-sm)' }}>{job.customers?.name || 'Customer'}</strong>
                                        <span className={`badge badge-${getJobBadge(job.job_type)}`}>{job.job_type}</span>
                                    </div>
                                    {job.priority === 'urgent' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-red)', fontSize: 'var(--font-xs)', marginBottom: '6px' }}>
                                            <AlertTriangle size={12} /> Urgent
                                        </div>
                                    )}
                                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {job.scheduled_date && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={11} /> {format(new Date(job.scheduled_date), 'MMM d')} {job.scheduled_time || ''}</span>}
                                        {job.technicians?.name && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={11} /> {job.technicians.name}</span>}
                                    </div>
                                    {isManager() && status !== 'completed' && (
                                        <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-secondary)', paddingTop: '8px' }}>
                                            <select
                                                className="form-select"
                                                value={job.status}
                                                onChange={e => updateStatus(job.id, e.target.value)}
                                                style={{ fontSize: 'var(--font-xs)', padding: '4px 8px' }}
                                            >
                                                {['scheduled', 'en_route', 'in_progress', 'completed', 'cancelled'].map(s => (
                                                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {(!grouped[status] || grouped[status].length === 0) && (
                                <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--text-tertiary)', fontSize: 'var(--font-sm)' }}>No jobs</div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead><tr><th>Customer</th><th>Type</th><th>Date</th><th>Technician</th><th>Priority</th><th>Status</th></tr></thead>
                        <tbody>
                            {filtered.map(j => (
                                <tr key={j.id}>
                                    <td><strong>{j.customers?.name || '—'}</strong></td>
                                    <td><span className={`badge badge-${getJobBadge(j.job_type)}`}>{j.job_type}</span></td>
                                    <td>{j.scheduled_date ? format(new Date(j.scheduled_date), 'MMM d, yyyy') : '—'} {j.scheduled_time || ''}</td>
                                    <td>{j.technicians?.name || '—'}</td>
                                    <td><span className={`badge badge-${j.priority === 'urgent' ? 'red' : j.priority === 'high' ? 'orange' : 'blue'}`}>{j.priority}</span></td>
                                    <td>
                                        {isManager() ? (
                                            <select className="form-select" value={j.status} onChange={e => updateStatus(j.id, e.target.value)} style={{ fontSize: 'var(--font-xs)', padding: '4px 8px', minWidth: '120px' }}>
                                                {['scheduled', 'en_route', 'in_progress', 'completed', 'invoiced', 'cancelled'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                                            </select>
                                        ) : (
                                            <span className={`badge badge-${getStatusBadgeColor(j.status)} badge-dot`}>{j.status?.replace('_', ' ')}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && <tr><td colSpan={6}><div className="empty-state"><p>No jobs found</p></div></td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {showJobForm && (
                <JobFormModal
                    customers={customers}
                    technicians={technicians}
                    onSave={handleSaveJob}
                    onClose={() => setShowJobForm(false)}
                />
            )}
        </div>
    );
}

function JobFormModal({ customers, technicians, onSave, onClose }) {
    const [form, setForm] = useState({
        customer_id: '',
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
                    <h3>New Job</h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); onSave(form, createInvoice); }}>
                    <div className="form-group">
                        <label className="form-label">Customer *</label>
                        <select className="form-select" name="customer_id" value={form.customer_id} onChange={handleChange} required>
                            <option value="">Select customer...</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
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
                        <label htmlFor="createInvoice" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>Generate an empty invoice for this job (Optional)</label>
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

function getStatusColor(s) {
    const m = { scheduled: '#3b82f6', en_route: '#06b6d4', in_progress: '#f59e0b', completed: '#10b981', invoiced: '#8b5cf6', cancelled: '#ef4444' };
    return m[s] || '#64748b';
}

function getJobBadge(t) {
    const m = { install: 'blue', repair: 'orange', maintenance: 'green', emergency: 'red', inspection: 'purple' };
    return m[t] || 'blue';
}

function getStatusBadgeColor(s) {
    const m = { scheduled: 'blue', en_route: 'cyan', in_progress: 'orange', completed: 'green', invoiced: 'purple', cancelled: 'red' };
    return m[s] || 'blue';
}
