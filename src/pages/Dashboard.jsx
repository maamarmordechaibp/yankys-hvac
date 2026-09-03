import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    DollarSign, ClipboardList, AlertTriangle, Wrench,
    TrendingUp, TrendingDown, ArrowRight, Clock, User
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { format, isToday, parseISO } from 'date-fns';

export default function Dashboard() {
    const { profile, isManager } = useAuth();
    const [stats, setStats] = useState({ revenue: 0, activeJobs: 0, overdueInvoices: 0, upcomingMaintenance: 0 });
    const [todaysJobs, setTodaysJobs] = useState([]);
    const [revenueData, setRevenueData] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboard();
    }, []);

    async function loadDashboard() {
        try {
            const [jobsRes, invoicesRes, agreementsRes] = await Promise.all([
                supabase.from('jobs').select('*, customers(name), technicians(name)'),
                supabase.from('invoices').select('*'),
                supabase.from('service_agreements').select('*')
            ]);

            const jobs = jobsRes.data || [];
            const invoices = invoicesRes.data || [];
            const agreements = agreementsRes.data || [];

            const today = new Date().toISOString().split('T')[0];
            const todayJobs = jobs.filter(j => j.scheduled_date?.startsWith(today));
            setTodaysJobs(todayJobs);

            const paidInvoices = invoices.filter(i => i.status === 'paid');
            const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
            const activeJobs = jobs.filter(j => !['completed', 'cancelled'].includes(j.status)).length;
            const overdueInvoices = invoices.filter(i => i.status === 'overdue' || (i.status === 'sent' && i.due_date < today)).length;
            const upcomingMaintenance = agreements.filter(a => a.visits_used < a.visits_total).length;

            setStats({ revenue: totalRevenue, activeJobs, overdueInvoices, upcomingMaintenance });

            // Build monthly revenue data
            const months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const key = format(d, 'yyyy-MM');
                const monthRevenue = paidInvoices
                    .filter(inv => inv.paid_date?.startsWith(key))
                    .reduce((sum, inv) => sum + (inv.total || 0), 0);
                months.push({ month: format(d, 'MMM'), revenue: monthRevenue });
            }
            setRevenueData(months);

            // Recent activity from jobs
            const recent = jobs
                .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
                .slice(0, 8)
                .map(j => ({
                    id: j.id,
                    text: `${j.job_type} job for ${j.customers?.name || 'Customer'} — ${j.status}`,
                    time: j.updated_at || j.created_at,
                    color: j.status === 'completed' ? 'var(--accent-green)' : j.status === 'in_progress' ? 'var(--accent-blue)' : 'var(--accent-orange)'
                }));
            setRecentActivity(recent);
        } catch (err) {
            console.error('Dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div className="loading-page"><div className="loading-spinner" /><span>Loading dashboard...</span></div>;

    const kpis = [
        { label: 'Total Revenue', value: `$${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'green', change: '+12.5%', positive: true },
        { label: 'Active Jobs', value: stats.activeJobs, icon: ClipboardList, color: 'blue', change: `${todaysJobs.length} today`, positive: true },
        { label: 'Overdue Invoices', value: stats.overdueInvoices, icon: AlertTriangle, color: 'orange', change: 'Needs attention', positive: false },
        { label: 'Service Plans', value: stats.upcomingMaintenance, icon: Wrench, color: 'purple', change: 'Active plans', positive: true },
    ];

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p>Welcome back, {profile?.full_name || 'User'}</p>
                </div>
            </div>

            <div className="kpi-grid">
                {kpis.map(kpi => (
                    <div key={kpi.label} className={`kpi-card ${kpi.color}`}>
                        <div className={`kpi-icon ${kpi.color}`}>
                            <kpi.icon size={22} />
                        </div>
                        <div className="kpi-label">{kpi.label}</div>
                        <div className="kpi-value">{kpi.value}</div>
                        <div className={`kpi-change ${kpi.positive ? 'positive' : 'negative'}`}>
                            {kpi.positive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            {kpi.change}
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-grid">
                <div className="chart-card">
                    <div className="card-header">
                        <h3 className="card-title">Revenue Overview</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={revenueData}>
                            <defs>
                                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#2a3150" />
                            <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} tickFormatter={v => `$${v}`} />
                            <Tooltip
                                contentStyle={{ background: '#1a1f35', border: '1px solid #2a3150', borderRadius: '8px', color: '#f1f5f9' }}
                                formatter={v => [`$${v.toLocaleString()}`, 'Revenue']}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fill="url(#revenueGrad)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Today's Schedule</h3>
                    </div>
                    {todaysJobs.length === 0 ? (
                        <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                            <Clock size={32} />
                            <p>No jobs scheduled for today</p>
                        </div>
                    ) : (
                        <div className="activity-list">
                            {todaysJobs.map(job => (
                                <div key={job.id} className="activity-item">
                                    <div className="activity-dot" style={{ background: getJobColor(job.job_type) }} />
                                    <div className="activity-content">
                                        <p><strong>{job.customers?.name}</strong> — {job.job_type}</p>
                                        <time>{job.scheduled_time || 'TBD'} {job.technicians?.name ? `• ${job.technicians.name}` : ''}</time>
                                    </div>
                                    <span className={`badge badge-${getStatusBadge(job.status)} badge-dot`}>{job.status.replace('_', ' ')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
                <div className="card-header">
                    <h3 className="card-title">Recent Activity</h3>
                </div>
                <div className="activity-list">
                    {recentActivity.map(item => (
                        <div key={item.id} className="activity-item">
                            <div className="activity-dot" style={{ background: item.color }} />
                            <div className="activity-content">
                                <p>{item.text}</p>
                                <time>{item.time ? format(new Date(item.time), 'MMM d, h:mm a') : ''}</time>
                            </div>
                        </div>
                    ))}
                    {recentActivity.length === 0 && <div className="empty-state"><p>No recent activity</p></div>}
                </div>
            </div>
        </div>
    );
}

function getJobColor(type) {
    const colors = { install: '#3b82f6', repair: '#f59e0b', maintenance: '#10b981', emergency: '#ef4444', inspection: '#8b5cf6' };
    return colors[type] || '#64748b';
}

function getStatusBadge(status) {
    const map = { scheduled: 'blue', en_route: 'cyan', in_progress: 'orange', completed: 'green', invoiced: 'purple', cancelled: 'red' };
    return map[status] || 'blue';
}
