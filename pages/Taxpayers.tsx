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
  const [showModal, setShowModal] = useState(false); // Legacy modal state, mostly unused now unless we want to keep it for editing via search
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Taxpayer[]>([]);

  // History Modal State
  const [historyTaxpayer, setHistoryTaxpayer] = useState<Taxpayer | null>(null);

  // --- New Taxpayer Form State (Now Main View) ---
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

  // Search Effect
  React.useEffect(() => {
    if (searchTerm.length > 2) {
      setIsSearching(true);
      const results = taxpayers.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.docId.includes(searchTerm) ||
        (t.taxpayerNumber && t.taxpayerNumber.includes(searchTerm))
      );
      setSearchResults(results.slice(0, 5)); // Limit to 5 results
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  }, [searchTerm, taxpayers]);

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

    // Instead of closing modal, we reset the form and show success feedback (alert for now)
    setNewTp(initialFormState);
    alert("Contribuyente registrado exitosamente.");
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    <div className="space-y-6 pb-20 relative min-h-screen bg-slate-50 -m-4 sm:-m-8 p-4 sm:p-8">

      {/* --- TOP SEARCH BAR (Sticky) --- */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md shadow-sm border-b border-slate-200 -mx-4 sm:-mx-8 px-4 sm:px-8 py-4 mb-6">
        <div className="max-w-4xl mx-auto relative">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar contribuyente existente (RUC, Cédula, Nombre)..."
              className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-full shadow-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 text-lg transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm.length > 0 && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Search Dropdown */}
          {isSearching && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in z-50">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase">
                Resultados Encontrados
              </div>
              <ul>
                {searchResults.map(tp => (
                  <li key={tp.id}>
                    <button
                      onClick={() => {
                        setHistoryTaxpayer(tp);
                        setSearchTerm('');
                        setIsSearching(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-indigo-700">{tp.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="font-mono bg-slate-100 px-1 rounded">{tp.docId}</span>
                          <span>• {tp.taxpayerNumber}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-slate-400 group-hover:text-indigo-500">
                        <span className="text-xs mr-2 font-medium">Ver Ficha</span>
                        <History size={16} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* --- MAIN CONTENT: NEW RECORD FORM --- */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 text-white p-6 md:p-8 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <UserPlus size={120} />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg backdrop-blur text-emerald-300">
                <UserPlus size={24} />
              </div>
              <span className="text-emerald-400 font-bold tracking-wider text-sm uppercase">Nuevo Registro</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Ficha de Contribuyente</h2>
            <p className="text-slate-400 text-lg">Ingrese los datos para registrar un nuevo contribuyente.</p>
          </div>
        </div>

        {/* The Form Content (Reused from Modal) */}
        <div className="p-6 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Same Sections as before, but without modal styling constraints */}

            {/* SECTION 1: TYPE SELECTOR */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => setNewTp({ ...newTp, type: TaxpayerType.NATURAL })}
                className={`flex-1 py-4 md:py-6 rounded-2xl flex flex-col items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.NATURAL
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white'
                  }`}
              >
                <User size={32} className="mb-2" />
                <span className="text-lg">Persona Natural</span>
              </button>
              <button
                type="button"
                onClick={() => setNewTp({ ...newTp, type: TaxpayerType.JURIDICA, hasCommercialActivity: true })}
                className={`flex-1 py-4 md:py-6 rounded-2xl flex flex-col items-center justify-center border-2 font-bold transition-all active:scale-95 ${newTp.type === TaxpayerType.JURIDICA
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-300 hover:bg-white'
                  }`}
              >
                <Briefcase size={32} className="mb-2" />
                <span className="text-lg">Persona Jurídica</span>
              </button>
            </div>

            {/* SECTION 2: GENERAL DATA */}
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-slate-200 pb-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3 text-slate-600 font-bold text-sm">1</div>
                Datos Generales
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nombre Completo / Razón Social</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.name} onChange={e => setNewTp({ ...newTp, name: e.target.value })} placeholder="Ej. Juan Pérez o Inversiones del Caribe S.A." />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Identificación (Cédula / RUC)</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.docId} onChange={e => setNewTp({ ...newTp, docId: e.target.value })} placeholder={newTp.type === TaxpayerType.NATURAL ? '8-888-888' : '15569-88-99'} />
                </div>

                {newTp.type === TaxpayerType.JURIDICA && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Dígito Verificador (DV)</label>
                    <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                      value={newTp.dv || ''} onChange={e => setNewTp({ ...newTp, dv: e.target.value })} placeholder="00" />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Dirección Física</label>
                  <input required type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.address} onChange={e => setNewTp({ ...newTp, address: e.target.value })} placeholder="Provincia, Distrito, Corregimiento, Casa..." />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Teléfono</label>
                  <input type="text" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.phone} onChange={e => setNewTp({ ...newTp, phone: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Correo Electrónico</label>
                  <input type="email" className="w-full border border-slate-300 rounded-lg p-3 px-4 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all text-black text-base"
                    value={newTp.email} onChange={e => setNewTp({ ...newTp, email: e.target.value })} />
                </div>
              </div>
            </div>

            {/* SECTION 3: SERVICES */}
            <div className="bg-white rounded-2xl">
              <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center mr-3 text-slate-600 font-bold text-sm">2</div>
                Servicios y Activos
              </h4>

              <div className="space-y-8">
                {/* 3.1 COMMERCIAL ACTIVITY & OTHERS */}
                {/* Reusing logic but slightly restyled */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-indigo-50 p-5 rounded-xl border border-indigo-100 md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <label className="flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="w-6 h-6 text-indigo-600 rounded focus:ring-indigo-500"
                          checked={newTp.hasCommercialActivity}
                          onChange={(e) => setNewTp({ ...newTp, hasCommercialActivity: e.target.checked })}
                        />
                        <div className="ml-3">
                          <span className="block font-bold text-indigo-900 text-lg">Actividad Comercial</span>
                          <span className="text-indigo-600/70 text-sm">Negocios, tiendas, industrias</span>
                        </div>
                      </label>
                      <Store className="text-indigo-400 w-8 h-8" />
                    </div>

                    {newTp.hasCommercialActivity && (
                      <div className="pl-0 md:pl-9 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in mt-4 border-t border-indigo-200/50 pt-4">
                        <div>
                          <label className="block text-xs font-bold text-indigo-800/60 uppercase mb-1">Nombre Comercial</label>
                          <input type="text" className="w-full p-3 border border-indigo-200 rounded-lg text-black bg-white focus:ring-2 focus:ring-indigo-500"
                            value={newTp.commercialName} onChange={e => setNewTp({ ...newTp, commercialName: e.target.value })} placeholder="Ej. Mini Super El Chino" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-indigo-800/60 uppercase mb-1">Categoría</label>
                          <select
                            className="w-full p-3 border border-indigo-200 rounded-lg bg-white text-black"
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

                  {/* Construction */}
                  <div className="bg-amber-50 p-5 rounded-xl border border-amber-100 flex items-center justify-between hover:bg-amber-100/50 transition-colors">
                    <label className="flex items-center cursor-pointer select-none w-full">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                        checked={newTp.hasConstruction}
                        onChange={(e) => setNewTp({ ...newTp, hasConstruction: e.target.checked })}
                      />
                      <div className="ml-3">
                        <span className="block font-bold text-amber-900">Permisos Construcción</span>
                        <span className="text-sm text-amber-700/60">Obras civiles activas</span>
                      </div>
                    </label>
                    <Hammer className="text-amber-400 w-6 h-6" />
                  </div>

                  {/* Garbage */}
                  <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100 flex items-center justify-between hover:bg-emerald-100/50 transition-colors">
                    <label className="flex items-center cursor-pointer select-none w-full">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                        checked={newTp.hasGarbageService}
                        onChange={(e) => setNewTp({ ...newTp, hasGarbageService: e.target.checked })}
                      />
                      <div className="ml-3">
                        <span className="block font-bold text-emerald-900">Recolección Basura</span>
                        <span className="text-sm text-emerald-700/60">Servicio activo</span>
                      </div>
                    </label>
                    <Trash2 className="text-emerald-400 w-6 h-6" />
                  </div>
                </div>

                {/* 3.2 VEHICLES */}
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mt-6 relative">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-200/50 rounded-lg text-blue-600">
                        <Car size={24} />
                      </div>
                      <div>
                        <h5 className="font-bold text-blue-900 text-lg">Parque Vehicular</h5>
                        <p className="text-blue-700/60 text-sm">Gestionar vehículos y traspasos</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowVehicleForm(!showVehicleForm)}
                      className="mt-3 sm:mt-0 px-4 py-2 bg-white text-blue-600 border border-blue-200 rounded-lg font-bold shadow-sm hover:shadow-md transition-all active:scale-95 flex items-center"
                    >
                      {showVehicleForm ? <X size={18} className="mr-2" /> : <Plus size={18} className="mr-2" />}
                      {showVehicleForm ? 'Cancelar' : 'Agregar Vehículo'}
                    </button>
                  </div>

                  {/* List of added vehicles */}
                  {newTp.vehicles && newTp.vehicles.length > 0 ? (
                    <div className="space-y-3 mb-6">
                      {newTp.vehicles.map((v, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                <Car size={20} />
                              </div>
                              <div>
                                <h6 className="font-bold text-slate-800 text-lg">{v.brand} {v.model}</h6>
                                <p className="text-slate-500 text-sm">Año: {v.year} • Color: {v.color}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="block font-mono font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm mb-1">{v.plate}</span>
                            </div>
                          </div>
                          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                            <div className="flex gap-2">
                              {/* These buttons are placeholders in 'Creation Mode' mostly, but functional logic remains */}
                              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">VIN: {v.chassisSerial}</span>
                            </div>
                            <button type="button" onClick={() => removeVehicle(v.plate)} className="text-red-500 hover:text-red-700 flex items-center text-sm font-bold bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition-colors">
                              <Trash2 size={16} className="mr-2" /> Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !showVehicleForm && (
                      <div className="text-center py-8 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/50 text-blue-400 mb-4">
                        <Car size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No hay vehículos registrados.</p>
                      </div>
                    )
                  )}

                  {/* Add Vehicle Sub-Form */}
                  {showVehicleForm && (
                    <div className="bg-white p-6 rounded-xl border-2 border-blue-400 shadow-xl animate-fade-in relative z-10">
                      <h5 className="font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">Nuevo Vehículo</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <input type="text" placeholder="Placa (Req)" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.plate} onChange={e => setTempVehicle({ ...tempVehicle, plate: e.target.value.toUpperCase() })} />
                        <input type="text" placeholder="Marca (Req)" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.brand} onChange={e => setTempVehicle({ ...tempVehicle, brand: e.target.value })} />
                        <input type="text" placeholder="Modelo" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.model} onChange={e => setTempVehicle({ ...tempVehicle, model: e.target.value })} />
                        <input type="text" placeholder="Año" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.year} onChange={e => setTempVehicle({ ...tempVehicle, year: e.target.value })} />
                        <input type="text" placeholder="Color" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.color} onChange={e => setTempVehicle({ ...tempVehicle, color: e.target.value })} />
                        <input type="text" placeholder="Serial Motor" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors" value={tempVehicle.motorSerial} onChange={e => setTempVehicle({ ...tempVehicle, motorSerial: e.target.value })} />
                        <input type="text" placeholder="Serial Chasis/VIN" className="p-3 border rounded-lg text-black bg-slate-50 focus:bg-white transition-colors md:col-span-2" value={tempVehicle.chassisSerial} onChange={e => setTempVehicle({ ...tempVehicle, chassisSerial: e.target.value })} />
                      </div>

                      <label className="flex items-center cursor-pointer mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <input
                          type="checkbox"
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                          checked={tempVehicle.hasTransferDocuments}
                          onChange={(e) => setTempVehicle({ ...tempVehicle, hasTransferDocuments: e.target.checked })}
                        />
                        <span className="ml-3 text-slate-700 font-medium">Documentación de Propiedad / Traspaso en Regla</span>
                      </label>

                      <div className="flex gap-3">
                        <button type="button" onClick={() => setShowVehicleForm(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200">Cancelar</button>
                        <button type="button" onClick={handleAddVehicle} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200">Guardar Vehículo</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ACTIONS FOOTER */}
            <div className="pt-6 border-t border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-end">
              <button
                type="button"
                onClick={() => setNewTp(initialFormState)}
                className="w-full md:w-auto px-8 py-4 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 active:scale-95 transition-all"
              >
                Limpiar / Cancelar
              </button>
              <button type="submit" className="w-full md:w-auto px-10 py-4 rounded-xl bg-slate-900 text-white font-bold text-lg hover:bg-emerald-600 shadow-xl shadow-slate-200 hover:shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center">
                <CheckCircle size={24} className="mr-2" />
                Registrar Contribuyente
              </button>
            </div>
          </form>
        </div>
      </div>


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