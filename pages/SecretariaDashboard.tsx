
import React, { useState, useEffect } from 'react';
import { User, AgendaItem } from '../types';
import { db } from '../services/db';
import { Calendar, Plus, Save, Clock, MapPin, LogOut } from 'lucide-react';

interface SecretariaDashboardProps {
    user: User;
    onLogout: () => void;
}

export const SecretariaDashboard: React.FC<SecretariaDashboardProps> = ({ user, onLogout }) => {
    // --- CALENDAR STATE ---
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);
    const [agenda, setAgenda] = useState<AgendaItem[]>([]);
    const [isAdding, setIsAdding] = useState(false);

    // New Item Form State
    const [newItem, setNewItem] = useState<Partial<AgendaItem>>({
        type: 'REUNION',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        status: 'PENDING'
    });

    // --- CALENDAR LOGIC ---
    const getCalendarDays = () => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const days = [];
        for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
        return days;
    };

    const navigateMonth = (direction: 'prev' | 'next') => {
        const newDate = new Date(selectedDate);
        newDate.setMonth(selectedDate.getMonth() + (direction === 'next' ? 1 : -1));
        setSelectedDate(newDate);
    };

    const getDayEvents = (date: Date) => {
        const dateStr = date.toISOString().split('T')[0];
        // Correct date string comparison fix for timezones 
        // In a real app we'd use date-fns or moment, here we rely on the string format stored in DB YYYY-MM-DD

        // Simple string match since DB dates are YYYY-MM-DD
        const userDateStr = date.toLocaleDateString("en-CA"); // YYYY-MM-DD standard
        return agenda.filter(item => item.startDate === userDateStr);
    };

    useEffect(() => {
        loadAgenda();
        const unsubscribe = db.subscribeToChanges(
            () => { },
            () => { },
            (payload) => {
                console.log("Agenda Realtime Update:", payload);
                loadAgenda(); // Reload on any change (simple sync)
            }
        );
        return () => unsubscribe();
    }, []);

    const loadAgenda = async () => {
        const items = await db.getAgenda();
        setAgenda(items);
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.title || !newItem.startDate || !newItem.startTime) return;

        try {
            await db.createAgendaItem({
                title: newItem.title!,
                description: newItem.description || '',
                startDate: newItem.startDate!,
                startTime: newItem.startTime!,
                type: newItem.type as any,
                status: 'PENDING',
                location: newItem.location,
                createdBy: user.username,
                isImportant: false,
                id: '',
            } as AgendaItem);

            setIsAdding(false);
            setNewItem({
                type: 'REUNION',
                startDate: new Date().toISOString().split('T')[0],
                startTime: '09:00',
                status: 'PENDING'
            });
            loadAgenda();
        } catch (error) {
            console.error(error);
            alert('Error al guardar compromiso');
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (confirm('¿Está segura que desea eliminar este compromiso?')) {
            // In a real app, DELETE endpoint. Here we'll just not show it or use a status
            // Since we don't have deleteAgendaItem in db.ts, let's assume update to 'CANCELLED' or just alert
            alert("Contacte a soporte para habilitar borrado físico, por ahora use rechazo/cancelación administrativa.");
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-emerald-900 text-white p-4 shadow-lg flex justify-between items-center z-10">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center font-bold text-xl">SE</div>
                    <div>
                        <h1 className="text-xl font-bold">Secretaria Ejecutiva</h1>
                        <p className="text-emerald-200 text-xs">Gestión de Agenda del Alcalde</p>
                    </div>
                </div>
                <button onClick={onLogout} className="flex items-center gap-2 text-emerald-200 hover:text-white transition-colors">
                    <LogOut size={18} /> Salir
                </button>
            </header>

            <main className="flex-1 p-6 flex flex-col md:flex-row gap-6 overflow-hidden max-h-[calc(100vh-80px)]">
                {/* LEFT: CALENDAR & MONTH VIEW */}
                <div className="flex-1 flex flex-col bg-white rounded-xl shadow-md border border-slate-300 overflow-hidden animate-slide-left hover:shadow-xl transition-shadow duration-300">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50 backdrop-blur-sm sticky top-0 z-10">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700"><Calendar size={20} /></div>
                            {selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={() => navigateMonth('prev')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">◀</button>
                            <button onClick={() => navigateMonth('next')} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">▶</button>
                        </div>
                    </div>

                    <div className="p-4 flex-1 overflow-auto custom-scrollbar">
                        <div className="grid grid-cols-7 text-center mb-3">
                            {['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'].map(d => <div key={d} className="text-[10px] font-bold text-slate-500 tracking-wider">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 auto-rows-fr gap-2 pb-2">
                            {getCalendarDays().map((d, i) => {
                                if (!d) return <div key={i} className="min-h-[100px] bg-slate-50/30 rounded-xl border border-dashed border-slate-300"></div>;

                                const dateStr = d.toLocaleDateString("en-CA");
                                const events = agenda.filter(a => a.startDate === dateStr);
                                const isToday = new Date().toDateString() === d.toDateString();
                                const isSelected = selectedDate.toDateString() === d.toDateString();

                                return (
                                    <div
                                        key={i}
                                        onClick={() => setSelectedDate(d)}
                                        className={`group min-h-[100px] border rounded-xl p-2 cursor-pointer transition-all flex flex-col gap-1 relative overflow-hidden transform hover:-translate-y-1 ${isSelected ? 'ring-2 ring-emerald-500 bg-emerald-50/30 border-emerald-300 shadow-md' : 'bg-white hover:bg-slate-50 hover:shadow-md border-slate-300'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isToday ? 'bg-emerald-600 text-white shadow-emerald-200 shadow-lg' : 'text-slate-600 group-hover:text-emerald-700 group-hover:bg-emerald-100'}`}>
                                                {d.getDate()}
                                            </span>
                                            {events.length > 0 && <span className="text-[10px] font-bold text-emerald-700 bg-emerald-200 px-1.5 rounded-full">{events.length}</span>}
                                        </div>

                                        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar mt-1 pr-1">
                                            {events.map(ev => (
                                                <div key={ev.id} className={`text-[10px] px-1.5 py-1 rounded-md truncate border-l-2 transition-transform hover:scale-[1.02] ${ev.status === 'ACCEPTED' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' :
                                                    ev.status === 'REJECTED' ? 'bg-red-50 border-red-500 text-red-900 opacity-60 line-through decoration-red-500' :
                                                        'bg-amber-50 border-amber-500 text-amber-900'
                                                    }`}>
                                                    {ev.time || ev.startTime} {ev.title}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT: SELECTED DAY AGENDA */}
                <div className="w-full md:w-96 flex flex-col gap-4 animate-slide-right" style={{ animationDelay: '0.1s' }}>
                    <div className="bg-white p-5 rounded-xl shadow-md border border-slate-300 flex-1 flex flex-col hover:shadow-xl transition-shadow duration-300">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Agenda del Día</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setNewItem({ ...newItem, startDate: selectedDate.toLocaleDateString("en-CA") });
                                    setIsAdding(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl shadow-lg shadow-emerald-200 transition-all hover:scale-105 active:scale-95" title="Agregar Compromiso"
                            >
                                <Plus size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 pb-2 stagger-children">
                            {getDayEvents(selectedDate).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-sm border-2 border-dashed border-slate-300 rounded-xl m-2">
                                    <div className="bg-slate-50 p-4 rounded-full mb-3 border border-slate-200">
                                        <Clock size={32} className="opacity-20" />
                                    </div>
                                    <p>No hay actividades programadas.</p>
                                    <button onClick={() => { setNewItem({ ...newItem, startDate: selectedDate.toLocaleDateString("en-CA") }); setIsAdding(true); }} className="text-emerald-600 font-bold mt-2 hover:underline">
                                        + Agregar primera actividad
                                    </button>
                                </div>
                            ) : (
                                getDayEvents(selectedDate)
                                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                                    .map(item => (
                                        <div
                                            key={item.id}
                                            onClick={() => setSelectedItem(item)}
                                            className={`group relative p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg hover:-translate-y-0.5 ${item.status === 'ACCEPTED' ? 'bg-gradient-to-r from-white to-emerald-50/30 border-emerald-300 hover:border-emerald-400' :
                                                item.status === 'REJECTED' ? 'bg-slate-50 border-slate-300 opacity-60 grayscale-[0.5]' :
                                                    'bg-gradient-to-r from-white to-amber-50/30 border-amber-300 hover:border-amber-400'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">{item.startTime}</span>
                                                <span className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${item.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                                    item.status === 'REJECTED' ? 'bg-slate-200 text-slate-700 border border-slate-300' :
                                                        'bg-amber-100 text-amber-800 border border-amber-200'
                                                    }`}>
                                                    {item.status === 'ACCEPTED' ? 'Confirmado' : item.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                                                </span>
                                            </div>
                                            <h4 className={`font-bold text-slate-800 leading-tight mb-2 ${item.status === 'REJECTED' ? 'line-through text-slate-600' : ''}`}>{item.title}</h4>
                                            <div className="flex flex-wrap gap-2 text-[10px] text-slate-600 font-medium uppercase">
                                                <span className="bg-white border text-center border-slate-300 px-2 py-1 rounded-md flex-1">{item.type}</span>
                                                {item.location && <span className="bg-white border border-slate-300 px-2 py-1 rounded-md flex-[2] truncate">📍 {item.location}</span>}
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>

                {/* MODAL: ADD COMPROMISO */}
                {isAdding && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <form onSubmit={handleSaveItem} className="bg-white p-6 rounded-xl shadow-xl border border-emerald-100 w-full max-w-lg animate-scale-in">
                            <div className="flex justify-between items-center mb-6 border-b pb-2">
                                <h3 className="font-bold text-xl text-slate-800">Registrar Actividad</h3>
                                <button type="button" onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Título</label>
                                    <input type="text" value={newItem.title || ''} onChange={e => setNewItem({ ...newItem, title: e.target.value })} className="w-full p-2.5 border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all" placeholder="Ej: Reunión con Gobernador" required />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                                    <select value={newItem.type} onChange={e => setNewItem({ ...newItem, type: e.target.value as any })} className="w-full p-2.5 border rounded-lg bg-slate-50 focus:bg-white outline-none">
                                        <option value="REUNION">Reunión</option>
                                        <option value="EVENTO">Evento Público</option>
                                        <option value="TRAMITE">Trámite Administrativo</option>
                                        <option value="VISITA">Visita de Campo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
                                <textarea value={newItem.description || ''} onChange={e => setNewItem({ ...newItem, description: e.target.value })} className="w-full p-3 border rounded-lg h-24 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none" placeholder="Detalles adicionales..." />
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-6">
                                <div><label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label><input type="date" value={newItem.startDate} onChange={e => setNewItem({ ...newItem, startDate: e.target.value })} className="w-full p-2 border rounded-lg text-sm" required /></div>
                                <div><label className="block text-xs font-medium text-slate-500 mb-1">Hora</label><input type="time" value={newItem.startTime} onChange={e => setNewItem({ ...newItem, startTime: e.target.value })} className="w-full p-2 border rounded-lg text-sm" required /></div>
                                <div><label className="block text-xs font-medium text-slate-500 mb-1">Lugar</label><input type="text" value={newItem.location || ''} onChange={e => setNewItem({ ...newItem, location: e.target.value })} className="w-full p-2 border rounded-lg text-sm" placeholder="Ubicación" /></div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 font-medium">Cancelar</button>
                                <button type="submit" className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-emerald-700 shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5">
                                    <Save size={18} /> Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* MODAL: VIEW DETAILS */}
                {selectedItem && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedItem(null)}>
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                            <div className={`p-4 ${selectedItem.status === 'ACCEPTED' ? 'bg-emerald-600' : selectedItem.status === 'REJECTED' ? 'bg-slate-600' : 'bg-amber-500'} text-white flex justify-between items-start`}>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{selectedItem.type}</span>
                                    <h3 className="text-lg font-bold leading-tight mt-1">{selectedItem.title}</h3>
                                </div>
                                <button onClick={() => setSelectedItem(null)} className="text-white/80 hover:text-white">✕</button>
                            </div>

                            <div className="p-6">
                                <div className="flex gap-4 mb-6 text-sm text-slate-600 border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                        <Clock size={16} className="text-emerald-600" />
                                        <span className="font-mono font-bold">{selectedItem.startTime}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 flex-1">
                                        <MapPin size={16} className="text-emerald-600" />
                                        <span className="truncate">{selectedItem.location || 'Sin ubicación'}</span>
                                    </div>
                                </div>

                                <div className="mb-6">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Detalles</h4>
                                    <p className="text-slate-700 text-sm leading-relaxed">{selectedItem.description || 'Sin descripción adicional.'}</p>
                                </div>

                                {selectedItem.status === 'REJECTED' && (
                                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-4">
                                        <h4 className="text-red-800 font-bold text-xs uppercase mb-1 flex items-center gap-2">⚠️ Motivo del Rechazo</h4>
                                        <p className="text-red-700 text-sm italic">
                                            "{selectedItem.rejectionReason || 'Sin motivo especificado'}"
                                        </p>
                                        <div className="mt-3 text-xs text-red-600/80 font-medium">
                                            Se sugiere reagendar verificando la disponibilidad en el calendario.
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={() => setSelectedItem(null)}
                                        className="text-slate-500 hover:text-slate-700 text-sm font-medium px-4 py-2"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};
