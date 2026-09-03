import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, Calendar as CalendarIcon, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, eachDayOfInterval, isSameMonth, isToday, addWeeks, subWeeks, isSameDay, addDays, subDays } from 'date-fns';
import { DndContext, useDraggable, useDroppable, DragOverlay, closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core';

const JOB_TYPES = ['install', 'repair', 'maintenance', 'emergency', 'inspection'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

export default function Schedule() {
    const { profile, isManager } = useAuth();
    const { success, error: showError } = useToast();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('day'); // Default to day view to show off tech grouping initially
    const [jobs, setJobs] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [technicians, setTechnicians] = useState([]);
    const [teamFilter, setTeamFilter] = useState('all');
    const [showJobForm, setShowJobForm] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeDragJob, setActiveDragJob] = useState(null);

    useEffect(() => { loadData(); }, []);

    async function loadData() {
        const [jobsRes, custRes, techRes] = await Promise.all([
            supabase.from('jobs').select('*, customers(name), technicians(name, team)'),
            supabase.from('customers').select('id, name'),
            supabase.from('technicians').select('id, name, team'),
        ]);
        setJobs(jobsRes.data || []);
        setCustomers(custRes.data || []);
        setTechnicians(techRes.data || []);
        setLoading(false);
    }

    async function handleSaveJob(jobData, createInvoice) {
        const insertData = { ...jobData };
        if (!insertData.technician_id) insertData.technician_id = null;

        if (selectedJob) {
            const { error } = await supabase.from('jobs').update(insertData).eq('id', selectedJob.id);
            if (error) { showError(error.message); return; }
            success('Job updated');
        } else {
            const { data, error } = await supabase.from('jobs').insert(insertData).select().single();
            if (error) { showError(error.message); return; }
            success('Job created');

            if (createInvoice) {
                const invoiceData = {
                    customer_id: jobData.customer_id,
                    job_id: data.id,
                    invoice_number: Date.now(),
                    status: 'draft',
                    notes: \Invoice for \ job.\
                };
                const { error: invErr } = await supabase.from('invoices').insert(invoiceData);
                if (invErr) showError('Job created, but invoice failed: ' + invErr.message);
                else success('Draft invoice generated');
            }
        }
        setShowJobForm(false);
        setSelectedJob(null);
        loadData();
    }

    async function handleDeleteJob(id) {
        if (!confirm('Delete this job?')) return;
        await supabase.from('jobs').delete().eq('id', id);
        success('Job deleted');
        loadData();
    }

    function navigatePrev() {
        if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
        else if (view === 'week') setCurrentDate(subWeeks(currentDate, 1));
        else setCurrentDate(subDays(currentDate, 1));
    }

    function navigateNext() {
        if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
        else if (view === 'week') setCurrentDate(addWeeks(currentDate, 1));
        else setCurrentDate(addDays(currentDate, 1));
    }

    function handleDayClick(date) {
        if (!isManager()) return;
        setSelectedDate(format(date, 'yyyy-MM-dd'));
        setSelectedJob(null);
        setShowJobForm(true);
    }

    function handleJobClick(job, e) {
        e.stopPropagation();
        setSelectedJob(job);
        setSelectedDate(job.scheduled_date);
        setShowJobForm(true);
    }

    async function handleDragEnd(event) {
        const { active, over } = event;
        setActiveDragJob(null);
        if (!over) return;

        const jobId = active.id.replace('job|', '');
        const targetId = over.id; // Either 'date|2023-10-01' or 'tech|tech_id'

        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        let updateData = {};

        if (targetId.startsWith('date|')) {
            const newDate = targetId.split('|')[1];
            if (job.scheduled_date === newDate) return;
            updateData.scheduled_date = newDate;
        } else if (targetId.startsWith('tech|')) {
            const newTechId = targetId.split('|')[1];
            const techValue = newTechId === 'unassigned' ? null : newTechId;
            if (job.technician_id === techValue) return;
            updateData.technician_id = techValue;
        }

        // Optimistic update
        setJobs(jobs.map(j => j.id === jobId ? { ...j, ...updateData } : j));

        const { error } = await supabase.from('jobs').update(updateData).eq('id', jobId);
        if (error) {
            showError('Failed to reschedule job: ' + error.message);
            loadData(); // Revert on failure
        } else {
            success(\Job \!\);
        }
    }

    const calendarDays = useMemo(() => {
        if (view === 'month') {
            const start = startOfWeek(startOfMonth(currentDate));
            const end = endOfWeek(endOfMonth(currentDate));
            return eachDayOfInterval({ start, end });
        } else if (view === 'week') {
            const start = startOfWeek(currentDate);
            const end = endOfWeek(currentDate);
            return eachDayOfInterval({ start, end });
        }
        return [currentDate];
    }, [currentDate, view]);

    const headerText = view === 'month' ? format(currentDate, 'MMMM yyyy') :
        view === 'week' ? \\ - \\ :
            format(currentDate, 'EEEE, MMMM d, yyyy');

    if (loading) return <div className="loading-page"><div className="loading-spinner" /></div>;

    const filteredTechs = teamFilter === 'all' ? technicians : technicians.filter(t => t.team === teamFilter);

    return (
        <DndContext onDragStart={(e) => setActiveDragJob(jobs.find(j => j.id === e.active.id.replace('job|', '')))} onDragEnd={handleDragEnd} collisionDetection={pointerWithin}>
            <div className="page-header">
                <div>
                    <h1>Schedule</h1>
                    <p>Manage jobs, assignments, and drag-and-drop to reschedule</p>
                </div>
                {isManager() && (
                    <button className="btn btn-primary" onClick={() => { setSelectedDate(format(new Date(), 'yyyy-MM-dd')); setSelectedJob(null); setShowJobForm(true); }}>
                        <Plus size={18} /> New Job
                    </button>
                )}
            </div>

            <div className="calendar-container">
                <div className="calendar-header">
                    <div className="calendar-nav">
                        <button className="btn btn-ghost btn-icon" onClick={navigatePrev}><ChevronLeft size={18} /></button>
                        <h3>{headerText}</h3>
                        <button className="btn btn-ghost btn-icon" onClick={navigateNext}><ChevronRight size={18} /></button>
                    </div>
                    <div className="filter-tabs" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        {view === 'day' && (
                            <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                                <button className={\ilter-tab \\} onClick={() => setTeamFilter('all')} style={{ padding: '4px 12px', fontSize: 'var(--font-sm)' }}>All Teams</button>
                                <button className={\ilter-tab \\} onClick={() => setTeamFilter('install')} style={{ padding: '4px 12px', fontSize: 'var(--font-sm)' }}>Install</button>
                                <button className={\ilter-tab \\} onClick={() => setTeamFilter('repair')} style={{ padding: '4px 12px', fontSize: 'var(--font-sm)' }}>Repair</button>
                            </div>
                        )}
                        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
                            {['month', 'week', 'day'].map(v => (
                                <button key={v} className={\ilter-tab \\} onClick={() => setView(v)} style={{ padding: '4px 12px', fontSize: 'var(--font-sm)' }}>
                                    {v.charAt(0).toUpperCase() + v.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {(view === 'month' || view === 'week') && (
                    <>
                        <div className="calendar-grid">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                <div key={d} className="calendar-day-header">{d}</div>
                            ))}
                        </div>
                        <div className="calendar-grid">
                            {calendarDays.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const dayJobs = jobs.filter(j => j.scheduled_date === dateStr);
                                return (
                                    <DroppableDay 
                                        key={dateStr} 
                                        date={day} 
                                        dateStr={dateStr} 
                                        isCurrentMonth={isSameMonth(day, currentDate)} 
                                        isToday={isToday(day)} 
                                        view={view}
                                        onClick={() => handleDayClick(day)}
                                    >
                                        {dayJobs.slice(0, view === 'week' ? 10 : 3).map(j => (
                                            <DraggableEvent key={j.id} job={j} onClick={(e) => handleJobClick(j, e)} />
                                        ))}
                                        {dayJobs.length > 3 && view === 'month' && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', paddingLeft: '6px' }}>+{dayJobs.length - 3} more</div>}
                                    </DroppableDay>
                                );
                            })}
                        </div>
                    </>
                )}

                {view === 'day' && (
                    <div className="tech-board-container" style={{ display: 'flex', gap: '16px', padding: '16px', overflowX: 'auto', minHeight: '600px', background: 'var(--bg-card)' }}>
                        <DroppableTechColumn techId="unassigned" techName="Unassigned" jobs={jobs.filter(j => j.scheduled_date === format(currentDate, 'yyyy-MM-dd') && !j.technician_id)} onClick={handleJobClick} />
                        {filteredTechs.map(tech => (
                            <DroppableTechColumn 
                                key={tech.id} 
                                techId={tech.id} 
                                techName={tech.name} 
                                jobs={jobs.filter(j => j.scheduled_date === format(currentDate, 'yyyy-MM-dd') && j.technician_id === tech.id)} 
                                onClick={handleJobClick}
                            />
                        ))}
                    </div>
                )}
            </div>

            <DragOverlay dropAnimation={null}>
                {activeDragJob ? (
                    view === 'day' ? (
                        <div className="board-card dragging-overlay" style={{ background: '#fff', border: '2px solid var(--primary)', borderRadius: '8px', padding: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.1)' }}>
                            <strong>{activeDragJob.customers?.name || 'Job'}</strong>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{activeDragJob.job_type}</div>
                        </div>
                    ) : (
                        <div className={\calendar-event \ dragging-overlay\} style={{ opacity: 0.9, boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
                            {activeDragJob.customers?.name || 'Job'}
                        </div>
                    )
                ) : null}
            </DragOverlay>

            {showJobForm && (
                <JobFormModal
                    job={selectedJob}
                    defaultDate={selectedDate}
                    customers={customers}
                    technicians={technicians}
                    onSave={handleSaveJob}
                    onDelete={selectedJob ? () => handleDeleteJob(selectedJob.id) : null}
                    onClose={() => { setShowJobForm(false); setSelectedJob(null); }}
                />
            )}
        </DndContext>
    );
}

// ------ DND Components ------

function DroppableDay({ date, dateStr, isCurrentMonth, isToday, view, onClick, children }) {
    const { isOver, setNodeRef } = useDroppable({ id: \date|\\ });
    
    return (
        <div
            ref={setNodeRef}
            className={\calendar-day \ \\}
            style={{ 
                backgroundColor: isOver ? 'var(--bg-input)' : '',
                border: isOver ? '1px dashed var(--primary)' : ''
            }}
            onClick={onClick}
        >
            <div className="day-number">{format(date, 'd')}</div>
            {children}
        </div>
    );
}

function DraggableEvent({ job, onClick }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: \job|\\ });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={\calendar-event \\}
            style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab' }}
            onClick={onClick}
            title={\\ - \\}
        >
            {job.scheduled_time && <span>{job.scheduled_time} </span>}
            {job.customers?.name || 'Job'}
        </div>
    );
}

function DroppableTechColumn({ techId, techName, jobs, onClick }) {
    const { isOver, setNodeRef } = useDroppable({ id: \	ech|\\ });

    return (
        <div 
            style={{ 
                background: isOver ? 'var(--bg-background)' : 'var(--bg-input)', 
                minWidth: '280px', 
                borderRadius: 'var(--radius-lg)', 
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                border: isOver ? '1px dashed var(--primary)' : '1px solid transparent',
                transition: 'all 0.2s ease'
            }}
        >
            <div style={{ fontWeight: 600, paddingBottom: '12px', borderBottom: '1px solid var(--border)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} color="var(--text-secondary)" />
                {techName}
                <span className="badge badge-gray" style={{ marginLeft: 'auto' }}>{jobs.length}</span>
            </div>
            <div ref={setNodeRef} style={{ flex: 1, minHeight: '100px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {jobs.map(j => (
                    <DraggableTechCard key={j.id} job={j} onClick={onClick} />
                ))}
            </div>
        </div>
    );
}

function DraggableTechCard({ job, onClick }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: \job|\\ });

    return (
        <div 
            ref={setNodeRef} 
            {...listeners} 
            {...attributes}
            className="board-card" 
            style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab', margin: 0 }}
            onClick={(e) => onClick(job, e)}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                <strong>{job.customers?.name || 'Customer'}</strong>
                <span className={\adge badge-\\}>{job.job_type}</span>
            </div>
            <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'flex', gap: '16px' }}>
                {job.scheduled_time && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {job.scheduled_time}</span>}
            </div>
            <div style={{ marginTop: '8px' }}>
                <span className={\adge badge-\ badge-dot\}>{job.status?.replace('_', ' ')}</span>
            </div>
        </div>
    );
}

