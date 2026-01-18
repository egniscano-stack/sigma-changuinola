import React, { useState } from 'react';
import { Taxpayer, TaxpayerType, CommercialCategory, Transaction, VehicleInfo, TaxpayerStatus, UserRole } from '../types';
import { Search, UserPlus, Briefcase, User, MapPin, Store, History, X, FileText, Car, Hammer, Trash2, CheckSquare, Plus, AlertCircle, MoreVertical, ShieldAlert, Ban, CheckCircle } from 'lucide-react';

interface TaxpayersProps {
  taxpayers: Taxpayer[];
  transactions: Transaction[]; // Receive transactions to filter history
  onAdd: (tp: Taxpayer) => void;
  onUpdate: (tp: Taxpayer) => void; // New prop
  onDelete: (id: string) => void; // New prop
  userRole: UserRole;
}

export const Taxpayers: React.FC<TaxpayersProps> = ({ taxpayers, transactions, onAdd, onUpdate, onDelete, userRole }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null); // State for dropdown menu

  // History Modal State
  const [historyTaxpayer, setHistoryTaxpayer] = useState<Taxpayer | null>(null);

  // --- New Taxpayer Form State ---
  // Initial empty state
  const initialFormState: Partial<Taxpayer> = {
    type: TaxpayerType.NATURAL,
    status: TaxpayerStatus.ACTIVO,
    name: '',
    docId: '',
    address: '',
    phone: '',
    email: '',
    hasCommercialActivity: false,
    commercialCategory: CommercialCategory.NONE,
    commercialName: '',
    hasConstruction: false,
    hasGarbageService: true, // Default true usually
    vehicles: []
  };

  const [newTp, setNewTp] = useState<Partial<Taxpayer>>(initialFormState);

  // Temporary state for adding a vehicle inside the modal
  const [tempVehicle, setTempVehicle] = useState<Partial<VehicleInfo>>({
    plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false
  });
  const [showVehicleForm, setShowVehicleForm] = useState(false);

  const filtered = taxpayers.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.docId.includes(searchTerm) ||
    t.taxpayerNumber?.includes(searchTerm) // Search by Taxpayer Number
  );

  const handleAddVehicle = () => {
    if (!tempVehicle.plate || !tempVehicle.brand) {
      alert("Placa y Marca son obligatorios");
      return;
    }
    const vehicle: VehicleInfo = {
      plate: tempVehicle.plate!,
      brand: tempVehicle.brand!,
      model: tempVehicle.model || '',
      year: tempVehicle.year || '',
      color: tempVehicle.color || '',
      motorSerial: tempVehicle.motorSerial || '',
      chassisSerial: tempVehicle.chassisSerial || '',
      hasTransferDocuments: tempVehicle.hasTransferDocuments || false
    };

    setNewTp({
      ...newTp,
      vehicles: [...(newTp.vehicles || []), vehicle]
    });

    // Reset vehicle form
    setTempVehicle({ plate: '', brand: '', model: '', year: '', color: '', motorSerial: '', chassisSerial: '', hasTransferDocuments: false });
    setShowVehicleForm(false);
  };

  const removeVehicle = (plate: string) => {
    setNewTp({
      ...newTp,
      vehicles: newTp.vehicles?.filter(v => v.plate !== plate)
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      ...newTp,
      id: Date.now().toString(),
      // Simple Auto-Generation Logic: Year + Random 4 digits
      taxpayerNumber: `${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      createdAt: new Date().toISOString().split('T')[0]
    } as Taxpayer);

    setShowModal(false);
    setNewTp(initialFormState);
  };

  const getCategoryLabel = (cat?: CommercialCategory) => {
    switch (cat) {
      case CommercialCategory.CLASE_A: return 'Clase A (Alto)';
      case CommercialCategory.CLASE_B: return 'Clase B (Medio)';
      case CommercialCategory.CLASE_C: return 'Clase C (Bajo)';
      default: return 'N/A';
    }
  };

  const handleStatusChange = (tp: Taxpayer, newStatus: TaxpayerStatus) => {
    onUpdate({ ...tp, status: newStatus });
    setOpenActionMenuId(null);
  };

  const getStatusColor = (status: TaxpayerStatus) => {
    switch (status) {
      case TaxpayerStatus.ACTIVO: return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case TaxpayerStatus.SUSPENDIDO: return 'bg-amber-100 text-amber-800 border-amber-200';
      case TaxpayerStatus.BLOQUEADO: return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Filter history for selected taxpayer
  const taxpayerHistory = historyTaxpayer
    ? transactions.filter(t => t.taxpayerId === historyTaxpayer.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const totalPaidHistory = taxpayerHistory.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Directorio de Contribuyentes</h2>
        <button
          onClick={() => { setNewTp(initialFormState); setShowModal(true); }}
          className="w-full sm:w-auto bg-emerald-600 text-white px-4 py-3 rounded-lg flex items-center justify-center hover:bg-emerald-700 shadow-sm transition-transform active:scale-95 font-medium"
        >
          <UserPlus size={18} className="mr-2" />
          Nuevo Registro
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por Nombre, RUC, Cédula o N° Contribuyente..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-black placeholder-slate-400 text-sm md:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* List - Responsive Table Container */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[800px] md:min-w-full">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 md:px-6 py-3 font-semibold">N° Contribuyente</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Contribuyente</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Identificación</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Servicios Activos</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Tipo</th>
                <th className="px-4 md:px-6 py-3 font-semibold">Estado</th>
                <th className="px-4 md:px-6 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((tp) => (
                <tr key={tp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 md:px-6 py-4">
                    <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs md:text-sm">
                      {tp.taxpayerNumber || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <div className="font-bold text-slate-800 text-sm md:text-base">{tp.name}</div>
                    {tp.commercialName && <div className="text-xs text-indigo-600 font-medium">{tp.commercialName}</div>}
                    <div className="text-xs text-slate-500 flex items-center mt-1 truncate max-w-[200px]">
                      <MapPin size={10} className="mr-1 flex-shrink-0" /> {tp.address}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-sm text-slate-600">
                    <div className="font-mono bg-slate-100 px-2 py-1 rounded inline-block text-black whitespace-nowrap text-xs md:text-sm">
                      {tp.docId} {tp.dv && <span className="text-slate-400">DV-{tp.dv}</span>}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <div className="flex gap-2">
                      {tp.vehicles && tp.vehicles.length > 0 && (
                        <span title={`${tp.vehicles.length} Vehículos`} className="bg-blue-100 text-blue-700 p-1.5 rounded-md"><Car size={14} /></span>
                      )}
                      {tp.hasCommercialActivity && (
                        <span title="Comercio Activo" className="bg-indigo-100 text-indigo-700 p-1.5 rounded-md"><Store size={14} /></span>
                      )}
                      {tp.hasConstruction && (
                        <span title="Obra en Construcción" className="bg-amber-100 text-amber-700 p-1.5 rounded-md"><Hammer size={14} /></span>
                      )}
                      {tp.hasGarbageService && (
                        <span title="Recolección de Basura" className="bg-emerald-100 text-emerald-700 p-1.5 rounded-md"><Trash2 size={14} /></span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap ${tp.type === TaxpayerType.JURIDICA ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                      {tp.type}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getStatusColor(tp.status)}`}>
                      {tp.status}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 text-right relative">
                    <div className="flex justify-end items-center gap-2">
                      <button
                        onClick={() => setHistoryTaxpayer(tp)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition-colors"
                        title="Ver Historial"
                      >
                        <History size={18} />
                      </button>

                      {userRole === 'ADMIN' && (
                        <div className="relative">
                          <button
                            onClick={() => setOpenActionMenuId(openActionMenuId === tp.id ? null : tp.id)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>

                          {openActionMenuId === tp.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden text-left animate-fade-in">
                              <div className="p-2 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500 uppercase">Cambiar Estado</div>
                              <button onClick={() => handleStatusChange(tp, TaxpayerStatus.ACTIVO)} className="w-full px-4 py-2 text-sm text-left hover:bg-emerald-50 text-emerald-700 font-medium flex items-center">
                                <CheckCircle size={14} className="mr-2" /> Activar
                              </button>
                              <button onClick={() => handleStatusChange(tp, TaxpayerStatus.SUSPENDIDO)} className="w-full px-4 py-2 text-sm text-left hover:bg-amber-50 text-amber-700 font-medium flex items-center">
                                <ShieldAlert size={14} className="mr-2" /> Suspender
                              </button>
                              <button onClick={() => handleStatusChange(tp, TaxpayerStatus.BLOQUEADO)} className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-700 font-medium flex items-center">
                                <Ban size={14} className="mr-2" /> Bloquear
                              </button>
                              <div className="border-t border-slate-100 my-1"></div>
                              <button onClick={() => { onDelete(tp.id); setOpenActionMenuId(null); }} className="w-full px-4 py-2 text-sm text-left hover:bg-red-50 text-red-600 font-bold flex items-center">
                                <Trash2 size={14} className="mr-2" /> Eliminar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD TAXPAYER MODAL (WIZARD STYLE) --- */}
      {
        showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">

              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-4 md:p-6 flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-lg md:text-xl font-bold">Registro Único</h3>
                  <p className="text-slate-400 text-xs md:text-sm">Ventanilla Única Municipal</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-2">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8">

                {/* SECTION 1: TYPE SELECTOR */}
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                  <button
                    type="button"
                    onClick={() => setNewTp({ ...newTp, type: TaxpayerType.NATURAL })}
                    className={`flex-1 py-3 md:py-4 rounded-xl flex items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.NATURAL
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                  >
                    <User size={20} className="mr-3" /> Natural
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTp({ ...newTp, type: TaxpayerType.JURIDICA, hasCommercialActivity: true })}
                    className={`flex-1 py-3 md:py-4 rounded-xl flex items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.JURIDICA
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                  >
                    <Briefcase size={20} className="mr-3" /> Jurídica
                  </button>
                </div>

                {/* SECTION 2: GENERAL DATA */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo / Razón Social</label>
                    <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-emerald-500 text-black text-sm md:text-base"
                      value={newTp.name} onChange={e => setNewTp({ ...newTp, name: e.target.value })} placeholder="Ej. Juan Pérez o Inversiones del Caribe S.A." />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Identificación</label>
                    <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 text-black text-sm md:text-base"
                      value={newTp.docId} onChange={e => setNewTp({ ...newTp, docId: e.target.value })} placeholder={newTp.type === TaxpayerType.NATURAL ? '8-888-888' : '15569-88-99'} />
                  </div>

                  {newTp.type === TaxpayerType.JURIDICA && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Dígito Verificador (DV)</label>
                      <input type="text" className="w-full border border-slate-300 rounded-lg p-3 text-black text-sm md:text-base"
                        value={newTp.dv || ''} onChange={e => setNewTp({ ...newTp, dv: e.target.value })} placeholder="00" />
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Dirección Física</label>
                    <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 text-black text-sm md:text-base"
                      value={newTp.address} onChange={e => setNewTp({ ...newTp, address: e.target.value })} placeholder="Provincia, Distrito, Corregimiento, Casa..." />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
                    <input type="text" className="w-full border border-slate-300 rounded-lg p-3 text-black text-sm md:text-base"
                      value={newTp.phone} onChange={e => setNewTp({ ...newTp, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico</label>
                    <input type="email" className="w-full border border-slate-300 rounded-lg p-3 text-black text-sm md:text-base"
                      value={newTp.email} onChange={e => setNewTp({ ...newTp, email: e.target.value })} />
                  </div>
                </div>

                <hr className="border-slate-200" />

                {/* SECTION 3: SERVICES & ASSETS (The "Meat" of the update) */}
                <div>
                  <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                    <CheckSquare className="mr-2 text-emerald-600" /> Servicios y Activos
                  </h4>

                  <div className="space-y-6">

                    {/* 3.1 COMMERCIAL ACTIVITY */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <label className="flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                            checked={newTp.hasCommercialActivity}
                            onChange={(e) => setNewTp({ ...newTp, hasCommercialActivity: e.target.checked })}
                          />
                          <span className="ml-3 font-bold text-slate-700 text-sm md:text-base">Registrar Actividad Comercial</span>
                        </label>
                        <Store className="text-indigo-400" />
                      </div>

                      {newTp.hasCommercialActivity && (
                        <div className="pl-0 md:pl-8 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase">Nombre Comercial</label>
                            <input type="text" className="w-full mt-1 p-2 border rounded text-black"
                              value={newTp.commercialName} onChange={e => setNewTp({ ...newTp, commercialName: e.target.value })} placeholder="Ej. Mini Super El Chino" />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase">Categoría</label>
                            <select
                              className="w-full mt-1 p-2 border rounded bg-white text-black"
                              value={newTp.commercialCategory}
                              onChange={e => setNewTp({ ...newTp, commercialCategory: e.target.value as CommercialCategory })}
                            >
                              <option value={CommercialCategory.NONE}>Seleccionar...</option>
                              <option value={CommercialCategory.CLASE_A}>Clase A (Bancos, Supermercados)</option>
                              <option value={CommercialCategory.CLASE_B}>Clase B (Tiendas, Farmacias)</option>
                              <option value={CommercialCategory.CLASE_C}>Clase C (Kioscos, Buhonería)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3.2 VEHICLES */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
                        <span className="font-bold text-slate-700 flex items-center">
                          <Car className="mr-2 text-blue-500" /> Parque Vehicular
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowVehicleForm(!showVehicleForm)}
                          className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded hover:bg-blue-200 font-medium w-full sm:w-auto"
                        >
                          {showVehicleForm ? 'Cancelar' : '+ Agregar Vehículo'}
                        </button>
                      </div>

                      {/* List of added vehicles */}
                      {newTp.vehicles && newTp.vehicles.length > 0 && (
                        <div className="mb-4 space-y-2">
                          {newTp.vehicles.map((v, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-sm shadow-sm">
                              <div className="flex flex-col sm:flex-row sm:items-center">
                                <span className="font-bold text-slate-800">{v.brand} {v.model} ({v.year})</span>
                                <span className="hidden sm:inline mx-2 text-slate-300">|</span>
                                <span className="font-mono bg-slate-100 px-1 rounded text-xs">Placa: {v.plate}</span>
                              </div>
                              <button type="button" onClick={() => removeVehicle(v.plate)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16} /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Vehicle Sub-Form */}
                      {showVehicleForm && (
                        <div className="bg-blue-50/50 p-3 md:p-4 rounded border border-blue-100 animate-fade-in">
                          <h5 className="text-sm font-bold text-blue-800 mb-3 border-b border-blue-200 pb-1">Datos del Vehículo</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                            <input type="text" placeholder="Placa (Req)" className="p-2 border rounded text-sm text-black" value={tempVehicle.plate} onChange={e => setTempVehicle({ ...tempVehicle, plate: e.target.value.toUpperCase() })} />
                            <input type="text" placeholder="Marca (Req)" className="p-2 border rounded text-sm text-black" value={tempVehicle.brand} onChange={e => setTempVehicle({ ...tempVehicle, brand: e.target.value })} />
                            <input type="text" placeholder="Modelo" className="p-2 border rounded text-sm text-black" value={tempVehicle.model} onChange={e => setTempVehicle({ ...tempVehicle, model: e.target.value })} />
                            <input type="text" placeholder="Año" className="p-2 border rounded text-sm text-black" value={tempVehicle.year} onChange={e => setTempVehicle({ ...tempVehicle, year: e.target.value })} />
                            <input type="text" placeholder="Color" className="p-2 border rounded text-sm text-black" value={tempVehicle.color} onChange={e => setTempVehicle({ ...tempVehicle, color: e.target.value })} />
                            <input type="text" placeholder="Serial Motor" className="p-2 border rounded text-sm text-black" value={tempVehicle.motorSerial} onChange={e => setTempVehicle({ ...tempVehicle, motorSerial: e.target.value })} />
                            <input type="text" placeholder="Serial Chasis/VIN" className="p-2 border rounded text-sm text-black md:col-span-2" value={tempVehicle.chassisSerial} onChange={e => setTempVehicle({ ...tempVehicle, chassisSerial: e.target.value })} />
                          </div>

                          <label className="flex items-center cursor-pointer mb-3 bg-white p-2 rounded border border-blue-100">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                              checked={tempVehicle.hasTransferDocuments}
                              onChange={(e) => setTempVehicle({ ...tempVehicle, hasTransferDocuments: e.target.checked })}
                            />
                            <span className="ml-2 text-xs md:text-sm text-slate-700">Documentación de Propiedad / Traspaso en Regla</span>
                          </label>

                          <button type="button" onClick={handleAddVehicle} className="w-full bg-blue-600 text-white py-2.5 rounded text-sm font-bold hover:bg-blue-700 active:scale-95 transition-transform">Guardar Vehículo</button>
                        </div>
                      )}
                    </div>

                    {/* 3.3 OTHER SERVICES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Construction */}
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                        <label className="flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                            checked={newTp.hasConstruction}
                            onChange={(e) => setNewTp({ ...newTp, hasConstruction: e.target.checked })}
                          />
                          <div className="ml-3">
                            <span className="block font-bold text-slate-700 text-sm">Permisos Construcción</span>
                            <span className="text-xs text-slate-500">Obras civiles activas</span>
                          </div>
                        </label>
                        <Hammer className="text-amber-400" />
                      </div>

                      {/* Garbage */}
                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between">
                        <label className="flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                            checked={newTp.hasGarbageService}
                            onChange={(e) => setNewTp({ ...newTp, hasGarbageService: e.target.checked })}
                          />
                          <div className="ml-3">
                            <span className="block font-bold text-slate-700 text-sm">Recolección Basura</span>
                            <span className="text-xs text-slate-500">Servicio activo</span>
                          </div>
                        </label>
                        <Trash2 className="text-emerald-400" />
                      </div>
                    </div>

                  </div>
                </div>
              </form>

              <div className="p-4 md:p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
                <button onClick={() => setShowModal(false)} className="flex-1 md:flex-none px-6 py-3 rounded-lg border border-slate-300 text-slate-600 font-bold hover:bg-white active:scale-95 transition-all">
                  Cancelar
                </button>
                <button onClick={handleSubmit} className="flex-1 md:flex-none px-8 py-3 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95 transition-all">
                  Guardar
                </button>
              </div>

            </div>
          </div>
        )
      }

      {/* --- HISTORY MODAL --- */}
      {
        historyTaxpayer && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">

              {/* Modal Header */}
              <div className="p-4 md:p-6 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
                <div>
                  <h3 className="text-lg md:text-xl font-bold flex items-center">
                    <History className="mr-2" /> Historial
                  </h3>
                </div>
                <button onClick={() => setHistoryTaxpayer(null)} className="text-slate-400 hover:text-white p-1">
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body Info */}
              <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50 flex-shrink-0">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800">{historyTaxpayer.name}</h2>
                    <p className="text-sm text-slate-500 font-mono">
                      ID: {historyTaxpayer.docId}
                    </p>
                  </div>
                  <div className="text-left sm:text-right bg-emerald-50 p-3 rounded-lg border border-emerald-100 sm:bg-transparent sm:border-0 sm:p-0">
                    <p className="text-xs text-slate-500 uppercase font-bold">Total Pagado</p>
                    <p className="text-2xl font-bold text-emerald-600">B/. {totalPaidHistory.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Transaction Table */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                {taxpayerHistory.length > 0 ? (
                  <table className="w-full text-left border-collapse">
                    <thead className="text-xs text-slate-400 uppercase border-b border-slate-200 sticky top-0 bg-white">
                      <tr>
                        <th className="py-2">Fecha</th>
                        <th className="py-2 hidden sm:table-cell">Recibo #</th>
                        <th className="py-2">Descripción</th>
                        <th className="py-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {taxpayerHistory.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="py-3 text-slate-500 font-medium whitespace-nowrap align-top">
                            {t.date}
                            <div className="text-[10px] text-slate-400 sm:hidden">{t.time}</div>
                          </td>
                          <td className="py-3 font-mono text-slate-600 hidden sm:table-cell align-top">{t.id}</td>
                          <td className="py-3 text-slate-700 align-top">
                            <span className="block font-medium text-xs md:text-sm">{t.taxType}</span>
                            <span className="text-[10px] md:text-xs text-slate-400 line-clamp-2">{t.description}</span>
                          </td>
                          <td className="py-3 text-right font-bold text-slate-800 align-top whitespace-nowrap">
                            B/. {t.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-12 text-slate-400 flex flex-col items-center">
                    <FileText size={48} className="mb-4 opacity-20" />
                    <p>No se encontraron transacciones registradas.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-200 text-right bg-white flex-shrink-0">
                <button
                  onClick={() => setHistoryTaxpayer(null)}
                  className="w-full sm:w-auto px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors active:scale-95"
                >
                  Cerrar
                </button>
              </div>

            </div>
          </div>
        )
      }
    </div >
  );
};