import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { PortalLogin } from './components/PortalLogin';
import { usePersistentState } from './hooks/usePersistentState';
import { Dashboard } from './pages/Dashboard';
import { Taxpayers } from './pages/Taxpayers';
import { TaxCollection } from './pages/TaxCollection';
import { Debts } from './pages/Debts';
import { InvoiceScanner } from './pages/InvoiceScanner';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { INITIAL_CONFIG } from './services/mockData';
import { TaxpayerPortal } from './pages/TaxpayerPortal';
import { Landing } from './pages/Landing'; // Import Landing
import { AlcaldeDashboard } from './pages/AlcaldeDashboard';
import { SecretariaDashboard } from './pages/SecretariaDashboard';
import { TaxConfig, Taxpayer, Transaction, User, MunicipalityInfo, TaxpayerType, CommercialCategory, TaxpayerStatus, AdminRequest, RequestStatus } from './types';
import { Menu, ArrowLeft, Wifi, WifiOff, RefreshCw, Bell, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { db, mapTaxpayerFromDB, mapTransactionFromDB } from './services/db';

// Initial Municipality Info
const INITIAL_MUNICIPALITY_INFO: MunicipalityInfo = {
  name: 'Municipio de Changuinola',
  province: 'Provincia de Bocas del Toro, República de Panamá',
  ruc: '1-22-333 DV 44',
  phone: '758-1234',
  email: 'tesoreria@changuinola.gob.pa',
  address: 'Ave. 17 de Abril, Changuinola'
};

function App() {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Global App State (Fetched from Supabase)
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [municipalityInfo, setMunicipalityInfo] = usePersistentState<MunicipalityInfo>('sigma_municipality', INITIAL_MUNICIPALITY_INFO);
  const [taxpayers, setTaxpayers] = useState<Taxpayer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [config, setConfig] = useState<TaxConfig>(INITIAL_CONFIG);

  // Admin Requests State (Mock Backend via LocalStorage)
  const [adminRequests, setAdminRequests] = usePersistentState<AdminRequest[]>('sigma_admin_requests', []);
  const [showRequestsModal, setShowRequestsModal] = useState(false); // For Admin to view list

  // Loading State
  const [isLoading, setIsLoading] = useState(true);

  // Offline Logic State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncTransactions, setPendingSyncTransactions] = useState<Transaction[]>([]);

  // Check navigation mode (Portal vs Admin vs Landing)
  const [appMode, setAppMode] = useState<'ADMIN' | 'PORTAL' | 'LANDING'>('LANDING');

  useEffect(() => {
    // Check URL params for mode if present (deep linking support)
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'portal') {
      setAppMode('PORTAL');
    } else if (params.get('mode') === 'admin') {
      setAppMode('ADMIN');
    }

    // Load Data from Supabase
    const loadData = async () => {
      try {
        const [usersData, taxpayersData, transactionsData, configData] = await Promise.all([
          db.getAppUsers(),
          db.getTaxpayers(),
          db.getTransactions(),
          db.getConfig()
        ]);

        if (usersData.length === 0) {
          console.log("No users found. Seeding default users...");
          const defaultAdmin: User = { username: 'admin', password: 'admin123', name: 'Administrador Default', role: 'ADMIN' };
          const defaultRegistro: User = { username: 'registro', password: '123', name: 'Oficial de Registro', role: 'REGISTRO' };

          try {
            const createdAdmin = await db.createAppUser(defaultAdmin);
            const createdRegistro = await db.createAppUser(defaultRegistro);
            setRegisteredUsers([createdAdmin, createdRegistro]);
          } catch (err) {
            console.error("Failed to seed default users:", err);
            setRegisteredUsers([defaultAdmin, defaultRegistro]);
          }
        } else {
          // Check if 'registro' exists
          const hasRegistro = usersData.find(u => u.username === 'registro');
          if (!hasRegistro) {
            const defaultRegistro: User = { username: 'registro', password: '123', name: 'Oficial de Registro', role: 'REGISTRO' }; // Fixed role
            try { await db.createAppUser(defaultRegistro); } catch (e) { console.error(e); }
          }

          // Check if 'alcalde' exists
          const hasAlcalde = usersData.find(u => u.username === 'alcalde');
          if (!hasAlcalde) {
            const defaultAlcalde: User = { username: 'alcalde', password: 'mnc', name: 'Alcalde Municipal', role: 'ALCALDE' };
            try { await db.createAppUser(defaultAlcalde); } catch (e) { console.error(e); }
          }

          // Fetch again to include new users
          const updatedUsers = await db.getAppUsers();
          setRegisteredUsers(updatedUsers);
        }

        setTaxpayers(taxpayersData);
        setTransactions(transactionsData);
        if (configData) setConfig(configData);
      } catch (error) {
        console.error("Error loading data from Supabase:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Check online status initially
    // Check online status initially
    setIsOnline(navigator.onLine);

    // Online/Offline Listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load of offline transactions
    try {
      const savedOffline = localStorage.getItem('sigma_offline_txs');
      if (savedOffline) {
        setPendingSyncTransactions(JSON.parse(savedOffline));
      }
    } catch (e) {
      console.error("Error loading offline txs", e);
    }

    // Realtime Subscriptions
    const unsubscribe = db.subscribeToChanges(
      // Taxpayers Changes
      (payload) => {
        console.log("Realtime Taxpayer Update:", payload);
        if (payload.eventType === 'INSERT') {
          const newTp = mapTaxpayerFromDB(payload.new);
          setTaxpayers(prev => {
            if (prev.some(t => t.id === newTp.id)) return prev;
            return [...prev, newTp];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedTp = mapTaxpayerFromDB(payload.new);
          setTaxpayers(prev => prev.map(t => t.id === updatedTp.id ? updatedTp : t));
        } else if (payload.eventType === 'DELETE') {
          setTaxpayers(prev => prev.filter(t => t.id !== payload.old.id));
        }
      },
      // Transactions Changes
      (payload) => {
        console.log("Realtime Transaction Update:", payload);
        if (payload.eventType === 'INSERT') {
          const newTx = mapTransactionFromDB(payload.new);
          setTransactions(prev => {
            // Check if this incoming tx is one of our offline pending ones
            // If so, we might want to remove it from pending (handled in sync function ideally)
            // But here we just ensure we show it.
            if (prev.some(t => t.id === newTx.id)) return prev;
            return [newTx, ...prev]; // Newest first
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedTx = mapTransactionFromDB(payload.new);
          setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
        }
      }
    );

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [selectedDebtTaxpayer, setSelectedDebtTaxpayer] = useState<Taxpayer | null>(null);

  // Offline / Sync Logic
  const handleSync = async () => {
    if (pendingSyncTransactions.length === 0) return;
    if (!isOnline) {
      alert("No hay conexión a internet para sincronizar.");
      return;
    }

    if (!confirm(`Se enviarán ${pendingSyncTransactions.length} transacciones a la base de datos. ¿Continuar?`)) return;

    let successCount = 0;
    const failedTxs: Transaction[] = [];

    setIsLoading(true);

    for (const tx of pendingSyncTransactions) {
      try {
        // We might need to map them or just send them.
        // Important: Ideally generate a new ID or ensure the logic in DB accepts this ID.
        // Our db.createTransaction service respects the ID passed if we modify it, 
        // but currently it relies on the mapTransactionToDB which passes everything.
        // Let's assume the ID generated offline (TX-TIMESTAMP) is fine for now, 
        // OR let DB generate one and just track the success.

        await db.createTransaction(tx);
        successCount++;
      } catch (e) {
        console.error("Sync failed for tx:", tx.id, e);
        failedTxs.push(tx);
      }
    }

    setPendingSyncTransactions(failedTxs);
    localStorage.setItem('sigma_offline_txs', JSON.stringify(failedTxs));
    setIsLoading(false);

    if (failedTxs.length === 0) {
      alert("¡Sincronización completada exitosamente!");
    } else {
      alert(`Sincronización parcial. ${successCount} enviadas, ${failedTxs.length} fallidas.`);
    }
  };

  // Close sidebar automatically on route change if on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [currentPage]);

  // Handlers
  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    if (loggedInUser.role === 'CAJERO') {
      setCurrentPage('caja');
    } else {
      setCurrentPage('dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('dashboard');
    setSelectedDebtTaxpayer(null);
    setAppMode('LANDING'); // Go back to landing on logout
  };

  const handleAddTaxpayer = async (newTp: Taxpayer) => {
    try {
      const created = await db.createTaxpayer(newTp);
      setTaxpayers([...taxpayers, created]);
    } catch (e: any) {
      console.error("Error creating taxpayer", e);
      alert(`Error al guardar en base de datos: ${e.message || JSON.stringify(e)}`);
    }
  };

  const handleUpdateTaxpayer = async (updatedTp: Taxpayer) => {
    try {
      // Check if ID is a valid UUID (Postgres UUIDs are 36 chars)
      // If the ID is short (e.g. "1" or "EXT-123"), it's a local/mock record that isn't in the DB.
      // We must CREATE it instead of updating it.
      const isInvalidId = updatedTp.id.length < 32;

      if (isInvalidId) {
        // It's a local record: Create it in DB to "Sync" it
        // Remove the invalid ID so createTaxpayer generates a real UUID
        const { id, ...dataToSync } = updatedTp;

        // Ensure taxpayerNumber exists (legacy data might lack it)
        if (!dataToSync.taxpayerNumber) {
          dataToSync.taxpayerNumber = `${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
        }

        const synced = await db.createTaxpayer(dataToSync as Taxpayer);

        // Update local state: Replace the old invalid record with the new real one
        setTaxpayers(taxpayers.map(tp => tp.id === updatedTp.id ? synced : tp));
        alert("Contribuyente sincronizado con la base de datos exitosamente.");
      } else {
        // It's a real record: Update normally
        const updated = await db.updateTaxpayer(updatedTp);
        setTaxpayers(taxpayers.map(tp => tp.id === updated.id ? updated : tp));
      }

    } catch (e: any) {
      console.error("Error updating taxpayer", e);
      alert(`Error al actualizar en base de datos: ${e.message || JSON.stringify(e)}`);
    }
  };

  const handleDeleteTaxpayer = async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este contribuyente? Esta acción no se puede deshacer.')) {
      try {
        // If ID is short (not a UUID), it's a local mock record, so just remove from state
        // without calling DB (which would fail with invalid syntax)
        const isLocalRecord = id.length < 32;

        if (!isLocalRecord) {
          await db.deleteTaxpayer(id);
        }

        setTaxpayers(taxpayers.filter(tp => tp.id !== id));
      } catch (e: any) {
        console.error("Error deleting", e);
        alert(`Error al eliminar: ${e.message || JSON.stringify(e)}`);
      }
    }
  };

  const handleCreateUser = async (newUser: User) => {
    try {
      const created = await db.createAppUser(newUser);
      setRegisteredUsers([...registeredUsers, created]);
    } catch (e) {
      console.error("Error creating user", e);
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      const updated = await db.updateAppUser(updatedUser);
      setRegisteredUsers(registeredUsers.map(u => u.username === updated.username ? updated : u));
    } catch (e) {
      console.error("Error updating user", e);
      alert("Error al actualizar usuario");
    }
  };

  // ... (Keep other handlers like handleGoToPay, handlePayment same as before, simplified for brevity in replace tool but ensuring all needed logic is retained)

  const handleGoToPay = (taxpayer: Taxpayer) => {
    setSelectedDebtTaxpayer(taxpayer);
    setCurrentPage('caja');
  };

  const handlePayment = (paymentData: any) => {
    const newTransaction: Transaction = {
      id: `TX-${Date.now()}`,
      taxpayerId: paymentData.taxpayerId,
      taxType: paymentData.taxType,
      amount: paymentData.amount,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      description: paymentData.description || `Pago de ${paymentData.taxType}`,
      status: 'PAGADO',
      paymentMethod: paymentData.paymentMethod,
      tellerName: user?.name || 'Sistema',
      metadata: paymentData.metadata
    };

    // Logic: Try Online, Fallback to Offline
    if (isOnline) {
      db.createTransaction(newTransaction).then(savedTx => {
        // Success online: just add to view if not already via realtime
        setTransactions(prev => {
          if (prev.some(t => t.id === savedTx.id)) return prev;
          return [savedTx, ...prev];
        });
      }).catch(e => {
        console.error("Error saving transaction online", e);
        // Fallback prompt
        if (confirm("Falló la conexión al servidor. ¿Guardar transacción en modo 'Sin Conexión' para sincronizar después?")) {
          saveOffline(newTransaction);
        }
      });
    } else {
      // Offline Mode
      saveOffline(newTransaction);
      alert("Transacción guardada localmente (Modo Offline). Recuerde sincronizar cuando tenga internet.");
    }

    return newTransaction;
  };

  const saveOffline = (tx: Transaction) => {
    const updatedPending = [...pendingSyncTransactions, tx];
    setPendingSyncTransactions(updatedPending);
    localStorage.setItem('sigma_offline_txs', JSON.stringify(updatedPending));

    // Also show it in the main list temporarily as "Local"
    setTransactions(prev => [tx, ...prev]);
  };

  const handleUpdateConfig = async (newConfig: TaxConfig) => {
    try {
      const updated = await db.updateConfig(newConfig);
      setConfig(updated);
    } catch (e) { console.error(e); }
  }

  const handleSimulateScraping = async () => {
    const newTaxpayer: Taxpayer = {
      id: `EXT-${Date.now()}`,
      taxpayerNumber: `EXT-${Math.floor(Math.random() * 90000)}`,
      type: TaxpayerType.JURIDICA,
      status: TaxpayerStatus.ACTIVO,
      commercialCategory: CommercialCategory.CLASE_B,
      docId: `${Math.floor(Math.random() * 1000)}-WEB`,
      dv: '00',
      name: 'Comercio Importado (Web Scraping)',
      address: 'Datos extraídos de Registro Público',
      phone: 'N/A',
      email: 'contacto@webscraper.net',
      createdAt: new Date().toISOString().split('T')[0],
      hasCommercialActivity: true,
      hasConstruction: false,
      hasGarbageService: false
    };
    await handleAddTaxpayer(newTaxpayer);
    return true;
  };

  const handleExcelBackup = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Prepare Taxpayers Data (Flatten and Format)
      const formattedTaxpayers = taxpayers.map(tp => ({
        "ID Sistema": tp.id,
        "N° Contribuyente": tp.taxpayerNumber,
        "Tipo": tp.type,
        "Estado Actual": tp.status,
        "Identificación (RUC/Cédula)": tp.docId,
        "Nombre / Razón Social": tp.name,
        "Dirección": tp.address,
        "Teléfono": tp.phone,
        "Email": tp.email,
        "Actividad Comercial": tp.hasCommercialActivity ? "SÍ" : "NO",
        "Nombre Comercial": tp.commercialName || "N/A",
        "Categoría Comercial": tp.commercialCategory,
        "Corregimiento": tp.corregimiento || "N/A",
        "Servicio Basura": tp.hasGarbageService ? "ACTIVO" : "NO",
        "Permiso Construcción": tp.hasConstruction ? "ACTIVO" : "NO",
        "Vehículos Registrados": tp.vehicles && tp.vehicles.length > 0
          ? tp.vehicles.map(v => `[${v.plate} - ${v.brand} ${v.model}]`).join(", ")
          : "Ninguno",
        "Fecha Registro": tp.createdAt
      }));

      const wsTaxpayers = XLSX.utils.json_to_sheet(formattedTaxpayers);
      // Auto-width for columns (simple approximation)
      const wscols = Object.keys(formattedTaxpayers[0] || {}).map(() => ({ wch: 25 }));
      wsTaxpayers['!cols'] = wscols;

      XLSX.utils.book_append_sheet(wb, wsTaxpayers, "Contribuyentes_Detallado");

      // 2. Prepare Transactions Data (Full History)
      const formattedTransactions = transactions.map(tx => {
        // Find related taxpayer name for clarity
        const relatedTp = taxpayers.find(t => t.id === tx.taxpayerId);

        return {
          "ID Transacción": tx.id,
          "Fecha": tx.date,
          "Hora": tx.time,
          "Contribuyente ID": tx.taxpayerId,
          "Contribuyente Nombre": relatedTp ? relatedTp.name : "Desconocido",
          "Tipo de Tasa": tx.taxType,
          "Descripción": tx.description,
          "Monto Pagado": tx.amount,
          "Método Pago": tx.paymentMethod,
          "Estado": tx.status,
          "Cajero": tx.tellerName
        };
      });

      const wsTransactions = XLSX.utils.json_to_sheet(formattedTransactions);
      wsTransactions['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 40 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, wsTransactions, "Historial_Pagos_Completo");

      // Generate File
      XLSX.writeFile(wb, `SIGMA_Respaldo_Completo_${new Date().toISOString().split('T')[0]}.xlsx`);
      alert("Respaldo Completo generado exitosamente.");
    } catch (error) {
      console.error("Error generating Excel backup:", error);
      alert("Error al generar el archivo Excel.");
    }
  };

  const handleExcelImport = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      let importedTaxpayers = 0;

      const taxpayersSheet = wb.Sheets["Contribuyentes"];
      if (taxpayersSheet) {
        const rawData = XLSX.utils.sheet_to_json(taxpayersSheet) as Taxpayer[];
        if (rawData && rawData.length > 0) {
          setTaxpayers(prev => {
            const map = new Map(prev.map(p => [p.id, p]));
            rawData.forEach(item => {
              if (item.id && item.name) {
                const existing = map.get(item.id);
                map.set(item.id, existing ? Object.assign({}, existing, item) : item);
              }
            });
            importedTaxpayers = rawData.length;
            return Array.from(map.values());
          });
        }
      }
      alert(`Importación Exitosa:\n- Contribuyentes procesados: ${importedTaxpayers}`);
    } catch (error) {
      console.error("Error importing Excel:", error);
      alert("Error al importar el archivo.");
    }
  };

  const renderContent = () => {
    switch (currentPage) {
      case 'dashboard':
        return (user?.role === 'ADMIN' || user?.role === 'AUDITOR') ? <Dashboard transactions={transactions} taxpayers={taxpayers} config={config} /> : null;
      case 'taxpayers':
        return (
          <Taxpayers
            taxpayers={taxpayers}
            transactions={transactions}
            onAdd={handleAddTaxpayer}
            onUpdate={handleUpdateTaxpayer}
            onDelete={handleDeleteTaxpayer}
            userRole={user?.role || 'CAJERO'}
            onCreateRequest={(req) => setAdminRequests(prev => [...prev, req])}
          />
        );
      case 'caja':
        return (
          <TaxCollection
            user={user}
            currentUser={user} // Pass as currentUser to match props
            taxpayers={taxpayers}
            transactions={transactions}
            config={config}
            onPayment={handlePayment}
            municipalityInfo={municipalityInfo}
            adminRequests={adminRequests}
            onCreateRequest={(req) => setAdminRequests(prev => [...prev, req])}
            onUpdateRequest={setAdminRequests}
          />
        );
      case 'cobros':
        return (
          <Debts
            taxpayers={taxpayers}
            transactions={transactions}
            onGoToPay={handleGoToPay}
            userRole={user?.role}
          />
        );
      case 'scanner':
        return user?.role === 'ADMIN' ? (
          <InvoiceScanner
            onScanComplete={(newTx) => setTransactions([newTx, ...transactions])}
          />
        ) : null;
      case 'reports':
        return (user?.role === 'ADMIN' || user?.role === 'AUDITOR') ? <Reports transactions={transactions} users={registeredUsers} currentUser={user} taxpayers={taxpayers} config={config} /> : null;
      case 'settings':
        return user?.role === 'ADMIN' ? (
          <Settings
            config={config}
            onUpdateConfig={handleUpdateConfig}
            municipalityInfo={municipalityInfo}
            onUpdateMunicipalityInfo={setMunicipalityInfo}
            users={registeredUsers}
            onCreateUser={handleCreateUser}
            onUpdateUser={handleUpdateUser}
            onSimulateScraping={handleSimulateScraping}
            onBackup={handleExcelBackup}
            onImport={handleExcelImport}
            taxpayers={taxpayers}
            transactions={transactions}
            onUpdateTaxpayer={handleUpdateTaxpayer}
          />
        ) : null;
      default:
        return <div className="p-10 text-center text-slate-500">Módulo en construcción: {currentPage}</div>;
    }
  };

  // Unified Rendering Logic

  if (!user) {
    // Stage 1: Landing Page (Default)
    if (appMode === 'LANDING') {
      return <Landing onNavigate={setAppMode} />;
    }

    // Stage 2: Unified Back Button
    const BackButton = () => (
      <button
        onClick={() => setAppMode('LANDING')}
        className="absolute top-4 left-4 flex items-center text-slate-500 hover:text-slate-800 transition-colors z-50 bg-white/80 backdrop-blur px-3 py-1 rounded-full shadow-sm"
      >
        <ArrowLeft size={16} className="mr-1" /> Volver al Inicio
      </button>
    );

    // Stage 3: Mode Specific Login
    if (appMode === 'PORTAL') {
      return (
        <div className="relative">
          <BackButton />
          <PortalLogin onLogin={handleLogin} taxpayers={taxpayers} />
        </div>
      );
    }

    // Default to ADMIN login
    return (
      <div className="relative">
        <BackButton />
        <Login onLogin={handleLogin} validUsers={registeredUsers} />
      </div>
    );
  }

  // LOGGED IN STATE ------------------------------------

  const isTaxpayerPortal = user?.role === 'CONTRIBUYENTE';


  if (isTaxpayerPortal) {
    const currentTaxpayer = taxpayers.find(t => t.docId === user.username);
    if (!currentTaxpayer) return <div>Error: Datos de contribuyente no encontrados. <button onClick={handleLogout}>Salir</button></div>;

    return (
      <TaxpayerPortal
        currentUser={user}
        taxpayer={currentTaxpayer}
        transactions={transactions}
        municipalityInfo={municipalityInfo}
        onPayment={handlePayment}
        onLogout={handleLogout}
      />
    );
  }

  if (user.role === 'ALCALDE') {
    return <AlcaldeDashboard user={user} onLogout={handleLogout} onCreateUser={handleCreateUser} />;
  }

  if (user.role === 'SECRETARIA') {
    return <SecretariaDashboard user={user} onLogout={handleLogout} />;
  }

  // Admin Dashboard View
  return (
    <div className="flex min-h-screen bg-slate-50 relative overflow-hidden">
      <Sidebar
        currentPage={currentPage}
        userRole={user.role}
        onNavigate={setCurrentPage}
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'overflow-hidden' : ''} md:ml-64 print:ml-0 print:w-full`}>

        <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-20 px-4 py-3 md:px-8 md:py-4 flex justify-between items-center print:hidden">
          <div className="flex items-center">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="mr-3 md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 active:scale-95 transition-transform"
            >
              <Menu size={24} />
            </button>

            <img
              src={`${import.meta.env.BASE_URL}sigma-logo-final.png`}
              alt="Logo"
              className="h-8 w-8 mr-3 object-contain md:hidden"
            />

            <div>
              <h2 className="text-lg md:text-xl font-semibold text-slate-800 leading-tight">
                {currentPage === 'dashboard' && 'Resumen Ejecutivo'}
                {currentPage === 'taxpayers' && 'Contribuyentes'}
                {currentPage === 'caja' && 'Caja Principal'}
                {currentPage === 'cobros' && 'Gestión de Cobros'}
                {currentPage === 'scanner' && 'Digitalización IA'}
                {currentPage === 'reports' && 'Reportes'}
                {currentPage === 'settings' && 'Ajustes'}
              </h2>
              <p className="text-[10px] md:text-xs text-slate-500 hidden md:block">SIGMA Changuinola • Bocas del Toro</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">

            {/* Admin Notifications Bell */}
            {user.role === 'ADMIN' && (
              <button
                onClick={() => setShowRequestsModal(true)}
                className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors mr-2"
                title="Autorizaciones Pendientes"
              >
                <Bell size={24} />
                {adminRequests.filter(r => r.status === 'PENDING').length > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">
                    {adminRequests.filter(r => r.status === 'PENDING').length}
                  </span>
                )}
              </button>
            )}

            {/* Status Indicator & Sync Button */}
            <div className="flex items-center mr-2 gap-3">
              <div className="flex items-center">
                {isOnline ? (
                  <Wifi className="text-emerald-500 h-5 w-5" title="Conectado" />
                ) : (
                  <WifiOff className="text-red-500 h-5 w-5" title="Sin Conexión" />
                )}
              </div>

              {pendingSyncTransactions.length > 0 && (
                <button
                  onClick={handleSync}
                  className="ml-2 flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs font-bold transition-colors animate-pulse"
                >
                  <RefreshCw size={14} />
                  <span>Sincronizar ({pendingSyncTransactions.length})</span>
                </button>
              )}
            </div>

            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-700">{user.name}</p>
              <p className="text-[10px] text-emerald-600 uppercase">{user.role}</p>
            </div>
            <div className={`h-8 w-8 md:h-10 md:w-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center font-bold text-white text-sm ${user.role === 'ADMIN' ? 'bg-indigo-600' : 'bg-emerald-600'
              }`}>
              {user.username.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8 overflow-x-hidden animate-fade-in print:p-0">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </main>

      {/* --- ADMIN REQUEST REVIEW MODAL --- */}
      {showRequestsModal && user.role === 'ADMIN' && (
        <AdminRequestModal
          requests={adminRequests}
          updateRequests={setAdminRequests}
          onClose={() => setShowRequestsModal(false)}
          allTransactions={transactions}
          updateTransactions={setTransactions}
          onUpdateTaxpayer={handleUpdateTaxpayer}
        />
      )}
    </div>
  );
}

// Sub-component for Admin Modal to handle internal state cleanly
const AdminRequestModal = ({ requests, updateRequests, onClose, allTransactions, updateTransactions, onUpdateTaxpayer }: {
  requests: AdminRequest[],
  updateRequests: (r: AdminRequest[]) => void,
  onClose: () => void,
  allTransactions: Transaction[],
  updateTransactions: (t: Transaction[]) => void,
  onUpdateTaxpayer: (tp: Taxpayer) => void
}) => {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleApprove = (req: AdminRequest, initial?: number, installments?: number) => {
    const updated = requests.map(r => r.id === req.id ? {
      ...r,
      status: 'APPROVED' as RequestStatus,
      approvedAmount: initial,
      approvedTotalDebt: req.totalDebt,
      installments: installments,
      responseNote: 'Aprobado'
    } : r);
    updateRequests(updated);
  };

  const handleVoidTransaction = (req: AdminRequest) => {
    // 1. Update Request
    const updatedReqs = requests.map(r => r.id === req.id ? { ...r, status: 'APPROVED' as RequestStatus, responseNote: 'Anulación Autorizada y Procesada' } : r);
    updateRequests(updatedReqs);

    // 2. Void Transaction if ID exists
    if (req.transactionId) {
      const txExists = allTransactions.find(t => t.id === req.transactionId);
      if (txExists) {
        const updatedTxs = allTransactions.map(t => t.id === req.transactionId ? { ...t, status: 'ANULADO' as 'ANULADO' } : t);
        updateTransactions(updatedTxs);
        // alert(`Transacción #${req.transactionId} marcada como ANULADA.`);
      } else {
        alert(`Advertencia: La transacción #${req.transactionId} no se encontró en el historial, pero la solicitud fue aprobada.`);
      }
    }
  };

  const handleUpdateTaxpayerApproval = (req: AdminRequest) => {
    if (req.payload && req.payload.id) {
      // Apply update
      onUpdateTaxpayer(req.payload as Taxpayer);
      // Update Request Status
      const updatedReqs = requests.map(r => r.id === req.id ? { ...r, status: 'APPROVED' as RequestStatus, responseNote: 'Edición de Contribuyente Aprobada' } : r);
      updateRequests(updatedReqs);
    } else {
      alert("Error: No hay datos adjuntos para actualizar.");
    }
  };

  const handleReject = () => {
    if (!rejectingId) return;
    const updated = requests.map(r => r.id === rejectingId ? {
      ...r,
      status: 'REJECTED' as RequestStatus,
      responseNote: rejectionReason || 'Rechazado sin motivo específico'
    } : r);
    updateRequests(updated);
    setRejectingId(null);
    setRejectionReason('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-fade-in">
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <h3 className="text-lg font-bold flex items-center">
            <Bell className="mr-2" size={20} /> Solicitudes de Autorización
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <ArrowLeft size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {requests.length === 0 ? (
            <div className="text-center py-10 text-slate-400">No hay solicitudes registradas.</div>
          ) : (
            [...requests].reverse().map(req => (
              <div key={req.id} className={`bg-white p-4 rounded-lg shadow-sm border-l-4 ${req.status === 'PENDING' ? 'border-amber-500' :
                req.status === 'APPROVED' ? 'border-emerald-500' : 'border-red-500'
                }`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${req.type === 'VOID_TRANSACTION' ? 'bg-red-100 text-red-700' : req.type === 'UPDATE_TAXPAYER' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                      {req.type === 'VOID_TRANSACTION' ? 'ANULACIÓN' : req.type === 'UPDATE_TAXPAYER' ? 'EDICIÓN DATOS' : 'ARREGLO DE PAGO'}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">{req.createdAt.split('T')[0]}</span>
                  </div>
                  <span className={`text-xs font-bold ${req.status === 'PENDING' ? 'text-amber-500' :
                    req.status === 'APPROVED' ? 'text-emerald-500' : 'text-red-500'
                    }`}>
                    {req.status === 'PENDING' ? 'PENDIENTE' : req.status === 'APPROVED' ? 'APROBADO' : 'RECHAZADO'}
                  </span>
                </div>

                <h4 className="font-bold text-slate-800">{req.taxpayerName}</h4>
                <div className="bg-slate-50 p-2 rounded mt-2 text-sm border border-slate-100">
                  <p className="font-semibold text-slate-600 mb-1">Detalle de Solicitud:</p>
                  <p className="text-slate-800"><span className="font-bold">{req.requesterName}:</span> {req.description}</p>
                  {req.transactionId && <p className="text-xs font-mono text-slate-500 mt-1">Ref: {req.transactionId}</p>}
                </div>

                {req.totalDebt && (
                  <div className="mt-2 text-sm bg-blue-50 p-2 rounded text-blue-800">
                    <span className="font-bold">Deuda Total a Negociar: B/. {req.totalDebt.toFixed(2)}</span>
                  </div>
                )}

                {req.type === 'UPDATE_TAXPAYER' && req.payload && (
                  <div className="mt-2 text-xs bg-purple-50 p-2 rounded border border-purple-100 text-purple-900">
                    <p className="font-bold mb-1">Datos Propuestos:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><span className="font-semibold">Nombre:</span> {req.payload.name}</li>
                      <li><span className="font-semibold">ID/RUC:</span> {req.payload.docId}</li>
                      <li><span className="font-semibold">Dirección:</span> {req.payload.address}</li>
                      <li><span className="font-semibold">Teléfono:</span> {req.payload.phone}</li>
                      {req.payload.corregimiento && <li><span className="font-semibold">Corregimiento:</span> {req.payload.corregimiento}</li>}
                      {req.payload.balance !== undefined && <li><span className="font-semibold">Balance:</span> {req.payload.balance}</li>}
                    </ul>
                  </div>
                )}

                {/* Actions if Pending */}
                {req.status === 'PENDING' && (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    {/* Rejection Form for this specific item */}
                    {rejectingId === req.id ? (
                      <div className="bg-red-50 p-3 rounded-lg animate-fade-in">
                        <label className="block text-xs font-bold text-red-700 mb-1">Motivo del Rechazo:</label>
                        <textarea
                          className="w-full text-sm p-2 border border-red-200 rounded mb-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                          placeholder="Indique por qué rechaza esta solicitud..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleReject}
                            className="flex-1 bg-red-600 text-white py-1 rounded text-xs font-bold hover:bg-red-700"
                          >
                            Confirmar Rechazo
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                            className="flex-1 bg-white text-slate-600 border border-slate-300 py-1 rounded text-xs font-bold hover:bg-slate-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Normal Action Buttons
                      <>
                        {req.type === 'PAYMENT_ARRANGEMENT' ? (
                          <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-500 uppercase">Configurar Acuerdo</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-slate-500">Abono Inicial (B/.)</label>
                                <input type="number" className="w-full border rounded p-1" placeholder="0.00"
                                  id={`approve-initial-${req.id}`}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Letras / Cuotas</label>
                                <input type="number" className="w-full border rounded p-1" placeholder="Ej. 12"
                                  id={`approve-installments-${req.id}`}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => {
                                  const initial = parseFloat((document.getElementById(`approve-initial-${req.id}`) as HTMLInputElement).value) || 0;
                                  const installments = parseInt((document.getElementById(`approve-installments-${req.id}`) as HTMLInputElement).value) || 12;
                                  handleApprove(req, initial, installments);
                                }}
                                className="flex-1 bg-emerald-600 text-white py-2 rounded font-bold text-xs hover:bg-emerald-700 flex items-center justify-center"
                              >
                                <CheckCircle size={14} className="mr-1" /> Aprobar
                              </button>
                              <button
                                onClick={() => setRejectingId(req.id)}
                                className="flex-1 bg-slate-100 text-slate-600 py-2 rounded font-bold text-xs hover:bg-slate-200 border border-slate-200 flex items-center justify-center"
                              >
                                <XCircle size={14} className="mr-1" /> Rechazar
                              </button>
                            </div>
                          </div>
                        ) : req.type === 'VOID_TRANSACTION' ? (
                          // VOID Logic
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleVoidTransaction(req)}
                              className="flex-1 bg-red-600 text-white py-2 rounded font-bold text-xs hover:bg-red-700 flex items-center justify-center"
                            >
                              <CheckCircle size={14} className="mr-1" /> Autorizar Anulación
                            </button>
                            <button
                              onClick={() => setRejectingId(req.id)}
                              className="bg-slate-100 text-slate-600 px-4 py-2 rounded font-bold text-xs hover:bg-slate-200 border border-slate-200 flex items-center justify-center"
                            >
                              <XCircle size={14} className="mr-1" /> Rechazar
                            </button>
                          </div>
                        ) : (
                          // UPDATE TAXPAYER Logic
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateTaxpayerApproval(req)}
                              className="flex-1 bg-emerald-600 text-white py-2 rounded font-bold text-xs hover:bg-emerald-700 flex items-center justify-center"
                            >
                              <CheckCircle size={14} className="mr-1" /> Aprobar Cambios
                            </button>
                            <button
                              onClick={() => setRejectingId(req.id)}
                              className="bg-slate-100 text-slate-600 px-4 py-2 rounded font-bold text-xs hover:bg-slate-200 border border-slate-200 flex items-center justify-center"
                            >
                              <XCircle size={14} className="mr-1" /> Rechazar
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* View Response if Processed */}
                {req.status !== 'PENDING' && (
                  <div className={`mt-2 p-2 text-xs rounded border ${req.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                    }`}>
                    <p className="font-bold flex items-center">
                      {req.status === 'APPROVED' ? <CheckCircle size={12} className="mr-1" /> : <XCircle size={12} className="mr-1" />}
                      Resolución: {req.responseNote}
                    </p>
                    {req.type === 'PAYMENT_ARRANGEMENT' && req.status === 'APPROVED' && (
                      <div className="mt-1 font-mono ml-4">
                        Abono: B/.{req.approvedAmount?.toFixed(2)} | Letras: {req.installments}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default App;