// ------ Helpers & Modals (Same as before) ------

function JobFormModal({ job, defaultDate, customers, technicians, onSave, onDelete, onClose }) {
    const [form, setForm] = useState({
        customer_id: job?.customer_id || '',
        technician_id: job?.technician_id || '',
        job_type: job?.job_type || 'repair',
        priority: job?.priority || 'medium',
        status: job?.status || 'scheduled',
        scheduled_date: job?.scheduled_date || defaultDate || '',
        scheduled_time: job?.scheduled_time || '',
        estimated_duration: job?.estimated_duration || 60,
        notes: job?.notes || '',
    });
    const [createInvoice, setCreateInvoice] = useState(false);

    const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{job ? 'Edit Job' : 'New Job'}</h3>
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
                                {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Priority</label>
                            <select className="form-select" name="priority" value={form.priority} onChange={handleChange}>
                                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
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
                            <label className="form-label">Technician</label>
                            <select className="form-select" name="technician_id" value={form.technician_id} onChange={handleChange}>
                                <option value="">Unassigned</option>
                                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Duration (min)</label>
                            <input className="form-input" name="estimated_duration" type="number" value={form.estimated_duration} onChange={handleChange} min={15} step={15} />
                        </div>
                    </div>
                    {job && (
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                                {['scheduled', 'en_route', 'in_progress', 'completed', 'invoiced', 'cancelled'].map(s => (
                                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label">Notes</label>
                        <textarea className="form-textarea" name="notes" value={form.notes} onChange={handleChange} rows={3} />
                    </div>
                    {!job && (
                        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                            <input type="checkbox" id="createInvoice" checked={createInvoice} onChange={e => setCreateInvoice(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                            <label htmlFor="createInvoice" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>Generate a draft invoice for this job (Optional)</label>
                        </div>
                    )}
                    <div className="modal-footer">
                        {onDelete && <button className="btn btn-danger" type="button" onClick={onDelete} style={{ marginRight: 'auto' }}>Delete</button>}
                        <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" type="submit">{job ? 'Update' : 'Create'} Job</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function getJobBadge(type) {
    const m = { install: 'blue', repair: 'orange', maintenance: 'green', emergency: 'red', inspection: 'purple' };
    return m[type] || 'blue';
}

function getStatusBadge(status) {
    const m = { scheduled: 'blue', en_route: 'cyan', in_progress: 'orange', completed: 'green', invoiced: 'purple', cancelled: 'red' };
    return m[status] || 'blue';
}
