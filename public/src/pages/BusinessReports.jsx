import { useState, useEffect } from 'react';
import {
    FileText, Download, Calendar, DollarSign, Users, Package,
    ClipboardList, TrendingUp, Filter, RefreshCw, Eye, BarChart3
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import api from '../utils/api';
import logo from '../assets/logo.jpeg';
import { exportToExcel, exportMultipleSheets } from '../utils/excelExport';

export default function Reports() {
    const [reportType, setReportType] = useState('sales-summary');
    const [dateRange, setDateRange] = useState('this-month');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [filters, setFilters] = useState({
        status: 'all',
        client: 'all',
        category: 'all'
    });

    const reportTypes = [
        { value: 'sales-summary', label: 'Sales Summary', icon: DollarSign },
        { value: 'work-orders', label: 'Work Orders Report', icon: ClipboardList },
        { value: 'client-activity', label: 'Client Activity', icon: Users },
        { value: 'inventory', label: 'Inventory Report', icon: Package },
        { value: 'revenue', label: 'Revenue Trends', icon: TrendingUp },
        { value: 'services', label: 'Service Distribution', icon: PieChart },
        { value: 'employee-performance', label: 'Employee Performance', icon: BarChart3 },
        { value: 'invoice-aging', label: 'Invoice Aging', icon: FileText }
    ];

    const dateRanges = [
        { value: 'today', label: 'Today' },
        { value: 'yesterday', label: 'Yesterday' },
        { value: 'this-week', label: 'This Week' },
        { value: 'last-week', label: 'Last Week' },
        { value: 'this-month', label: 'This Month' },
        { value: 'last-month', label: 'Last Month' },
        { value: 'this-quarter', label: 'This Quarter' },
        { value: 'this-year', label: 'This Year' },
        { value: 'custom', label: 'Custom Range' }
    ];

    useEffect(() => {
        generateReport();
    }, [reportType, dateRange, customStartDate, customEndDate, filters]);

    const getDateRangeDates = () => {
        const now = new Date();
        let start, end;

        switch (dateRange) {
            case 'today':
                start = new Date(now.setHours(0, 0, 0, 0));
                end = new Date(now.setHours(23, 59, 59, 999));
                break;
            case 'yesterday':
                start = new Date(now.setDate(now.getDate() - 1));
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
                break;
            case 'this-week':
                start = new Date(now.setDate(now.getDate() - now.getDay()));
                start.setHours(0, 0, 0, 0);
                end = new Date();
                break;
            case 'last-week':
                start = new Date(now.setDate(now.getDate() - now.getDay() - 7));
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(end.getDate() + 6);
                end.setHours(23, 59, 59, 999);
                break;
            case 'this-month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date();
                break;
            case 'last-month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'this-quarter':
                const quarter = Math.floor(now.getMonth() / 3);
                start = new Date(now.getFullYear(), quarter * 3, 1);
                end = new Date();
                break;
            case 'this-year':
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date();
                break;
            case 'custom':
                start = customStartDate ? new Date(customStartDate) : new Date();
                end = customEndDate ? new Date(customEndDate) : new Date();
                break;
            default:
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date();
        }

        return { start, end };
    };

    const generateReport = async () => {
        setLoading(true);
        try {
            const { start, end } = getDateRangeDates();

            switch (reportType) {
                case 'sales-summary':
                    await generateSalesSummary(start, end);
                    break;
                case 'work-orders':
                    await generateWorkOrdersReport(start, end);
                    break;
                case 'client-activity':
                    await generateClientActivity(start, end);
                    break;
                case 'inventory':
                    await generateInventoryReport();
                    break;
                case 'revenue':
                    await generateRevenueAnalysis();
                    break;
                case 'services':
                    await generateServicesReport();
                    break;
                case 'employee-performance':
                    await generateEmployeePerformance(start, end);
                    break;
                case 'invoice-aging':
                    await generateInvoiceAging();
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.error('Error generating report:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateSalesSummary = async (start, end) => {
        const [invoices, workOrders] = await Promise.all([
            api.get('/invoices'),
            api.get('/work-orders')
        ]);

        const filteredInvoices = invoices.data.filter(inv => {
            const invDate = new Date(inv.createdAt || inv.issueDate);
            return invDate >= start && invDate <= end;
        });

        const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
        const totalPaid = filteredInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
        const totalOutstanding = filteredInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);

        const completedOrders = workOrders.data.filter(wo => wo.status === 'completed').length;
        const pendingOrders = workOrders.data.filter(wo => wo.status !== 'completed' && wo.status !== 'cancelled').length;

        setReportData({
            type: 'sales-summary',
            summary: {
                totalRevenue,
                totalPaid,
                totalOutstanding,
                invoiceCount: filteredInvoices.length,
                completedOrders,
                pendingOrders,
                averageInvoice: filteredInvoices.length > 0 ? totalRevenue / filteredInvoices.length : 0
            },
            details: filteredInvoices.map(inv => ({
                'Invoice #': inv.invoiceNumber || '',
                'Client': inv.clientName || '',
                'Date': new Date(inv.issueDate || inv.createdAt).toLocaleDateString(),
                'Status': inv.status || '',
                'Total': `$${(inv.total || 0).toFixed(2)}`,
                'Paid': `$${(inv.amountPaid || 0).toFixed(2)}`,
                'Balance': `$${(inv.balance || 0).toFixed(2)}`
            }))
        });
    };

    const generateWorkOrdersReport = async (start, end) => {
        const response = await api.get('/work-orders');
        const filtered = response.data.filter(wo => {
            const woDate = new Date(wo.createdAt);
            const matchesDate = woDate >= start && woDate <= end;
            const matchesStatus = filters.status === 'all' || wo.status === filters.status;
            return matchesDate && matchesStatus;
        });

        const byStatus = filtered.reduce((acc, wo) => {
            acc[wo.status] = (acc[wo.status] || 0) + 1;
            return acc;
        }, {});

        setReportData({
            type: 'work-orders',
            summary: {
                total: filtered.length,
                byStatus
            },
            details: filtered.map(wo => ({
                'Work Order #': wo.workOrderNumber || '',
                'Title': wo.title || '',
                'Client': wo.clientName || '',
                'Status': wo.status || '',
                'Scheduled': wo.scheduledDate ? new Date(wo.scheduledDate).toLocaleDateString() : '',
                'Amount': `$${(wo.totalAmount || 0).toFixed(2)}`,
                'Created': new Date(wo.createdAt).toLocaleDateString()
            }))
        });
    };

    const generateClientActivity = async (start, end) => {
        const [clients, workOrders, invoices] = await Promise.all([
            api.get('/customers'),
            api.get('/work-orders'),
            api.get('/invoices')
        ]);

        const clientStats = clients.data.map(client => {
            const clientOrders = workOrders.data.filter(wo => wo.customerId === client.id);
            const clientInvoices = invoices.data.filter(inv => inv.customerId === client.id);
            const totalSpent = clientInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);

            return {
                'Client Name': client.name || '',
                'Email': client.email || '',
                'Phone': client.phone || '',
                'Work Orders': clientOrders.length,
                'Total Invoices': clientInvoices.length,
                'Total Spent': `$${totalSpent.toFixed(2)}`,
                'Last Activity': client.updatedAt ? new Date(client.updatedAt).toLocaleDateString() : ''
            };
        });

        setReportData({
            type: 'client-activity',
            summary: {
                totalClients: clients.data.length,
                activeClients: clientStats.filter(c => c['Work Orders'] > 0).length
            },
            details: clientStats
        });
    };

    const generateInventoryReport = async () => {
        const response = await api.get('/materials');
        const materials = response.data;

        const lowStock = materials.filter(m => m.quantityInStock <= m.minStockLevel);
        const totalValue = materials.reduce((sum, m) => sum + (m.quantityInStock * m.costPrice), 0);

        setReportData({
            type: 'inventory',
            summary: {
                totalItems: materials.length,
                lowStockItems: lowStock.length,
                totalValue
            },
            details: materials.map(m => ({
                'Name': m.name || '',
                'SKU': m.sku || '',
                'Category': m.category || '',
                'In Stock': m.quantityInStock || 0,
                'Min Level': m.minStockLevel || 0,
                'Status': m.quantityInStock <= m.minStockLevel ? 'Low Stock' : 'OK',
                'Unit Cost': `$${(m.costPrice || 0).toFixed(2)}`,
                'Total Value': `$${((m.quantityInStock || 0) * (m.costPrice || 0)).toFixed(2)}`
            }))
        });
    };

    const generateRevenueAnalysis = async () => {
        const response = await api.get('/reports/revenue');
        const data = response.data;

        setReportData({
            type: 'revenue',
            chartData: data,
            summary: {
                totalRevenue: data.reduce((sum, m) => sum + m.total, 0),
                totalPaid: data.reduce((sum, m) => sum + m.paid, 0),
                totalPending: data.reduce((sum, m) => sum + m.pending, 0),
            }
        });
    };

    const generateServicesReport = async () => {
        const response = await api.get('/reports/services');
        const data = response.data;

        setReportData({
            type: 'services',
            chartData: data,
            summary: {
                totalServices: data.length,
                totalOrders: data.reduce((sum, s) => sum + s.count, 0)
            }
        });
    };

    const generateEmployeePerformance = async (start, end) => {
        const [employeesRes, schedules] = await Promise.all([
            api.get('/employees'),
            api.get('/scheduling')
        ]);

        const employeeList = employeesRes.data.items || employeesRes.data || [];
        const employeeStats = employeeList.map(emp => {
            const empSchedules = schedules.data.filter(s =>
                s.assignedCrew && s.assignedCrew.includes(emp.id)
            );
            const completed = empSchedules.filter(s => s.status === 'completed').length;

            return {
                'Employee': emp.name || '',
                'Role': emp.role || '',
                'Total Jobs': empSchedules.length,
                'Completed': completed,
                'Completion Rate': empSchedules.length > 0 ? `${((completed / empSchedules.length) * 100).toFixed(1)}%` : '0%',
                'Status': emp.status || ''
            };
        });

        setReportData({
            type: 'employee-performance',
            summary: {
                totalEmployees: employeeList.length,
                activeEmployees: employeeList.filter(e => e.status === 'active').length
            },
            details: employeeStats
        });
    };

    const generateInvoiceAging = async () => {
        const response = await api.get('/invoices');
        const unpaid = response.data.filter(inv => (inv.balance || 0) > 0);

        const aging = unpaid.map(inv => {
            const dueDate = new Date(inv.dueDate);
            const today = new Date();
            const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

            let agingBucket = 'Current';
            if (daysOverdue > 90) agingBucket = '90+ Days';
            else if (daysOverdue > 60) agingBucket = '60-90 Days';
            else if (daysOverdue > 30) agingBucket = '30-60 Days';
            else if (daysOverdue > 0) agingBucket = '1-30 Days';

            return {
                'Invoice #': inv.invoiceNumber || '',
                'Client': inv.clientName || '',
                'Due Date': new Date(inv.dueDate).toLocaleDateString(),
                'Days Overdue': daysOverdue > 0 ? daysOverdue : 0,
                'Aging': agingBucket,
                'Balance': `$${(inv.balance || 0).toFixed(2)}`
            };
        });

        setReportData({
            type: 'invoice-aging',
            summary: {
                totalOutstanding: unpaid.reduce((sum, inv) => sum + (inv.balance || 0), 0),
                overdueCount: aging.filter(a => a['Days Overdue'] > 0).length
            },
            details: aging
        });
    };

    const handleExport = () => {
        if (!reportData || !reportData.details) return;

        const selectedReport = reportTypes.find(r => r.value === reportType);
        const filename = `${selectedReport.label.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;

        exportToExcel(reportData.details, filename, selectedReport.label);
    };

    const renderSummaryCards = () => {
        if (!reportData || !reportData.summary) return null;

        const { summary } = reportData;

        switch (reportType) {
            case 'sales-summary':
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Total Revenue</p>
                            <h3 style={{ margin: 0, fontSize: '24px', color: '#10b981' }}>${summary.totalRevenue.toFixed(2)}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Total Paid</p>
                            <h3 style={{ margin: 0, fontSize: '24px', color: '#3b82f6' }}>${summary.totalPaid.toFixed(2)}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Outstanding</p>
                            <h3 style={{ margin: 0, fontSize: '24px', color: '#f59e0b' }}>${summary.totalOutstanding.toFixed(2)}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Invoices</p>
                            <h3 style={{ margin: 0, fontSize: '24px' }}>{summary.invoiceCount}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Completed Orders</p>
                            <h3 style={{ margin: 0, fontSize: '24px', color: '#10b981' }}>{summary.completedOrders}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Average Invoice</p>
                            <h3 style={{ margin: 0, fontSize: '24px' }}>${summary.averageInvoice.toFixed(2)}</h3>
                        </div>
                    </div>
                );
            case 'inventory':
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Total Items</p>
                            <h3 style={{ margin: 0, fontSize: '24px' }}>{summary.totalItems}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Low Stock Items</p>
                            <h3 style={{ margin: 0, fontSize: '24px', color: '#ef4444' }}>{summary.lowStockItems}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Total Value</p>
                            <h3 style={{ margin: 0, fontSize: '24px', color: '#10b981' }}>${summary.totalValue.toFixed(2)}</h3>
                        </div>
                    </div>
                );
            case 'revenue':
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Total Revenue (12m)</p>
                            <h3 style={{ margin: 0, fontSize: '24px', color: '#10b981' }}>${summary.totalRevenue.toFixed(2)}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Total Paid</p>
                            <h3 style={{ margin: 0, fontSize: '24px', color: '#3b82f6' }}>${summary.totalPaid.toFixed(2)}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Total Pending</p>
                            <h3 style={{ margin: 0, fontSize: '24px', color: '#f59e0b' }}>${summary.totalPending.toFixed(2)}</h3>
                        </div>
                    </div>
                );
            case 'services':
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Service Types</p>
                            <h3 style={{ margin: 0, fontSize: '24px' }}>{summary.totalServices}</h3>
                        </div>
                        <div className="card" style={{ padding: '16px' }}>
                            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px 0' }}>Total Work Orders</p>
                            <h3 style={{ margin: 0, fontSize: '24px' }}>{summary.totalOrders}</h3>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const renderDataTable = () => {
        if (!reportData) return null;

        if (reportType === 'revenue' && reportData.chartData) {
            return (
                <div className="card" style={{ padding: '24px', height: '400px' }}>
                    <h3 style={{ margin: '0 0 20px 0' }}>Revenue Trend (Paid vs Pending)</h3>
                    <ResponsiveContainer width="100%" height="90%">
                        <BarChart data={reportData.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                formatter={(value) => `$${value.toFixed(2)}`}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey="paid" name="Paid" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                            <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} stackId="a" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );
        }

        if (reportType === 'services' && reportData.chartData) {
            const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];
            return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <div className="card" style={{ padding: '24px', height: '400px' }}>
                        <h3 style={{ margin: '0 0 20px 0' }}>Service Distribution</h3>
                        <ResponsiveContainer width="100%" height="90%">
                            <PieChart>
                                <Pie
                                    data={reportData.chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="count"
                                    nameKey="name"
                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {reportData.chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="card" style={{ padding: '24px' }}>
                        <h3 style={{ margin: '0 0 20px 0' }}>Detailed Breakdown</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {reportData.chartData.map((s, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                                    <span style={{ color: '#4f46e5', fontWeight: 800 }}>{s.count} Orders</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )
        }

        if (!reportData.details || reportData.details.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px' }}>
                    <FileText size={48} color="#d1d5db" style={{ marginBottom: '16px' }} />
                    <h3>No data available</h3>
                    <p style={{ color: '#6b7280' }}>Try adjusting your filters or date range.</p>
                </div>
            );
        }

        const columns = Object.keys(reportData.details[0]);

        return (
            <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                {columns.map(col => (
                                    <th key={col} style={{
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: '#374151',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {reportData.details.map((row, idx) => (
                                <tr key={idx} style={{
                                    borderBottom: '1px solid #f3f4f6',
                                    transition: 'background 0.2s'
                                }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                >
                                    {columns.map(col => (
                                        <td key={col} style={{
                                            padding: '12px 16px',
                                            fontSize: '14px',
                                            color: '#6b7280',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {row[col]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ padding: '12px 16px', background: '#f9fafb', borderTop: '1px solid #e5e7eb', fontSize: '13px', color: '#6b7280' }}>
                    Showing {reportData.details.length} record{reportData.details.length !== 1 ? 's' : ''}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div className="container">
                    <div className="header-content">
                        <div className="dashboard-brand">
                            <img src={logo} alt="BOOTMARK Logo" className="brand-logo" />
                            <div className="brand-text">
                                <h1 className="brand-title">Business Reports</h1>
                            </div>
                        </div>
                        <div className="header-actions">
                            <button className="btn btn-secondary" onClick={generateReport} disabled={loading}>
                                <RefreshCw size={18} />
                                Refresh
                            </button>
                            <button className="btn btn-primary" onClick={handleExport} disabled={!reportData || !reportData.details}>
                                <Download size={18} />
                                Export Excel
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="container">
                {/* Report Controls */}
                <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                        {/* Report Type */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                <FileText size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                Report Type
                            </label>
                            <select
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                                className="form-control"
                            >
                                {reportTypes.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Date Range */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                <Calendar size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                Date Range
                            </label>
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="form-control"
                            >
                                {dateRanges.map(range => (
                                    <option key={range.value} value={range.value}>{range.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Custom Date Range */}
                        {dateRange === 'custom' && (
                            <>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="form-control"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="form-control"
                                    />
                                </div>
                            </>
                        )}

                        {/* Status Filter (for work orders) */}
                        {reportType === 'work-orders' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500' }}>
                                    <Filter size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                    Status Filter
                                </label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className="form-control"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="draft">Draft</option>
                                    <option value="scheduled">Scheduled</option>
                                    <option value="in-progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="invoiced">Invoiced</option>
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <RefreshCw size={48} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
                        <p style={{ marginTop: '16px', color: '#6b7280' }}>Generating report...</p>
                    </div>
                )}

                {/* Summary Cards */}
                {!loading && renderSummaryCards()}

                {/* Data Table */}
                {!loading && renderDataTable()}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
