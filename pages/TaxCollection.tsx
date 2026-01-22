import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Taxpayer, TaxConfig, TaxType, CommercialCategory, PaymentMethod, Transaction, User, MunicipalityInfo } from '../types';
import { Car, Building2, Trash2, Store, CreditCard, Search, Banknote, Printer, CheckCircle, X, ArrowLeft, Save, User as UserIcon, MapPin, Download, AlertCircle, Lock } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TaxCollectionProps {
  taxpayers: Taxpayer[];
  transactions: Transaction[];
  config: TaxConfig;
  onPayment: (data: any) => Transaction;
  currentUser: User;
  municipalityInfo: MunicipalityInfo;
  initialTaxpayer?: Taxpayer | null; // Optional prop to pre-fill

  // New props for Requests
  adminRequests?: AdminRequest[];
  onCreateRequest?: (req: AdminRequest) => void;
  onUpdateRequest?: (requests: AdminRequest[]) => void;
}
import { AdminRequest, RequestType } from '../types';

export const TaxCollection: React.FC<TaxCollectionProps> = ({ taxpayers, transactions, config, onPayment, currentUser, municipalityInfo, initialTaxpayer, adminRequests = [], onCreateRequest, onUpdateRequest }) => {
  const [selectedTax, setSelectedTax] = useState<TaxType>(TaxType.VEHICULO);
  const [selectedTaxpayerId, setSelectedTaxpayerId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const activeTaxpayer = taxpayers.find(t => t.id === selectedTaxpayerId);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.EFECTIVO);

  // Specific Form States
  const [plateNumber, setPlateNumber] = useState('');
  const [constArea, setConstArea] = useState(0);
  const [trashType, setTrashType] = useState('RESIDENCIAL');

  // Invoice State
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Request Management State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newRequestType, setNewRequestType] = useState<RequestType>('VOID_TRANSACTION');
  const [newRequestDesc, setNewRequestDesc] = useState('');
  const [newRequestAmount, setNewRequestAmount] = useState(0); // For Arrangement Debt
  const [requestTargetId, setRequestTargetId] = useState(''); // Transaction ID for void

  // Logic to load Approved Arrangement
  const [loadedArrangement, setLoadedArrangement] = useState<AdminRequest | null>(null);

  // Pre-fill from props if available
  useEffect(() => {
    if (initialTaxpayer) {
      setSelectedTaxpayerId(initialTaxpayer.id);
      // Try to guess tax type based on flags
      if (initialTaxpayer.hasCommercialActivity) setSelectedTax(TaxType.COMERCIO);
      else if (initialTaxpayer.hasGarbageService) setSelectedTax(TaxType.BASURA);
      else if (initialTaxpayer.vehicles && initialTaxpayer.vehicles.length > 0) setSelectedTax(TaxType.VEHICULO);
    }
  }, [initialTaxpayer]);

  // --- DEBT CALCULATION LOGIC (Consolidated View) ---
  const taxpayerDebts = useMemo(() => {
    if (!activeTaxpayer) return [];
    const debts: any[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // 1. Balance / Historical
    if ((activeTaxpayer.balance || 0) > 0) {
      debts.push({
        id: 'balance',
        type: 'DEUDA_HISTORICA',
        label: 'Saldo Pendiente / Arrastre',
        amount: activeTaxpayer.balance,
        description: `Saldo Pendiente Acumulado`,
        isPriority: true
      });
    }

    // 2. Commercial
    if (activeTaxpayer.hasCommercialActivity && activeTaxpayer.status !== 'BLOQUEADO') {
      const hasPaid = transactions.some(t =>
        t.taxpayerId === activeTaxpayer.id &&
        t.taxType === TaxType.COMERCIO &&
        t.status === 'PAGADO' &&
        new Date(t.date).getMonth() + 1 === currentMonth &&
        new Date(t.date).getFullYear() === currentYear
      );
      if (!hasPaid) {
        const amount = activeTaxpayer.commercialCategory ? config.commercialRates[activeTaxpayer.commercialCategory] : config.commercialBaseRate;
        debts.push({
          id: `com-${currentMonth}-${currentYear}`,
          type: TaxType.COMERCIO,
          label: `Impuesto Comercial - Mes Actual`,
          amount: amount || 0,
          description: `Impuesto Comercial (${activeTaxpayer.commercialCategory})`,
          metadata: { month: currentMonth, year: currentYear }
        });
      }
    }

    // 3. Garbage
    if (activeTaxpayer.hasGarbageService && activeTaxpayer.status !== 'BLOQUEADO') {
      const hasPaid = transactions.some(t =>
        t.taxpayerId === activeTaxpayer.id &&
        t.taxType === TaxType.BASURA &&
        t.status === 'PAGADO' &&
        new Date(t.date).getMonth() + 1 === currentMonth &&
        new Date(t.date).getFullYear() === currentYear
      );
      if (!hasPaid) {
        // Simple logic for rate based on type logic in portal/debts
        const rate = activeTaxpayer.type === 'JURIDICA' ? config.garbageCommercialRate : config.garbageResidentialRate;
        debts.push({
          id: `bas-${currentMonth}-${currentYear}`,
          type: TaxType.BASURA,
          label: `Tasa de Aseo - Mes Actual`,
          amount: rate,
          description: 'Tasa de Aseo / Basura',
          metadata: { month: currentMonth, year: currentYear }
        });
      }
    }

    // 4. Vehicles
    if (activeTaxpayer.vehicles && activeTaxpayer.vehicles.length > 0) {
      activeTaxpayer.vehicles.forEach(v => {
        const hasPaid = transactions.some(t =>
          t.taxpayerId === activeTaxpayer.id &&
          t.taxType === TaxType.VEHICULO &&
          t.metadata?.plateNumber === v.plate &&
          new Date(t.date).getFullYear() === currentYear
        );
        if (!hasPaid) {
          debts.push({
            id: `veh-${v.plate}-${currentYear}`,
            type: TaxType.VEHICULO,
            label: `Impuesto Vehicular (Placa ${v.plate})`,
            amount: config.plateCost,
            description: `Impuesto de Circulación - Placa ${v.plate}`,
            metadata: { plateNumber: v.plate, year: currentYear }
          });
        }
      });
    }

    return debts;
  }, [activeTaxpayer, transactions, config]);

  const handlePayDebtItem = (debt: any) => {
    const tx = onPayment({
      taxType: debt.type === 'DEUDA_HISTORICA' ? TaxType.COMERCIO : debt.type, // Fallback tax type
      taxpayerId: selectedTaxpayerId,
      amount: debt.amount,
      paymentMethod: paymentMethod,
      description: debt.description,
      metadata: debt.metadata
    });
    setLastTransaction(tx);
    setShowInvoice(true);
  };

  const filteredTaxpayers = searchTerm.length > 0
    ? taxpayers.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.docId.includes(searchTerm) ||
      t.taxpayerNumber?.includes(searchTerm)
    )
    : [];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectTaxpayer = (tp: Taxpayer) => {
    setSelectedTaxpayerId(tp.id);
    setSearchTerm(''); // Clear search to hide dropdown
    setShowDropdown(false);
  };

  const handleClearSelection = () => {
    setSelectedTaxpayerId('');
    setSearchTerm('');
    setPlateNumber('');
    setConstArea(0);
  };

  const calculateTotal = () => {
    switch (selectedTax) {
      case TaxType.VEHICULO:
        return config.plateCost;
      case TaxType.CONSTRUCCION:
        return constArea * config.constructionRatePerSqm;
      case TaxType.BASURA:
        return trashType === 'RESIDENCIAL' ? config.garbageResidentialRate : config.garbageCommercialRate;
      case TaxType.COMERCIO:
        if (activeTaxpayer?.commercialCategory) {
          return config.commercialRates[activeTaxpayer.commercialCategory] || 0;
        }
        return config.commercialBaseRate;
      default:
        return 0;
    }
  };

  const getTaxDescription = () => {
    if (selectedTax === TaxType.VEHICULO) return `Impuesto de Circulación Vehicular - Placa ${plateNumber}`;
    if (selectedTax === TaxType.CONSTRUCCION) return `Permiso de Construcción (${constArea} m²)`;
    if (selectedTax === TaxType.BASURA) return `Tasa de Aseo - ${trashType}`;
    if (selectedTax === TaxType.COMERCIO) {
      const cat = activeTaxpayer?.commercialCategory;
      const label = cat === CommercialCategory.CLASE_A ? 'Clase A' : cat === CommercialCategory.CLASE_B ? 'Clase B' : 'Clase C';
      return `Impuesto Comercial Mensual (${label})`;
    }
    return 'Impuesto Municipal';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaxpayerId) return;

    const amount = calculateTotal();
    if (selectedTax === TaxType.COMERCIO && amount === 0) {
      alert("Este contribuyente no tiene una categoría comercial asignada.");
      return;
    }

    const tx = onPayment({
      taxType: selectedTax,
      taxpayerId: selectedTaxpayerId,
      amount: amount,
      paymentMethod: paymentMethod,
      description: getTaxDescription(),
      metadata: { plateNumber, constArea, trashType }
    });

    setLastTransaction(tx);
    setShowInvoice(true);
  };

  const handleFinishCollection = () => {
    setShowInvoice(false);
    setPlateNumber('');
    setConstArea(0);
    setSearchTerm('');
    setSelectedTaxpayerId('');
    setPaymentMethod(PaymentMethod.EFECTIVO);
  };

  const printInvoice = () => {
    window.print();
  };

  const downloadPDF = async () => {
    const element = document.getElementById('invoice-modal-content');
    if (!element) return;

    setIsGeneratingPdf(true);

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        ignoreElements: (el) => el.classList.contains('no-print'),
        backgroundColor: '#ffffff',
      });

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // Scale to fit nicely with margins if needed, but centering usually works
      let finalHeight = imgHeight;
      let finalWidth = pdfWidth;

      // Ensure it fits vertically as well
      if (imgHeight > pdfHeight) {
        finalHeight = pdfHeight;
        finalWidth = (imgProps.width * pdfHeight) / imgProps.height;
      }

      // Add small margin (e.g. 10mm) logic if you want, 
      // but fitting to width in Landscape usually minimizes nicely
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      pdf.save(`Recibo_${lastTransaction?.id}.pdf`);

    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error al generar el PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDailyClosing = () => {
    const today = new Date().toISOString().split('T')[0];
    const myTxs = transactions.filter(t => t.date === today && t.tellerName === currentUser.name);

    if (myTxs.length === 0) {
      alert("No hay transacciones registradas hoy para generar el cierre.");
      return;
    }

    const total = myTxs.reduce((acc, t) => acc + t.amount, 0);

    // Reuse similar logic to Reports but simplified for immediate download
    const pdf = new jsPDF();

    // Header
    pdf.setFontSize(20);
    pdf.text("Cierre de Caja Diario (Cajero)", 105, 20, { align: 'center' });

    pdf.setFontSize(12);
    pdf.text(`Fecha: ${today}`, 20, 35);
    pdf.text(`Cajero: ${currentUser.name}`, 20, 42);
    pdf.text(`Sucursal: Changuinola Principal`, 20, 49);

    // Summary
    pdf.setDrawColor(0);
    pdf.setFillColor(240, 240, 240);
    pdf.rect(140, 30, 50, 20, 'F');
    pdf.setFontSize(10);
    pdf.text("Total Recaudado:", 145, 38);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`B/. ${total.toFixed(2)}`, 145, 45);

    // Table
    let y = 65;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("Hora", 20, y);
    pdf.text("ID", 40, y);
    pdf.text("Descripción", 80, y);
    pdf.text("Método", 150, y);
    pdf.text("Monto", 180, y);

    pdf.line(20, y + 2, 190, y + 2);
    y += 8;

    pdf.setFont("helvetica", "normal");
    myTxs.forEach(t => {
      if (y > 280) { pdf.addPage(); y = 20; }
      pdf.text(t.time, 20, y);
      pdf.text(t.id, 40, y);
      const desc = t.description.length > 30 ? t.description.substring(0, 30) + '...' : t.description;
      pdf.text(desc, 80, y);
      pdf.text(t.paymentMethod, 150, y);
      pdf.text(t.amount.toFixed(2), 190, y, { align: 'right' });
      y += 7;
    });

    pdf.line(20, y, 190, y);
    y += 10;

    pdf.setFont("helvetica", "bold");
    pdf.text("Firma del Cajero: __________________________", 20, y + 20);

    pdf.save(`Cierre_Caja_${currentUser.username}_${today}.pdf`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">

      {/* --- INVOICE MODAL (COMPACT & OPTIMIZED) --- */}
      {showInvoice && lastTransaction && activeTaxpayer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <style>{`
                @media print {
                    @page { size: landscape; margin: 0; }
                    body * { visibility: hidden; }
                    #invoice-modal-content, #invoice-modal-content * { visibility: visible; }
                    #invoice-modal-content { 
                        position: absolute; left: 50%; top: 50%; 
                        transform: translate(-50%, -50%) scale(0.9); /* Scale down slightly to ensure fit */
                        width: 100%; max-width: 900px;
                        margin: 0; padding: 0; box-shadow: none; border: none; 
                    }
                    .no-print { display: none !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
            `}</style>

          <div id="invoice-modal-content" className="bg-white shadow-2xl w-full max-w-4xl rounded-lg overflow-hidden flex flex-col">

            {/* Invoice Header - Compact */}
            <div className="bg-white p-6 md:p-8 pb-4">
              {/* New Top Centered Municipal Logo */}
              <div className="flex justify-center mb-6">
                <img
                  src={`${import.meta.env.BASE_URL}municipio-logo-bw.png`}
                  alt="Escudo Municipal"
                  className="h-32 object-contain grayscale"
                />
              </div>

              <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-4">
                <div className="flex items-center gap-4">
                  <div>
                    <h1 className="text-xl font-extrabold uppercase text-slate-900 leading-none">{municipalityInfo.name}</h1>
                    <p className="text-xs text-slate-600 font-medium mt-1">{municipalityInfo.province}</p>
                    <p className="text-xs text-slate-600">RUC: {municipalityInfo.ruc} • {municipalityInfo.phone}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-bold uppercase tracking-wider text-slate-800">Recibo de Caja</h2>
                  <p className="font-mono text-base font-bold text-red-600">#{lastTransaction.id}</p>
                  <p className="text-xs text-slate-500">{lastTransaction.date} {lastTransaction.time}</p>
                </div>
              </div>

              {/* Content - Two Columns Compact */}
              <div className="flex flex-row gap-6">
                {/* Left: Taxpayer */}
                <div className="w-1/3 border-r border-slate-200 pr-4">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Recibimos de:</p>
                  <p className="font-bold text-base text-slate-900 leading-tight mb-1">{activeTaxpayer.name}</p>
                  <p className="text-xs font-mono text-slate-600 mb-2">ID: {activeTaxpayer.docId}</p>
                  <p className="text-xs text-slate-500">{activeTaxpayer.address}</p>
                </div>

                {/* Right: Details */}
                <div className="w-2/3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500 uppercase">
                        <th className="py-1">Concepto</th>
                        <th className="py-1 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-2 pr-2">
                          <p className="font-bold text-slate-800">{lastTransaction.description}</p>
                          <div className="text-xs text-slate-500 mt-1">
                            {lastTransaction.metadata?.plateNumber && `Placa: ${lastTransaction.metadata.plateNumber} | `}
                            {lastTransaction.metadata?.trashType && `Tipo: ${lastTransaction.metadata.trashType} | `}
                            Método: {lastTransaction.paymentMethod}
                          </div>
                        </td>
                        <td className="py-2 text-right font-bold text-lg text-slate-800 align-top">
                          B/. {lastTransaction.amount.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Bar Compact */}
              <div className="mt-4 flex justify-end">
                <div className="bg-slate-100 px-6 py-2 rounded flex items-center gap-4 border border-slate-200">
                  <span className="text-sm font-bold text-slate-600">TOTAL PAGADO</span>
                  <span className="text-xl font-bold text-slate-900">B/. {lastTransaction.amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Footer Compact */}
              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-end">
                <div className="text-[10px] text-slate-400 max-w-xs leading-tight">
                  Este recibo es comprobante de pago oficial. Conserve para reclamos.
                </div>
                <div className="text-center">
                  <div className="border-b border-slate-300 w-32 mb-1"></div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Cajero: {lastTransaction.tellerName}</p>
                </div>
              </div>
            </div>

            {/* Action Bar (Hidden in Print) */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3 no-print">
              <button
                onClick={downloadPDF}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all"
              >
                <Download size={16} /> {isGeneratingPdf ? '...' : 'PDF'}
              </button>
              <button onClick={printInvoice} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">
                <Printer size={16} /> Imprimir
              </button>
              <button onClick={handleFinishCollection} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">
                <ArrowLeft size={16} /> Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-800">Caja Principal</h2>
          <p className="text-slate-500 text-sm">Procesamiento de pagos y emisión de recibos.</p>
        </div>
        <button
          onClick={handleDailyClosing}
          className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-900 transition-colors shadow-sm"
        >
          <Download size={16} />
          Cierre del Día
        </button>
      </div>

      {/* --- SEARCH --- */}
      <div className="relative z-20" ref={searchContainerRef}>
        {!activeTaxpayer ? (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-4 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-lg shadow-sm"
              placeholder="Buscar Contribuyente..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />

            {showDropdown && searchTerm.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto z-50">
                {filteredTaxpayers.map((tp) => (
                  <div
                    key={tp.id}
                    onClick={() => handleSelectTaxpayer(tp)}
                    className="p-4 hover:bg-emerald-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
                  >
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-slate-800">{tp.name}</p>
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-mono font-bold">#{tp.taxpayerNumber || 'N/A'}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">ID: {tp.docId}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 text-white shadow-lg flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-2 rounded-full"><UserIcon size={24} className="text-emerald-400" /></div>
              <div>
                <h3 className="font-bold text-lg leading-none">{activeTaxpayer.name}</h3>
                <p className="text-xs text-slate-300 mt-1 font-mono">
                  <span className="text-emerald-400 font-bold mr-2">#{activeTaxpayer.taxpayerNumber || 'N/A'}</span>
                  ID: {activeTaxpayer.docId}
                </p>
              </div>
            </div>
            <button onClick={handleClearSelection} className="bg-white/10 hover:bg-white/20 p-2 rounded text-white"><X size={20} /></button>
          </div>
        )}

        {/* --- DEBT SUMMARY AND ALERTS (PAZ Y SALVO BLOCK) --- */}
        {activeTaxpayer && (
          <div className="mt-4 mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border ${taxpayerDebts.length > 0 ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
              <p className="text-xs uppercase font-bold opacity-70 mb-1">Estado de Cuenta</p>
              <div className="flex items-center gap-2">
                {taxpayerDebts.length > 0 ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                <span className="font-bold text-lg">{taxpayerDebts.length > 0 ? `${taxpayerDebts.length} Deuda(s) Pendiente(s)` : 'Paz y Salvo'}</span>
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-end p-4">
              {taxpayerDebts.length === 0 ? (
                <button
                  onClick={() => alert("Generando Paz y Salvo... (Funcionalidad Simulada: Se imprimiría el PDF)")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 transition-transform active:scale-95"
                >
                  <CheckCircle size={20} /> Generar Paz y Salvo
                </button>
              ) : (
                <div className="flex items-center gap-2 text-red-500 bg-white px-4 py-2 rounded-lg border border-red-100 shadow-sm">
                  <Lock size={16} />
                  <span className="font-bold text-sm">Paz y Salvo Bloqueado: Contribuyente Moroso</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- DEBTS LIST (SEPARATE PAYMENTS) --- */}
      {
        activeTaxpayer && taxpayerDebts.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden mb-6 animate-fade-in relative z-10">
            <div className="bg-red-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <AlertCircle size={20} /> Deudas Pendientes
              </h3>
              <span className="text-xs bg-white/20 px-2 py-1 rounded font-mono">Total: B/. {taxpayerDebts.reduce((acc, d) => acc + (d.amount || 0), 0).toFixed(2)}</span>
            </div>
            <div className="p-0">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Concepto</th>
                    <th className="px-6 py-3 text-right">Monto</th>
                    <th className="px-6 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {taxpayerDebts.map((debt, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{debt.label}</p>
                        <p className="text-xs text-slate-500">{debt.description}</p>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        B/. {debt.amount?.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handlePayDebtItem(debt)}
                          className="bg-slate-900 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"
                        >
                          Pagar Item
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
      <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 transition-opacity ${!activeTaxpayer ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>

        <div className="mb-6">
          <label className="block text-sm font-bold text-slate-700 mb-3">Tipo de Impuesto</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { id: TaxType.VEHICULO, label: 'Placa', icon: Car },
              { id: TaxType.CONSTRUCCION, label: 'Construcción', icon: Building2 },
              { id: TaxType.BASURA, label: 'Basura', icon: Trash2 },
              { id: TaxType.COMERCIO, label: 'Comercio', icon: Store },
            ].map((tax) => {
              const Icon = tax.icon;
              return (
                <button
                  key={tax.id}
                  type="button"
                  onClick={() => setSelectedTax(tax.id)}
                  className={`p-3 rounded-lg border flex flex-col items-center justify-center transition-all h-20 ${selectedTax === tax.id
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
                    : 'border-slate-200 hover:border-emerald-300'
                    }`}
                >
                  <Icon size={20} className="mb-1" />
                  <span className="text-xs font-bold">{tax.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Dynamic Fields */}
          {selectedTax === TaxType.VEHICULO && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Número de Placa</label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg uppercase font-mono text-lg text-center focus:ring-2 focus:ring-emerald-500"
                placeholder="AB-1234"
              />
            </div>
          )}

          {selectedTax === TaxType.CONSTRUCCION && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Metros Cuadrados</label>
              <input
                type="number"
                min="1"
                required
                value={constArea}
                onChange={(e) => setConstArea(Number(e.target.value))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg text-lg focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-right mt-1 text-slate-500">Tasa: B/. {config.constructionRatePerSqm}/m²</p>
            </div>
          )}

          {selectedTax === TaxType.BASURA && (
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tarifa</label>
              <select
                value={trashType}
                onChange={(e) => setTrashType(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="RESIDENCIAL">Residencial (B/. {config.garbageResidentialRate.toFixed(2)})</option>
                <option value="COMERCIAL">Comercial (B/. {config.garbageCommercialRate.toFixed(2)})</option>
              </select>
            </div>
          )}

          {selectedTax === TaxType.COMERCIO && (
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 text-center">
              <p className="text-xs text-indigo-800 font-bold uppercase mb-1">Categoría Registrada</p>
              <p className="text-xl font-bold text-indigo-600">
                {activeTaxpayer?.commercialCategory?.replace('_', ' ') || 'N/A'}
              </p>
            </div>
          )}

          <div className="flex justify-between items-center bg-slate-800 text-white p-4 rounded-lg">
            <span className="font-medium text-sm">Total a Pagar</span>
            <span className="font-mono text-2xl font-bold">B/. {calculateTotal().toFixed(2)}</span>
          </div>

          <button
            type="submit"
            disabled={!selectedTaxpayerId || calculateTotal() === 0}
            className="w-full py-4 rounded-lg bg-emerald-600 text-white font-bold text-lg hover:bg-emerald-700 shadow-lg active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            COBRAR AHORA
          </button>

          <button
            type="button"
            onClick={() => setShowRequestModal(true)}
            className="w-full py-3 rounded-lg bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition-all text-sm mt-3 border border-slate-300"
          >
            SOLICITAR AUTORIZACIÓN / DESCOBRO
          </button>
        </form>
      </div>

      {/* --- REQUEST AUTHORIZATION MODAL --- */}
      {
        showRequestModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-scale-up">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Solicitar Autorización Administrativa</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Solicitud</label>
                  <select
                    className="w-full border rounded p-2"
                    value={newRequestType}
                    onChange={(e) => setNewRequestType(e.target.value as RequestType)}
                  >
                    <option value="VOID_TRANSACTION">Anulación / Descobro</option>
                    <option value="PAYMENT_ARRANGEMENT">Arreglo de Pago</option>
                  </select>
                </div>

                {newRequestType === 'VOID_TRANSACTION' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">ID de Transacción (Recibo)</label>
                    <input
                      type="text"
                      className="w-full border rounded p-2"
                      placeholder="Ej. TX-123456"
                      value={requestTargetId}
                      onChange={(e) => setRequestTargetId(e.target.value)}
                    />
                  </div>
                )}

                {newRequestType === 'PAYMENT_ARRANGEMENT' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Monto Total de la Deuda</label>
                    <input
                      type="number"
                      className="w-full border rounded p-2"
                      placeholder="0.00"
                      value={newRequestAmount}
                      onChange={(e) => setNewRequestAmount(parseFloat(e.target.value))}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Motivo / Descripción</label>
                  <textarea
                    className="w-full border rounded p-2 h-24"
                    placeholder="Explique la razón de la solicitud..."
                    value={newRequestDesc}
                    onChange={(e) => setNewRequestDesc(e.target.value)}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowRequestModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2 rounded hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (onCreateRequest) {
                        const selectedTaxpayer = taxpayers.find(t => t.id === selectedTaxpayerId);
                        const req: AdminRequest = {
                          id: `REQ-${Date.now()}`,
                          type: newRequestType,
                          status: 'PENDING',
                          requesterName: currentUser.name || 'Cajero',
                          taxpayerName: selectedTaxpayer?.name || 'Desconocido',
                          description: newRequestDesc,
                          transactionId: requestTargetId,
                          totalDebt: newRequestType === 'PAYMENT_ARRANGEMENT' ? newRequestAmount : undefined,
                          createdAt: new Date().toISOString()
                        };
                        onCreateRequest(req);
                        setShowRequestModal(false);
                        setNewRequestDesc('');
                        setNewRequestAmount(0);
                        setRequestTargetId('');
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  >
                    Enviar Solicitud
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* --- CASHIER NOTIFICATIONS / REQUEST STATUS --- */}
      {
        adminRequests.filter(r => r.status !== 'ARCHIVED').length > 0 && (
          <div className="fixed bottom-4 right-4 z-40 max-w-sm w-full">
            <div className="bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[500px]">
              <div className="bg-slate-800 text-white p-3 flex justify-between items-center cursor-pointer" onClick={() => {/* Toggle collapse could go here */ }}>
                <h4 className="font-bold text-sm flex items-center">
                  <Banknote className="mr-2" size={16} /> Estado de Solicitudes
                </h4>
                <span className="bg-slate-700 text-xs px-2 py-0.5 rounded-full">{adminRequests.filter(r => r.status !== 'ARCHIVED').length}</span>
              </div>

              <div className="p-2 bg-slate-50 overflow-y-auto space-y-2">
                {[...adminRequests].filter(r => r.status !== 'ARCHIVED').reverse().map(req => (
                  <div key={req.id} className={`p-3 rounded-lg border text-sm shadow-sm relative group ${req.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' :
                    req.status === 'REJECTED' ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'
                    }`}>
                    {/* DISMISS BUTTON FOR PROCESSED REQUESTS */}
                    {req.status !== 'PENDING' && (
                      <button
                        onClick={() => {
                          if (onUpdateRequest) {
                            onUpdateRequest(adminRequests.map(r => r.id === req.id ? { ...r, status: 'ARCHIVED' as any } : r)); // Cast to any or update type if possible, or just filter locally if no persist
                          }
                        }}
                        className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 bg-white/50 rounded-full p-1"
                        title="Ocultar notificación"
                      >
                        <X size={14} />
                      </button>
                    )}

                    <div className="flex justify-between items-start mb-1 pr-6">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${req.type === 'VOID_TRANSACTION' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'
                        }`}>
                        {req.type === 'VOID_TRANSACTION' ? 'Anulación' : 'Arreglo'}
                      </span>
                      <span className={`text-[10px] font-bold ${req.status === 'APPROVED' ? 'text-emerald-600' :
                        req.status === 'REJECTED' ? 'text-red-600' : 'text-amber-500'
                        }`}>
                        {req.status === 'PENDING' ? 'EN ESPERA' : req.status}
                      </span>
                    </div>
                    <p className="font-bold text-slate-700 truncate">{req.taxpayerName}</p>

                    {/* APPROVED ACTIONS */}
                    {req.status === 'APPROVED' && (
                      <div className="mt-2 animate-fade-in">
                        <p className="text-xs text-emerald-700 mb-2 font-medium">{req.responseNote || 'Solicitud Aprobada'}</p>
                        {req.type === 'PAYMENT_ARRANGEMENT' ? (
                          <button
                            onClick={() => {
                              setLoadedArrangement(req);
                              const tp = taxpayers.find(t => t.name === req.taxpayerName);
                              if (tp) setSelectedTaxpayerId(tp.id);
                              setPaymentMethod(PaymentMethod.ARREGLO_PAGO as any);
                              alert(`CARGANDO ARREGLO DE PAGO\n-------------------------\nAbono Inicial: B/. ${req.approvedAmount?.toFixed(2)}\nLetras: ${req.installments}\nTotal Deuda: B/. ${req.approvedTotalDebt?.toFixed(2)}`);
                              // Auto-dismiss after loading? Maybe not, let user dismiss.
                            }}
                            className="w-full bg-emerald-600 text-white text-xs font-bold py-2 rounded hover:bg-emerald-700 shadow-sm"
                          >
                            CARGAR COBRO
                          </button>
                        ) : (
                          <div className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded text-center font-bold">
                            ANULACIÓN AUTORIZADA
                          </div>
                        )}
                      </div>
                    )}

                    {/* REJECTED REASON */}
                    {req.status === 'REJECTED' && (
                      <div className="mt-2 bg-red-100 text-red-800 text-xs p-2 rounded">
                        <p className="font-bold mb-1">Rechazado por Admin:</p>
                        <p>"{req.responseNote}"</p>
                      </div>
                    )}

                    {/* PENDING INFO */}
                    {req.status === 'PENDING' && (
                      <p className="text-xs text-slate-400 mt-1 italic">Esperando respuesta del administrador...</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
};