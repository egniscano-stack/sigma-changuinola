
import React, { useState, useEffect } from 'react';
import { User, Transaction, AgendaItem } from '../types';
import { db } from '../services/db';
import { Calendar, Users, BarChart3, CheckCircle, XCircle, RefreshCw, LogOut, Clock, MapPin, Menu, X } from 'lucide-react';

interface AlcaldeDashboardProps {
    user: User;
    onLogout: () => void;
    onCreateUser: (u: User) => Promise<void>;
}

export const AlcaldeDashboard: React.FC<AlcaldeDashboardProps> = ({ user, onLogout, onCreateUser }) => {
    const [activeTab, setActiveTab] = useState<'REPORTS' | 'SECRETARY' | 'AGENDA'>('REPORTS');
    const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });
    const [agenda, setAgenda] = useState<AgendaItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- CALENDAR STATE ---
    const [viewMode, setViewMode] = useState<'MONTH' | 'WEEK' | 'DAY'>('MONTH');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Secretary Form
    const [secName, setSecName] = useState('');
    const [secUser, setSecUser] = useState('');
    const [secPass, setSecPass] = useState('');

    useEffect(() => {
        loadData();
        const unsubscribe = db.subscribeToChanges(
            () => { }, // Taxpayers
            () => loadStats(), // Transactions
            () => loadAgenda() // Agenda
        );
        return () => unsubscribe();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        await Promise.all([loadStats(), loadAgenda()]);
        setIsLoading(false);
    };

    const loadStats = async () => {
        try {
            const txs = await db.getTransactions(); // In real app, use specific count query
            const now = new Date();
            const today = txs.filter(t => t.date === now.toISOString().split('T')[0]).reduce((acc, t) => acc + t.amount, 0);

            // Rough week calc
            const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
            const week = txs.filter(t => new Date(t.date) >= weekStart).reduce((acc, t) => acc + t.amount, 0);

            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const month = txs.filter(t => new Date(t.date) >= monthStart).reduce((acc, t) => acc + t.amount, 0);

            setStats({ today, week, month });
        } catch (e) {
            console.error("Error loading stats", e);
        }
    };

    const loadAgenda = async () => {
        try {
            const items = await db.getAgenda();
            setAgenda(items);
        } catch (e) {
            console.error(e);
        }
    };

    // --- CALENDAR HELPERS ---
    const navigateCalendar = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (viewMode === 'MONTH') {
            newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        } else if (viewMode === 'WEEK') {
            newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        } else {
            newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
        }
        setCurrentDate(newDate);
    };

    const getCalendarDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
        return days;
    };

    const getFilteredEvents = () => {
        return agenda.filter(item => {
            const itemDateStr = item.startDate; // YYYY-MM-DD
            if (viewMode === 'MONTH') {
                const itemDate = new Date(item.startDate + 'T00:00:00');
                return itemDate.getMonth() === currentDate.getMonth() && itemDate.getFullYear() === currentDate.getFullYear();
            } else if (viewMode === 'DAY') {
                return itemDateStr === currentDate.toISOString().split('T')[0];
            } else if (viewMode === 'WEEK') {
                const startOfWeek = new Date(currentDate);
                startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
                startOfWeek.setHours(0, 0, 0, 0);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);
                endOfWeek.setHours(23, 59, 59, 999);
                const d = new Date(item.startDate + 'T00:00:00');
                return d >= startOfWeek && d <= endOfWeek;
            }
            return false;
        });
    };

    const handleRejectClick = (item: AgendaItem) => {
        setSelectedItem(item);
        setIsRejecting(true);
        setRejectReason('');
    };

    const confirmRejection = async () => {
        if (!selectedItem) return;
        await handleAgendaAction(selectedItem, 'REJECTED', rejectReason);
        setIsRejecting(false);
        setSelectedItem(null);
    };

    const handleCreateSecretary = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Use PROP to ensure Parent App State updates
            await onCreateUser({
                name: secName,
                username: secUser,
                password: secPass,
                role: 'SECRETARIA'
            });
            alert('Secretaria creada exitosamente');
            setSecName('');
            setSecUser('');
            setSecPass('');
        } catch (error) {
            alert('Error al crear usuario');
        }
    };

    const handleAgendaAction = async (item: AgendaItem, status: 'ACCEPTED' | 'REJECTED', reason?: string) => {
        try {
            await db.updateAgendaItem({ ...item, status, rejectionReason: reason });
            loadAgenda();
            if (status === 'ACCEPTED') setSelectedItem(null);
        } catch (e) {
            alert("Error al actualizar estado");
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Header */}
            {/* Header */}
            <header className="bg-indigo-900 text-white p-4 shadow-lg flex justify-between items-center z-30 relative">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="lg:hidden p-1 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                    <div className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center font-bold text-xl">
                        AL
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Despacho del Alcalde</h1>
                        <p className="text-indigo-200 text-xs">Gestión Ejecutiva</p>
                    </div>
                </div>
                <button onClick={onLogout} className="flex items-center gap-2 text-indigo-200 hover:text-white transition-colors">
                    <LogOut size={18} /> <span className="hidden lg:inline">Salir</span>
                </button>
            </header>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Mobile Menu Backdrop */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Sidebar - Desktop & Mobile Slide-in */}
                <aside className={`
                    absolute lg:relative z-20 h-full w-64 bg-white shadow-md border-r border-slate-300 transition-transform duration-300 ease-in-out
                    ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                    <nav className="p-4 space-y-2">
                        <button
                            onClick={() => { setActiveTab('REPORTS'); setIsMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${activeTab === 'REPORTS' ? 'bg-indigo-50 text-indigo-700 font-medium border border-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <BarChart3 size={20} /> Reportes Financieros
                        </button>
                        <button
                            onClick={() => { setActiveTab('AGENDA'); setIsMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${activeTab === 'AGENDA' ? 'bg-indigo-50 text-indigo-700 font-medium border border-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Calendar size={20} /> Agenda Mensual
                        </button>
                        <button
                            onClick={() => { setActiveTab('SECRETARY'); setIsMobileMenuOpen(false); }}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${activeTab === 'SECRETARY' ? 'bg-indigo-50 text-indigo-700 font-medium border border-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            <Users size={20} /> Gestión de Personal
                        </button>
                    </nav>
                </aside>

                {/* Main Content */}
                <main className="flex-1 p-6 overflow-auto relative custom-scrollbar">
                    {activeTab === 'REPORTS' && (
                        <div className="space-y-6 animate-fade-in">
                            <h2 className="text-2xl font-bold text-slate-800 mb-4">Reporte de Recaudación</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-300 hover:shadow-lg transition-shadow duration-300">
                                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Hoy</p>
                                    <p className="text-3xl font-bold text-emerald-600 mt-2">${stats.today.toFixed(2)}</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-300 hover:shadow-lg transition-shadow duration-300">
                                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Esta Semana</p>
                                    <p className="text-3xl font-bold text-emerald-600 mt-2">${stats.week.toFixed(2)}</p>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-md border border-slate-300 hover:shadow-lg transition-shadow duration-300">
                                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Este Mes</p>
                                    <p className="text-3xl font-bold text-emerald-600 mt-2">${stats.month.toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-blue-800 text-sm flex items-center gap-2">
                                <div className="bg-blue-100 p-1 rounded-full"><BarChart3 size={14} /></div>Vista ejecutiva simplificada. Para detalles contables completos, contacte a Tesorería.
                            </div>
                        </div>
                    )}

                    {activeTab === 'SECRETARY' && (
                        <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-md border border-slate-300 animate-fade-in hover:shadow-xl transition-shadow duration-300">
                            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><Users size={20} /></div> Crear Usuario Secretaria
                            </h2>
                            <form onSubmit={handleCreateSecretary} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={secName}
                                        onChange={e => setSecName(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Usuario de Acceso</label>
                                    <input
                                        type="text"
                                        value={secUser}
                                        onChange={e => setSecUser(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña Temporal</label>
                                    <input
                                        type="password"
                                        value={secPass}
                                        onChange={e => setSecPass(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-slate-50 focus:bg-white"
                                        required
                                    />
                                </div>
                                <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg mt-2">
                                    Crear Credencial
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === 'AGENDA' && (
                        <div className="space-y-6 animate-fade-in h-full flex flex-col">
                            {/* Calendar Header */}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-md border border-slate-300 sticky top-0 z-20">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => navigateCalendar('prev')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><Clock className="rotate-180" size={20} /></button>
                                    <h2 className="text-2xl font-bold text-slate-800 w-64 text-center uppercase tracking-wide flex items-center justify-center gap-2">
                                        {viewMode === 'MONTH' && currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                        {viewMode === 'DAY' && currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                        {viewMode === 'WEEK' && `Semana del ${currentDate.getDate()}`}
                                    </h2>
                                    <button onClick={() => navigateCalendar('next')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><Clock size={20} /></button>
                                </div>
                                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    {(['MONTH', 'WEEK', 'DAY'] as const).map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => { setViewMode(mode); setCurrentDate(new Date()); }}
                                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === mode ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            {mode === 'MONTH' ? 'Mes' : mode === 'WEEK' ? 'Semana' : 'Día'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Calendar Body */}
                            <div className="flex-1 bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden min-h-[500px] animate-slide-left">
                                {viewMode === 'MONTH' && (
                                    <div className="h-full flex flex-col">
                                        <div className="grid grid-cols-7 bg-slate-50/80 border-b border-slate-200">
                                            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(d => (
                                                <div key={d} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{d}</div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-7 flex-1 auto-rows-fr">
                                            {getCalendarDays().map((date, i) => {
                                                if (!date) return <div key={i} className="bg-slate-50/30 border-b border-r border-slate-200" />;

                                                // Timezone safe string comp
                                                const dateStr = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
                                                const dayEvents = agenda.filter(a => a.startDate === dateStr);
                                                const isToday = new Date().toDateString() === date.toDateString();

                                                return (
                                                    <div
                                                        key={i}
                                                        onClick={() => { setCurrentDate(date); setViewMode('DAY'); }}
                                                        className={`border-b border-r border-slate-200 p-2 hover:bg-indigo-50/50 transition-colors cursor-pointer relative min-h-[80px] group ${isToday ? 'bg-indigo-50/20' : ''}`}
                                                    >
                                                        <span className={`text-sm font-bold block mb-1 w-6 h-6 flex items-center justify-center rounded-lg transition-all ${isToday ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-600 group-hover:text-indigo-600 group-hover:bg-indigo-100'}`}>
                                                            {date.getDate()}
                                                        </span>
                                                        <div className="space-y-1 custom-scrollbar overflow-y-auto max-h-[80px]">
                                                            {dayEvents.slice(0, 3).map(ev => (
                                                                <div
                                                                    key={ev.id}
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedItem(ev); }}
                                                                    className={`text-[9px] truncate px-1.5 py-1 rounded border-l-2 cursor-pointer hover:scale-[1.02] transition-transform ${ev.status === 'ACCEPTED' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' :
                                                                        ev.status === 'REJECTED' ? 'bg-red-50 border-red-500 text-red-800 decoration-line-through opacity-60' :
                                                                            'bg-amber-50 border-amber-400 text-amber-800'
                                                                        }`}
                                                                    title={ev.title}
                                                                >
                                                                    {ev.time || ev.startTime} {ev.title}
                                                                </div>
                                                            ))}
                                                            {dayEvents.length > 3 && (
                                                                <div className="text-[10px] text-slate-400 pl-1 font-medium group-hover:text-indigo-500 transition-colors">+{dayEvents.length - 3} más</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {(viewMode === 'WEEK' || viewMode === 'DAY') && (
                                    <div className="p-4 space-y-3 h-full overflow-auto custom-scrollbar stagger-children">
                                        {getFilteredEvents().length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                                <div className="bg-slate-50 p-6 rounded-full border border-slate-200 mb-4"><Calendar size={48} className="opacity-20" /></div>
                                                <p className="font-medium">No hay compromisos para este período.</p>
                                            </div>
                                        ) : (
                                            getFilteredEvents()
                                                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                                .map(item => (
                                                    <div key={item.id} className="group flex gap-4 p-4 border border-slate-200 rounded-xl hover:shadow-lg transition-all bg-white cursor-pointer hover:border-indigo-200" onClick={() => setSelectedItem(item)}>
                                                        <div className="flex flex-col items-center justify-center w-20 bg-slate-50 rounded-xl p-2 border border-slate-200 group-hover:border-indigo-200 group-hover:bg-indigo-50 transition-colors">
                                                            <span className="text-lg font-bold text-slate-700 group-hover:text-indigo-700">{item.startTime}</span>
                                                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{new Date(item.startDate + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <h3 className={`font-bold text-lg leading-tight mb-1 ${item.status === 'REJECTED' ? 'text-slate-400 line-through' : 'text-slate-800 group-hover:text-indigo-900'}`}>{item.title}</h3>
                                                                    <p className="text-sm text-slate-600 line-clamp-2">{item.description}</p>
                                                                </div>
                                                                <span className={`px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wider ${item.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                    item.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                                                                    }`}>
                                                                    {item.status === 'PENDING' ? 'Pendiente' : item.status === 'ACCEPTED' ? 'Confirmado' : 'Rechazado'}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-3 mt-3 text-xs text-slate-500 font-medium">
                                                                {item.location && <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100"><MapPin size={14} className="text-indigo-400" /> {item.location}</span>}
                                                                <span className="flex items-center gap-1 font-mono uppercase bg-slate-50 px-2 py-1 rounded border border-slate-100">{item.type}</span>
                                                            </div>
                                                        </div>
                                                        {item.status === 'PENDING' && (
                                                            <div className="flex flex-col justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleAgendaAction(item, 'ACCEPTED'); }}
                                                                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm hover:shadow-md" title="Aceptar"
                                                                >
                                                                    <CheckCircle size={20} />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleRejectClick(item); }}
                                                                    className="p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm hover:shadow-md" title="Rechazar"
                                                                >
                                                                    <XCircle size={20} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* DETAILS MODAL */}
                    {selectedItem && !isRejecting && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedItem(null)}>
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                                <div className={`p-6 ${selectedItem.status === 'ACCEPTED' ? 'bg-emerald-600' : selectedItem.status === 'REJECTED' ? 'bg-slate-600' : 'bg-amber-500'} text-white`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-white/80 text-xs font-bold tracking-wider uppercase">{selectedItem.type}</span>
                                            <h2 className="text-2xl font-bold mt-1">{selectedItem.title}</h2>
                                        </div>
                                        <button onClick={() => setSelectedItem(null)} className="text-white/80 hover:text-white transition-transform hover:rotate-90"><XCircle size={24} /></button>
                                    </div>
                                    <div className="mt-4 flex gap-4 text-sm font-medium text-white/90">
                                        <span className="flex items-center gap-1"><Calendar size={16} /> {selectedItem.startDate}</span>
                                        <span className="flex items-center gap-1"><Clock size={16} /> {selectedItem.startTime}</span>
                                    </div>
                                </div>
                                <div className="p-6">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Descripción del Compromiso</h3>
                                    <p className="text-slate-700 leading-relaxed mb-6 text-sm md:text-base">{selectedItem.description || 'Sin descripción adicional.'}</p>

                                    {selectedItem.location && (
                                        <div className="flex items-center gap-3 text-slate-600 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                            <MapPin size={20} className="text-indigo-500" />
                                            <span className="font-medium text-sm">{selectedItem.location}</span>
                                        </div>
                                    )}

                                    {selectedItem.status === 'REJECTED' && selectedItem.rejectionReason && (
                                        <div className="bg-red-50 border border-red-100 p-4 rounded-lg mb-6">
                                            <h4 className="text-red-800 font-bold text-sm mb-1 flex items-center gap-2"><XCircle size={14} /> Motivo de Rechazo:</h4>
                                            <p className="text-red-700 text-sm italic">"{selectedItem.rejectionReason}"</p>
                                        </div>
                                    )}

                                    {selectedItem.status === 'PENDING' && (
                                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                                            <button
                                                onClick={() => handleAgendaAction(selectedItem, 'ACCEPTED')}
                                                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 flex justify-center items-center gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5"
                                            >
                                                <CheckCircle size={18} /> Aceptar Asistencia
                                            </button>
                                            <button
                                                onClick={() => handleRejectClick(selectedItem)}
                                                className="flex-1 bg-white border-2 border-slate-200 text-slate-600 py-3 rounded-xl font-bold hover:border-red-500 hover:text-red-600 flex justify-center items-center gap-2 transition-all hover:bg-red-50"
                                            >
                                                <XCircle size={18} /> Rechazar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* REJECTION REASON MODAL */}
                    {isRejecting && selectedItem && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Rechazar Compromiso</h3>
                                <p className="text-slate-600 text-sm mb-4">Por favor indique el motivo del rechazo para informar a la secretaría.</p>
                                <textarea
                                    className="w-full border border-slate-300 rounded-lg p-3 h-32 focus:ring-2 focus:ring-indigo-500 outline-none resize-none mb-4 text-sm"
                                    placeholder="Ej: Conflicto de agenda con visita oficial..."
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={() => setIsRejecting(false)}
                                        className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium text-sm transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmRejection}
                                        disabled={!rejectReason.trim()}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-all shadow-md hover:shadow-lg"
                                    >
                                        Confirmar Rechazo
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};
