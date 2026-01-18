import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { PortalLogin } from './components/PortalLogin'; // Import Portal Login
import { usePersistentState } from './hooks/usePersistentState'; // Import Persistent Hook
import { Dashboard } from './pages/Dashboard';
import { Taxpayers } from './pages/Taxpayers';
import { TaxCollection } from './pages/TaxCollection';
import { Debts } from './pages/Debts'; // Import Debts Page
import { InvoiceScanner } from './pages/InvoiceScanner';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { INITIAL_CONFIG, MOCK_TAXPAYERS, MOCK_TRANSACTIONS } from './services/mockData';
import { TaxpayerPortal } from './pages/TaxpayerPortal'; // Import Portal
import { TaxConfig, Taxpayer, Transaction, User, MunicipalityInfo, TaxpayerType, CommercialCategory, TaxpayerStatus } from './types';
import { Menu } from 'lucide-react';
import { db } from './services/db';

// Initial Municipality Info
const INITIAL_MUNICIPALITY_INFO: MunicipalityInfo = {
  name: 'Municipio de Changuinola',
  province: 'Provincia de Bocas del Toro, República de Panamá',
  ruc: '1-22-333 DV 44',
  phone: '758-1234',
  email: 'tesoreria@changuinola.gob.pa',
  address: 'Ave. 17 de Abril, Changuinola'
};

// Initial Users
const INITIAL_USERS: User[] = [
  { username: 'director', name: 'Director Municipal', role: 'ADMIN', password: 'admin' },
  { username: 'recaudador', name: 'Oficial de Recaudación', role: 'CAJERO', password: 'cajero' }
];

function App() {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Global App State (Simulating Backend Database with Persistence)
  // Global App State (Fetched from Supabase)
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [municipalityInfo, setMunicipalityInfo] = usePersistentState<MunicipalityInfo>('sigma_municipality', INITIAL_MUNICIPALITY_INFO); // Keep local for now or move to DB config
  const [taxpayers, setTaxpayers] = useState<Taxpayer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [config, setConfig] = useState<TaxConfig>(INITIAL_CONFIG);

  // Loading State
  const [isLoading, setIsLoading] = useState(true);

  // Check navigation mode (Portal vs Admin)
  const [appMode, setAppMode] = useState<'ADMIN' | 'PORTAL'>('ADMIN');

  useEffect(() => {
    // Check URL params for mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'portal') {
      setAppMode('PORTAL');
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

        setRegisteredUsers(usersData);
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
  }, []);

  // State to handle passing taxpayer from Debts to Cashier
  const [selectedDebtTaxpayer, setSelectedDebtTaxpayer] = useState<Taxpayer | null>(null);

  // Close sidebar automatically on route change if on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [currentPage]);

  // Handlers
  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    // Set initial page based on role
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
  };

  const handleAddTaxpayer = async (newTp: Taxpayer) => {
    try {
      const created = await db.createTaxpayer(newTp);
      setTaxpayers([...taxpayers, created]);
    } catch (e) {
      console.error("Error creating taxpayer", e);
      alert("Error al guardar en base de datos");
    }
  };

  const handleUpdateTaxpayer = async (updatedTp: Taxpayer) => {
    try {
      const updated = await db.updateTaxpayer(updatedTp);
      setTaxpayers(taxpayers.map(tp => tp.id === updated.id ? updated : tp));
    } catch (e) {
      console.error("Error updating taxpayer", e);
      alert("Error al actualizar en base de datos");
    }
  };

  const handleDeleteTaxpayer = async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar este contribuyente? Esta acción no se puede deshacer.')) {
      try {
        await db.deleteTaxpayer(id);
        setTaxpayers(taxpayers.filter(tp => tp.id !== id));
      } catch (e) {
        console.error("Error deleting", e);
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
      time: new Date().toLocaleTimeString(),
      description: paymentData.description || `Pago de ${paymentData.taxType}`,
      status: 'PAGADO',
      paymentMethod: paymentData.paymentMethod,
      tellerName: user?.name || 'Sistema',
      metadata: paymentData.metadata
    };

    // Save to DB
    db.createTransaction(newTransaction).then(savedTx => {
      setTransactions([savedTx, ...transactions]);
    }).catch(e => console.error("Error saving transaction", e));

    return newTransaction; // Return to show in invoice
  };

  const handleUpdateConfig = async (newConfig: TaxConfig) => {
    try {
      const updated = await db.updateConfig(newConfig);
      setConfig(updated);
    } catch (e) { console.error(e); }
  }


  // --- DATA MANAGEMENT HANDLERS (Excel Backup/Import) ---
  const handleSimulateScraping = async () => {
    const newTaxpayer: Taxpayer = {
      id: `EXT-${Date.now()}`, // Temporary ID, DB will generate UUID if we stripped it, but our logic handles it
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
      const wsTaxpayers = XLSX.utils.json_to_sheet(taxpayers);
      XLSX.utils.book_append_sheet(wb, wsTaxpayers, "Contribuyentes");
      const wsTransactions = XLSX.utils.json_to_sheet(transactions);
      XLSX.utils.book_append_sheet(wb, wsTransactions, "Transacciones");
      XLSX.writeFile(wb, `SIGMA_Respaldo_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      let importedTransactions = 0;

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
        return user?.role === 'ADMIN' ? <Dashboard transactions={transactions} taxpayerCount={taxpayers.length} /> : null;
      case 'taxpayers':
        return (
          <Taxpayers
            taxpayers={taxpayers}
            transactions={transactions}
            onAdd={handleAddTaxpayer}
            onUpdate={handleUpdateTaxpayer}
            onDelete={handleDeleteTaxpayer}
            userRole={user?.role || 'CAJERO'}
          />
        );
      case 'caja': // Renamed from collection
        return (
          <TaxCollection
            taxpayers={taxpayers}
            config={config}
            onPayment={handlePayment}
            currentUser={user!}
            municipalityInfo={municipalityInfo}
            initialTaxpayer={selectedDebtTaxpayer} // Pass pre-selected from Debts page
          />
        );
      case 'cobros': // New Page
        return (
          <Debts
            taxpayers={taxpayers}
            transactions={transactions}
            onGoToPay={handleGoToPay}
          />
        );
      case 'scanner':
        return user?.role === 'ADMIN' ? <InvoiceScanner /> : null;
      case 'reports':
        return user?.role === 'ADMIN' ? <Reports transactions={transactions} /> : null;
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
          />
        ) : null;
      default:
        return <div className="p-10 text-center text-slate-500">Módulo en construcción: {currentPage}</div>;
    }
  };

  // Determine if user is a taxpayer to show Portal exclusively
  const isTaxpayerPortal = user?.role === 'CONTRIBUYENTE';

  if (!user) {
    if (appMode === 'PORTAL') {
      return <PortalLogin onLogin={handleLogin} taxpayers={taxpayers} />;
    }
    return <Login onLogin={handleLogin} validUsers={registeredUsers} />;
  }

  if (isTaxpayerPortal) {
    // Find the actual taxpayer data object based on the login session
    // For demo, we matched username to docId in Login.tsx
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
              src="/sigma-logo.png"
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
    </div>
  );
}

export default App;