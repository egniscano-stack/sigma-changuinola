import React, { useState, useRef } from 'react';
import { TaxConfig, MunicipalityInfo, User, UserRole } from '../types';
import { Save, Shield, DollarSign, Building, UserPlus, X, Database, Globe, Download, Upload, Server, FileSpreadsheet } from 'lucide-react';

interface SettingsProps {
  config: TaxConfig;
  onUpdateConfig: (newConfig: TaxConfig) => void;
  municipalityInfo: MunicipalityInfo;
  onUpdateMunicipalityInfo: (info: MunicipalityInfo) => void;
  users: User[];
  onUpdateUser: (user: User) => void;
  onSimulateScraping: () => void;
  onBackup: () => void;
  onImport: (file: File) => void;
}

export const Settings: React.FC<SettingsProps> = ({
  config, onUpdateConfig, municipalityInfo, onUpdateMunicipalityInfo, users, onCreateUser, onUpdateUser, onSimulateScraping, onBackup, onImport
}) => {
  const [localConfig, setLocalConfig] = useState<TaxConfig>(config);
  const [localMuniInfo, setLocalMuniInfo] = useState<MunicipalityInfo>(municipalityInfo);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // User Creation State
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState<User>({
    username: '',
    name: '',
    password: '',
    role: 'CAJERO'
  });

  // Change Password State
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // ETL Simulation State
  const [scrapingLoading, setScrapingLoading] = useState(false);

  const handleConfigChange = (key: keyof TaxConfig, value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      [key]: parseFloat(value) || 0
    }));
  };

  const handleMuniChange = (key: keyof MunicipalityInfo, value: string) => {
    setLocalMuniInfo(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveAll = () => {
    onUpdateConfig(localConfig);
    onUpdateMunicipalityInfo(localMuniInfo);
    alert('Configuración y datos institucionales actualizados correctamente.');
  };

  const submitNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (users.some(u => u.username === newUser.username)) {
      alert('El nombre de usuario ya existe.');
      return;
    }
    onCreateUser(newUser);
    setShowUserModal(false);
    setNewUser({ username: '', name: '', password: '', role: 'CAJERO' }); // Reset
    alert(`Usuario ${newUser.username} creado exitosamente.`);
  };

  const openPwdModal = (user: User) => {
    setUserToEdit(user);
    setNewPassword('');
    setShowPwdModal(true);
  };

  const submitChangePwd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit || !newPassword) return;

    onUpdateUser({ ...userToEdit, password: newPassword });
    setShowPwdModal(false);
    setUserToEdit(null);
    alert("Contraseña actualizada correctamente.");
  };

  const executeScraping = () => {
    setScrapingLoading(true);
    // Simulate network delay for scraping
    setTimeout(() => {
      onSimulateScraping();
      setScrapingLoading(false);
      alert("Proceso ETL completado: Datos extraídos y cargados correctamente.");
    }, 2000);
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImport(e.target.files[0]);
    }
    // Reset value so we can select same file again if needed
    if (e.target) e.target.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Configuración del Sistema</h2>
          <p className="text-slate-500">Panel de Administrador - Alcaldía</p>
        </div>
        <button
          onClick={handleSaveAll}
          className="bg-emerald-600 text-white px-6 py-3 rounded-lg flex items-center hover:bg-emerald-700 shadow-md font-bold transition-transform active:scale-95"
        >
          <Save size={20} className="mr-2" />
          Guardar Cambios
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ... Municipality and Rates Config (unchanged) ... */}

        {/* --- Municipality Info Section --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
          <div className="flex items-center mb-6 text-slate-800 border-b pb-2">
            <Building className="mr-2 text-indigo-600" />
            <h3 className="text-lg font-bold">Información Institucional (Encabezado Factura)</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Nombre de la Entidad</label>
              <input
                type="text"
                value={localMuniInfo.name}
                onChange={(e) => handleMuniChange('name', e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Provincia / Región</label>
              <input
                type="text"
                value={localMuniInfo.province}
                onChange={(e) => handleMuniChange('province', e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">RUC</label>
                <input
                  type="text"
                  value={localMuniInfo.ruc}
                  onChange={(e) => handleMuniChange('ruc', e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Teléfono</label>
                <input
                  type="text"
                  value={localMuniInfo.phone}
                  onChange={(e) => handleMuniChange('phone', e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Correo Electrónico</label>
              <input
                type="text"
                value={localMuniInfo.email}
                onChange={(e) => handleMuniChange('email', e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Dirección Física</label>
              <input
                type="text"
                value={localMuniInfo.address}
                onChange={(e) => handleMuniChange('address', e.target.value)}
                className="w-full mt-1 p-2 border rounded-lg focus:ring-emerald-500 text-black"
              />
            </div>
          </div>
        </div>

        {/* --- Rates Configuration --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-fit">
          <div className="flex items-center mb-6 text-slate-800 border-b pb-2">
            <DollarSign className="mr-2 text-emerald-600" />
            <h3 className="text-lg font-bold">Tasas e Impuestos</h3>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700">Costo Placa Vehicular</label>
                <span className="text-xs text-slate-400">Precio base anual</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-slate-500">B/.</span>
                <input
                  type="number"
                  value={localConfig.plateCost}
                  onChange={(e) => handleConfigChange('plateCost', e.target.value)}
                  className="w-24 text-right p-2 border rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-black"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tasa Construcción</label>
                <span className="text-xs text-slate-400">Por metro cuadrado (m²)</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-slate-500">B/.</span>
                <input
                  type="number"
                  value={localConfig.constructionRatePerSqm}
                  onChange={(e) => handleConfigChange('constructionRatePerSqm', e.target.value)}
                  className="w-24 text-right p-2 border rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-black"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700">Basura (Residencial)</label>
                <span className="text-xs text-slate-400">Tarifa mensual fija</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-slate-500">B/.</span>
                <input
                  type="number"
                  value={localConfig.garbageResidentialRate}
                  onChange={(e) => handleConfigChange('garbageResidentialRate', e.target.value)}
                  className="w-24 text-right p-2 border rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-black"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700">Comercial (Base)</label>
                <span className="text-xs text-slate-400">Impuesto mínimo mensual</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-slate-500">B/.</span>
                <input
                  type="number"
                  value={localConfig.commercialBaseRate}
                  onChange={(e) => handleConfigChange('commercialBaseRate', e.target.value)}
                  className="w-24 text-right p-2 border rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-black"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700">Licencia de Licores</label>
                <span className="text-xs text-slate-400">Tasa mensual</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-slate-500">B/.</span>
                <input
                  type="number"
                  value={localConfig.liquorLicenseRate}
                  onChange={(e) => handleConfigChange('liquorLicenseRate', e.target.value)}
                  className="w-24 text-right p-2 border rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-black"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <label className="block text-sm font-medium text-slate-700">Publicidad y Rótulos</label>
                <span className="text-xs text-slate-400">Tasa mensual</span>
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-slate-500">B/.</span>
                <input
                  type="number"
                  value={localConfig.advertisementRate}
                  onChange={(e) => handleConfigChange('advertisementRate', e.target.value)}
                  className="w-24 text-right p-2 border rounded-lg focus:ring-emerald-500 focus:border-emerald-500 text-black"
                />
              </div>
            </div>
          </div>
        </div>

        {/* --- DATA MANAGEMENT SECTION (New) --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6 border-b pb-2">
            <div className="flex items-center text-slate-800">
              <Database className="mr-2 text-blue-600" />
              <h3 className="text-lg font-bold">Gestión de Datos y Base de Datos</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Database Actions */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-700 flex items-center">
                <FileSpreadsheet size={18} className="mr-2 text-emerald-600" /> Respaldo y Restauración (Excel)
              </h4>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-500">Estado del Servicio:</span>
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full flex items-center">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                    Activo
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Descargue un archivo Excel completo con todas las tablas del sistema, o importe datos masivos alimentando la base de datos existente.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={onBackup}
                    className="w-full flex items-center justify-center bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold transition-colors"
                  >
                    <Download size={18} className="mr-2" />
                    Descargar Respaldo (Excel)
                  </button>

                  <button
                    onClick={triggerImport}
                    className="w-full flex items-center justify-center bg-white text-slate-700 border border-slate-300 py-2 rounded-lg hover:bg-slate-50 font-bold transition-colors"
                  >
                    <Upload size={18} className="mr-2" />
                    Importar Datos (Excel)
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </div>

            {/* ETL / Scraping Actions */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-700 flex items-center">
                <Globe size={18} className="mr-2" /> Web Scraping (Gob.pa)
              </h4>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-xs text-slate-400 mb-4">
                  Herramientas de extracción automática de datos (ETL) desde fuentes web gubernamentales para actualizar el padrón de contribuyentes.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={executeScraping}
                    disabled={scrapingLoading}
                    className={`w-full flex items-center justify-center py-2 rounded-lg font-bold border transition-colors ${scrapingLoading
                      ? 'bg-slate-200 text-slate-500 border-slate-300'
                      : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                      }`}
                  >
                    {scrapingLoading ? (
                      <>Procesando ETL...</>
                    ) : (
                      <>
                        <Globe size={18} className="mr-2" />
                        Sincronizar Web (Scraping)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- User Roles Management --- */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6 border-b pb-2">
            <div className="flex items-center text-slate-800">
              <Shield className="mr-2 text-amber-600" />
              <h3 className="text-lg font-bold">Gestión de Usuarios</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u, idx) => (
              <div key={idx} className="bg-slate-50 p-4 rounded-lg flex justify-between items-center border border-slate-100 group hover:ring-2 hover:ring-indigo-100 transition-all">
                <div className="flex items-center">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold mr-3 ${u.role === 'ADMIN' ? 'bg-indigo-600' : 'bg-emerald-600'
                    }`}>
                    {u.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-500">Usuario: {u.username} • <span className={u.role === 'ADMIN' ? 'text-indigo-600' : 'text-emerald-600'}>{u.role}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => openPwdModal(u)}
                  className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors"
                  title="Cambiar Contraseña"
                >
                  <Shield size={16} />
                </button>
              </div>
            ))}

            <button
              onClick={() => setShowUserModal(true)}
              className="p-4 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer"
            >
              <UserPlus size={24} className="mb-2" />
              <span className="font-bold text-sm">Crear Nuevo Usuario</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- ADD USER MODAL --- */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">Registrar Nuevo Usuario</h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={submitNewUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nombre Completo del Empleado</label>
                <input
                  required
                  type="text"
                  className="w-full mt-1 p-2 border rounded-lg text-black"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Rol / Cargo</label>
                <select
                  className="w-full mt-1 p-2 border rounded-lg bg-white text-black"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                >
                  <option value="CAJERO">Cajero (Cobros)</option>
                  <option value="ADMIN">Administrador (Total)</option>
                  <option value="AUDITOR">Auditor (Solo Lectura)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Usuario (Login)</label>
                  <input
                    required
                    type="text"
                    className="w-full mt-1 p-2 border rounded-lg text-black"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Ej. jperez"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Contraseña</label>
                  <input
                    required
                    type="text"
                    className="w-full mt-1 p-2 border rounded-lg text-black"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="******"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CHANGE PASSWORD MODAL --- */}
      {showPwdModal && userToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-fade-in border-t-8 border-indigo-600">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Cambiar Contraseña</h3>
            <p className="text-slate-600 text-sm mb-4">
              Actualizar credenciales para: <span className="font-bold text-indigo-600">{userToEdit.username}</span>
            </p>

            <form onSubmit={submitChangePwd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nueva Contraseña</label>
                <input
                  required
                  type="text"
                  autoFocus
                  className="w-full mt-1 p-2 border rounded-lg text-black bg-slate-50"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};