import React from 'react';
import { LayoutDashboard, Users, Receipt, ScanLine, Settings, LogOut, FileText, X, AlertCircle, Banknote } from 'lucide-react';
import { UserRole } from '../types';

interface SidebarProps {
  currentPage: string;
  userRole: UserRole;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, userRole, onNavigate, onLogout, isOpen, onClose }) => {
  const allMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'AUDITOR'] },
    { id: 'taxpayers', label: 'Contribuyentes', icon: Users, roles: ['ADMIN', 'CAJERO', 'AUDITOR', 'REGISTRO'] },
    // Split into Caja and Cobros
    { id: 'caja', label: 'Caja', icon: Banknote, roles: ['ADMIN', 'CAJERO'] },
    { id: 'cobros', label: 'Gestión de Cobros', icon: AlertCircle, roles: ['ADMIN', 'CAJERO', 'AUDITOR'] },

    { id: 'scanner', label: 'Digitalizador IA', icon: ScanLine, roles: ['ADMIN'] },
    { id: 'reports', label: 'Reportes', icon: FileText, roles: ['ADMIN', 'AUDITOR'] },
    { id: 'settings', label: 'Administración', icon: Settings, roles: ['ADMIN'] },
  ];

  const allowedMenuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-30 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Content */}
      <div className={`
        fixed top-0 left-0 h-full w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-40
        transform transition-transform duration-300 ease-in-out
        md:translate-x-0 print:hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header Logo */}
        <div className="p-6 border-b border-slate-700 bg-slate-950 flex flex-col items-center text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white md:hidden p-1">
            <X size={24} />
          </button>

          <div className="mb-3 bg-white p-1 rounded-full ring-2 ring-emerald-500/50">
            <img
              src={`${import.meta.env.BASE_URL}sigma-logo-final.png`}
              alt="Logo"
              className="h-20 w-20 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">SIGMA</h1>
          <p className="text-xs font-bold text-emerald-500 tracking-[0.2em] -mt-1">CHANGUINOLA</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {allowedMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => { onNavigate(item.id); onClose(); }}
                    className={`w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                  >
                    <Icon size={20} className={`mr-3 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-emerald-400'}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950">
          <button
            onClick={onLogout}
            className="flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600/20 hover:border-red-600/50 transition-all w-full px-4 py-3 text-sm bg-slate-900 rounded-lg border border-slate-800 active:scale-95"
          >
            <LogOut size={18} className="mr-2" />
            <span>Cerrar Sesión</span>
          </button>
          <div className="mt-4 text-center">
            <p className="text-[10px] text-slate-600">v1.3.0 • {userRole === 'ADMIN' ? 'Administrador' : userRole === 'AUDITOR' ? 'Auditor' : userRole === 'REGISTRO' ? 'Oficial Registro' : 'Cajero'}</p>
          </div>
        </div>
      </div>
    </>
  );
};