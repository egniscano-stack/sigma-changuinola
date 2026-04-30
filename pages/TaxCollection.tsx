import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Taxpayer, TaxConfig, TaxType, CommercialCategory, PaymentMethod, Transaction, User, MunicipalityInfo, AdminRequest, RequestType, RequestStatus } from '../types';
import { Car, Building2, Trash2, Store, CreditCard, Search, Banknote, Printer, CheckCircle, XCircle, X, ArrowLeft, Save, User as UserIcon, MapPin, Download, AlertCircle, Lock, History, RefreshCw, Bell } from 'lucide-react';
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
  onArchiveRequest?: (id: string) => void;
  onRefresh?: () => void;
  onDirectAdminAuth?: (password: string, req: AdminRequest) => Promise<boolean>;
}


export const TaxCollection: React.FC<TaxCollectionProps> = ({ taxpayers, transactions, config, onPayment, currentUser, municipalityInfo, initialTaxpayer, adminRequests = [], onCreateRequest, onArchiveRequest, onRefresh, onDirectAdminAuth }) => {
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
  const [showPazSalvo, setShowPazSalvo] = useState(false); // New State
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Request Management State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newRequestType, setNewRequestType] = useState<RequestType>('VOID_TRANSACTION');
  const [newRequestDesc, setNewRequestDesc] = useState('');
  const [newRequestAmount, setNewRequestAmount] = useState(0); // For Arrangement Debt
  const [requestTargetId, setRequestTargetId] = useState(''); // Transaction ID for void

  // Logic to load Approved Arrangement
  const [loadedArrangement, setLoadedArrangement] = useState<AdminRequest | null>(null);

  // Offline Admin Auth
  const [offlineAdminPassword, setOfflineAdminPassword] = useState('');

  // History Filter for Cashier
  const [historyFilterDate, setHistoryFilterDate] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD
  const [showRequestsDropdown, setShowRequestsDropdown] = useState(false);

  // Centralized notifications now handled in App.tsx to avoid Admin/Cashier confusion
  const prevRequestsRef = useRef<AdminRequest[]>([]);

  // Pre-fill from props if available
  useEffect(() => {
    if (initialTaxpayer) {
      setSelectedTaxpayerId(initialTaxpayer.id);
      // Switch tax type based on what they have
      if (initialTaxpayer.hasCommercialActivity) setSelectedTax(TaxType.COMERCIO);
      else if (initialTaxpayer.hasGarbageService) setSelectedTax(TaxType.BASURA);
      else if (initialTaxpayer.hasConstruction) setSelectedTax(TaxType.CONSTRUCCION);
      else if (initialTaxpayer.vehicles && initialTaxpayer.vehicles.length > 0) setSelectedTax(TaxType.VEHICULO);
    }
  }, [initialTaxpayer]);

  // Ensure selected tax is valid for the current taxpayer
  useEffect(() => {
    if (activeTaxpayer) {
      const available = [
        { id: TaxType.VEHICULO, enabled: (activeTaxpayer.vehicles?.length || 0) > 0 },
        { id: TaxType.CONSTRUCCION, enabled: activeTaxpayer.hasConstruction },
        { id: TaxType.BASURA, enabled: activeTaxpayer.hasGarbageService },
        { id: TaxType.COMERCIO, enabled: activeTaxpayer.hasCommercialActivity },
      ].filter(t => t.enabled);

      if (available.length > 0 && !available.find(t => t.id === selectedTax)) {
        setSelectedTax(available[0].id);
      }
    }
  }, [activeTaxpayer, selectedTax]);

  // --- DEBT CALCULATION LOGIC (Consolidated View) ---
  const taxpayerDebts = useMemo(() => {
    if (!activeTaxpayer) return [];
    const debts: any[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // 1. Balance / Historical (Prioritizing this)
    if ((activeTaxpayer.balance || 0) > 0) {
      debts.push({
        id: 'balance',
        type: 'DEUDA_HISTORICA',
        label: 'Deuda Acumulada (Años Anteriores)',
        amount: activeTaxpayer.balance,
        description: `Saldo pendiente de periodos anteriores`,
        isPriority: true
      });
    }

    // 2. Commercial & 3. Garbage (Iterate through months of the current year)
    for (let m = 1; m <= currentMonth; m++) {
      const monthName = new Date(currentYear, m - 1).toLocaleString('es-ES', { month: 'long' });

      // Commercial
      if (activeTaxpayer.hasCommercialActivity && activeTaxpayer.status !== 'BLOQUEADO') {
        const hasPaidCom = (transactions || []).some(t => {
          if (t.taxpayerId !== activeTaxpayer.id || t.status !== 'PAGADO') return false;
          
          // 1. Check if paid via Consolidated Payment
          if (t.metadata?.isConsolidated && t.metadata?.originalItems) {
            return t.metadata.originalItems.some((i: any) => i.label.includes(`Comercial - ${monthName}`));
          }

          if (t.taxType !== TaxType.COMERCIO) return false;
          
          // 2. Strict metadata check (explicit month payment)
          if (t.metadata?.month === m && t.metadata?.year === currentYear) return true;
          
          return false; // Removed loose date-based fallback to prevent accidental clearing of unrelated debts
        });

        if (!hasPaidCom) {
          const rates = config?.commercialRates || {};
          const amount = activeTaxpayer.commercialCategory ? (rates[activeTaxpayer.commercialCategory] || config?.commercialBaseRate || 0) : (config?.commercialBaseRate || 0);
          debts.push({
            id: `com-${m}-${currentYear}`,
            type: TaxType.COMERCIO,
            label: `Impuesto Comercial - ${monthName}`,
            amount: amount,
            description: `Mes de ${monthName} ${currentYear}`,
            metadata: { month: m, year: currentYear }
          });
        }
      }

      // Garbage
      if (activeTaxpayer.hasGarbageService && activeTaxpayer.status !== 'BLOQUEADO') {
        const hasPaidBas = (transactions || []).some(t => {
          if (t.taxpayerId !== activeTaxpayer.id || t.status !== 'PAGADO') return false;
          
          // 1. Check if paid via Consolidated Payment
          if (t.metadata?.isConsolidated && t.metadata?.originalItems) {
            return t.metadata.originalItems.some((i: any) => i.label.includes(`Tasa de Aseo - ${monthName}`));
          }

          if (t.taxType !== TaxType.BASURA) return false;
          
          // 2. Strict metadata check
          if (t.metadata?.month === m && t.metadata?.year === currentYear) return true;
          
          return false; // Removed loose date-based fallback
        });

        if (!hasPaidBas) {
          const rate = activeTaxpayer.type === 'JURIDICA' ? (config?.garbageCommercialRate || 0) : (config?.garbageResidentialRate || 0);
          debts.push({
            id: `bas-${m}-${currentYear}`,
            type: TaxType.BASURA,
            label: `Tasa de Aseo - ${monthName}`,
            amount: rate,
            description: `Mes de ${monthName} ${currentYear}`,
            metadata: { month: m, year: currentYear }
          });
        }
      }
    }

    // 4. Vehicles (Annual)
    if (activeTaxpayer.vehicles && activeTaxpayer.vehicles.length > 0) {
      activeTaxpayer.vehicles.forEach(v => {
        const hasPaid = transactions.some(t => {
          if (t.taxpayerId !== activeTaxpayer.id || t.status !== 'PAGADO') return false;
          
          // Check if paid via Consolidated Payment
          if (t.metadata?.isConsolidated && t.metadata?.originalItems) {
            return t.metadata.originalItems.some((i: any) => i.label.includes(`Placa ${v.plate}`));
          }

          return t.taxType === TaxType.VEHICULO &&
                 t.metadata?.plateNumber === v.plate &&
                 new Date(t.date).getFullYear() === currentYear;
        });
        if (!hasPaid) {
          debts.push({
            id: `veh-${v.plate}-${currentYear}`,
            type: TaxType.VEHICULO,
            label: `Impuesto Vehicular (Placa ${v.plate})`,
            amount: config?.plateCost || 0,
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

  const handlePayAllDebts = () => {
    if (!activeTaxpayer || taxpayerDebts.length === 0) return;

    const totalAmount = taxpayerDebts.reduce((acc, d) => acc + (d.amount || 0), 0);
    const summaryDesc = `Pago Total de Deudas Pendientes (${taxpayerDebts.length} conceptos)`;

    const tx = onPayment({
      taxType: TaxType.COMERCIO, // Use a general type for consolidated
      taxpayerId: selectedTaxpayerId,
      amount: totalAmount,
      paymentMethod: paymentMethod,
      description: summaryDesc,
      metadata: { 
        isConsolidated: true, 
        itemsCount: taxpayerDebts.length,
        originalItems: taxpayerDebts.map(d => ({ label: d.label, amount: d.amount }))
      }
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
        return config?.plateCost || 0;
      case TaxType.CONSTRUCCION:
        return constArea * (config?.constructionRatePerSqm || 0);
      case TaxType.BASURA:
        return trashType === 'RESIDENCIAL' ? (config?.garbageResidentialRate || 0) : (config?.garbageCommercialRate || 0);
      case TaxType.COMERCIO:
        if (activeTaxpayer?.commercialCategory) {
          const rates = config?.commercialRates || {};
          return rates[activeTaxpayer.commercialCategory] || config?.commercialBaseRate || 0;
        }
        return config?.commercialBaseRate || 0;
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

    // Auto-assign to oldest debt if applicable
    let finalMetadata: any = { plateNumber, constArea, trashType };
    
    if (selectedTax === TaxType.BASURA || selectedTax === TaxType.COMERCIO) {
      const oldestDebt = taxpayerDebts.find(d => d.type === selectedTax);
      if (oldestDebt && oldestDebt.metadata) {
        finalMetadata = { ...finalMetadata, ...oldestDebt.metadata };
      }
    }

    const tx = onPayment({
      taxType: selectedTax,
      taxpayerId: selectedTaxpayerId,
      amount: amount,
      paymentMethod: paymentMethod,
      description: getTaxDescription(),
      metadata: finalMetadata
    });

    setLastTransaction(tx);
    setShowInvoice(true);
  };

  const handleFinishCollection = () => {
    setShowInvoice(false);

    // Check if it was a Paz y Salvo transaction
    if (lastTransaction?.metadata?.isPazSalvo) {
      setShowPazSalvo(true);
      // Don't clear taxpayer yet as we need it for the certificate
    } else {
      // Normal Reset
      setPlateNumber('');
      setConstArea(0);
      setSearchTerm('');
      setSelectedTaxpayerId('');
      setPaymentMethod(PaymentMethod.EFECTIVO);
    }
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

  const downloadPazSalvo = async () => {
    const element = document.getElementById('paz-salvo-certificate');
    if (!element) return;

    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'letter');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Paz_y_Salvo_${activeTaxpayer?.docId}.pdf`);
    } catch (error) {
      console.error("Error generating Certificate", error);
      alert("Error al generar el documento: " + (error as any).message);
    }
  };

  const handleDailyClosing = () => {
    const today = new Date().toLocaleDateString('en-CA');
    const myTxs = transactions.filter(t => t.date === today && t.tellerName === currentUser.name);

    if (myTxs.length === 0) {
      alert("No hay transacciones registradas hoy para generar el cierre.");
      return;
    }

    const total = myTxs.reduce((acc, t) => acc + t.amount, 0);

    // Reuse similar logic to Reports but simplified for immediate download
    // Landscape mode for more columns
    const pdf = new jsPDF('l', 'mm', 'a4');

    // Header
    pdf.setFontSize(22);
    pdf.setTextColor(30, 41, 59);
    pdf.text("Cierre de Caja Diario Detallado", 148, 20, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(`Fecha del Reporte: ${today}`, 20, 35);
    pdf.text(`Cajero Responsable: ${currentUser?.name || 'S/N'} (${currentUser?.username || 'N/A'})`, 20, 42);
    pdf.text(`Sucursal: Tesorería Municipal de Changuinola`, 20, 49);

    // Summary Box
    pdf.setDrawColor(226, 232, 240);
    pdf.setFillColor(248, 250, 252);
    pdf.rect(220, 30, 57, 25, 'F');
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(10);
    pdf.text("TOTAL RECAUDADO NETO", 225, 38);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(15, 23, 42);
    pdf.text(`B/. ${total.toFixed(2)}`, 225, 48);

    // Table Header
    let y = 65;
    pdf.setFontSize(9);
    pdf.setFillColor(241, 245, 249);
    pdf.rect(20, y - 5, 257, 8, 'F');
    pdf.setTextColor(71, 85, 105);
    pdf.setFont("helvetica", "bold");
    
    pdf.text("FECHA / HORA", 22, y);
    pdf.text("CONTRIBUYENTE / CORREGIMIENTO", 60, y);
    pdf.text("CONCEPTO / DETALLE", 140, y);
    pdf.text("MÉTODO", 205, y);
    pdf.text("ESTADO", 230, y);
    pdf.text("MONTO", 272, y, { align: 'right' });

    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(51, 65, 85);
    
    myTxs.forEach(t => {
      if (y > 185) { pdf.addPage('l'); y = 20; }
      
      const isVoidRecord = t.id.startsWith('VOID-');
      const isAnnulledOriginal = t.status === 'ANULADO' && !isVoidRecord;
      
      if (isVoidRecord || isAnnulledOriginal) {
        pdf.setTextColor(220, 38, 38); // Red-600
      } else {
        pdf.setTextColor(30, 41, 59);
      }

      // Format Date for table: DD/MM/YY
      const dateParts = t.date.split('-'); // YYYY-MM-DD
      const shortDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0].slice(-2)}`;
      const timeDisplay = `${shortDate}\n${t.time}`;

      // Lookup Taxpayer Info
      const tp = taxpayers.find(taxp => taxp.id === t.taxpayerId);
      const tpDisplay = `${tp?.name || 'S/N'}\n(${tp?.corregimiento || 'Sin Corregimiento'})`;

      // Clean Concepto (Translation)
      let concepto = '';
      switch(t.taxType) {
        case TaxType.VEHICULO: concepto = 'PLACA'; break;
        case TaxType.BASURA: concepto = 'BASURA'; break;
        case TaxType.COMERCIO: concepto = 'NEGOCIO'; break;
        case TaxType.CONSTRUCCION: concepto = 'CONSTRUCCIÓN'; break;
        default: concepto = t.taxType;
      }
      
      // If it's a void, prefix it
      if (isVoidRecord) concepto = `ANULACIÓN: ${concepto}`;

      pdf.setFontSize(8);
      pdf.text(timeDisplay, 22, y);
      
      pdf.text(tpDisplay, 60, y);
      
      pdf.setFontSize(9);
      // Clean description to remove "Mes de ...", years, and date formats
      const cleanDesc = t.description
        .replace(/Mes de \w+ \d{4}/gi, '') // Remove "Mes de Enero 2026"
        .replace(/Mes de \w+/gi, '')       // Remove "Mes de Enero"
        .replace(/\d{4}/g, '')             // Remove any 4-digit year
        .replace(/\d{4}-\d{2}-\d{2}/g, '') // Remove YYYY-MM-DD
        .replace(/\d{2}\/\d{2}\/\d{2,4}/g, '') // Remove DD/MM/YY
        .replace(/\s\s+/g, ' ')            // Remove double spaces
        .trim();

      const displayConcept = cleanDesc && cleanDesc.length > 1 ? `${concepto} - ${cleanDesc}` : concepto;
      pdf.text(displayConcept.substring(0, 50), 140, y);
      
      pdf.text(t.paymentMethod || 'EFECTIVO', 205, y);
      pdf.text(t.status === 'ANULADO' ? 'ANULADO' : 'PAGADO', 230, y);
      pdf.text(t.amount.toFixed(2), 272, y, { align: 'right' });
      
      pdf.setDrawColor(241, 245, 249);
      pdf.line(20, y + 5, 277, y + 5);
      
      y += 12;
    });

    // Footer with signatures
    if (y > 170) { pdf.addPage('l'); y = 20; }
    y += 20;
    pdf.setTextColor(71, 85, 105);
    pdf.setFontSize(10);
    pdf.text("__________________________", 50, y);
    pdf.text("Firma del Cajero", 65, y + 7);
    
    pdf.text("__________________________", 190, y);
    pdf.text("Firma de Auditoría / Tesorería", 195, y + 7);

    pdf.save(`Cierre_Caja_${currentUser?.username || 'user'}_${today}.pdf`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">

      {/* --- PAZ Y SALVO MODAL --- */}
      {showPazSalvo && activeTaxpayer && (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4 backdrop-blur-md overflow-y-auto">
          <style>{`
                        @media print {
                            @page { size: landscape; margin: 0; }
                            body * { visibility: hidden; }
                            #paz-salvo-certificate, #paz-salvo-certificate * { visibility: visible; }
                            #paz-salvo-certificate { 
                                position: absolute; left: 0; right: 0; top: 0; bottom: 0;
                                width: 100%; height: 100%;
                                margin: 0; padding: 0; box-shadow: none; border: none; 
                                transform: none;
                            }
                            .no-print { display: none !important; }
                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        }
                    `}</style>
          <div className="flex justify-between w-full max-w-5xl mb-4 text-white no-print">
            <h3 className="text-xl font-bold flex items-center gap-2"><CheckCircle /> Documento Oficial (Formato Horizontal)</h3>
            <button onClick={() => setShowPazSalvo(false)} className="hover:text-red-400"><XCircle className="text-white" size={24} /></button>
          </div>
          <div className="flex-1 w-full flex flex-col items-center justify-center overflow-y-auto py-4 min-h-0">
            <div className="relative flex-shrink-0 my-4 transform-gpu">
              <div id="paz-salvo-certificate" className="bg-white w-[279.4mm] h-[215.9mm] p-16 shadow-2xl relative text-slate-900 font-serif mx-auto scale-[0.35] sm:scale-[0.45] md:scale-[0.6] lg:scale-[0.75] origin-top flex flex-col justify-between shrink-0">
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none overflow-hidden">
                  <div className="text-[20rem] font-black -rotate-12 text-slate-900 whitespace-nowrap">SIGMA</div>
                </div>
                {/* Certificate Header */}
                <div className="text-center w-full border-b-2 border-emerald-800 pb-2 mb-2 relative z-10 flex flex-col items-center">
                  <img src={`${import.meta.env.BASE_URL}municipio-logo-bw.png`} alt="Logo" className="h-16 w-auto mb-1 grayscale object-contain" />
                  <h1 className="text-lg font-bold uppercase tracking-widest text-slate-900 leading-none">República de Panamá</h1>
                  <h2 className="text-base font-bold text-emerald-800 uppercase tracking-wider leading-tight">Municipio de Changuinola</h2>
                  <p className="text-[10px] font-semibold text-slate-600 mt-0.5 uppercase tracking-wide">Departamento de Tesorería Municipal</p>
                </div>
                <h2 className="text-3xl font-extrabold uppercase my-2 tracking-widest text-slate-900 decoration-4 underline decoration-emerald-500 underline-offset-4 relative z-10 text-center">Paz y Salvo</h2>
                {/* Certificate Body */}
                <div className="w-full relative z-10 text-justify leading-snug px-4 flex-1 flex flex-col justify-center">
                  <p className="text-base mb-2"><strong>A QUIEN CONCIERNA:</strong></p>
                  <p className="text-base mb-2 indent-8">La Tesorería Municipal de Changuinola CERTIFICA por este medio que el contribuyente descrito a continuación, se encuentra legalmente registrado en nuestra base de datos:</p>
                  <div className="bg-slate-50 border border-slate-200 p-3 my-2 rounded-lg shadow-sm mx-4">
                    <div className="flex justify-between items-center text-center">
                      <div className="text-left">
                        <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Nombre / Razón Social</p>
                        <p className="text-xl font-bold text-slate-900 leading-tight">{activeTaxpayer.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Cédula / RUC</p>
                        <p className="text-xl font-mono font-bold text-slate-900 leading-tight">{activeTaxpayer.docId}</p>
                      </div>
                    </div>
                    <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between items-center">
                      <span className="text-sm text-slate-500 font-mono">N° Contribuyente: {activeTaxpayer.taxpayerNumber}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-emerald-700 uppercase">Estado: SOLVENTE</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-base mb-1 indent-8 mt-2">Por lo cual, se le declara <strong>PAZ Y SALVO</strong> con el Tesoro Municipal en concepto de Impuestos, Tasas, Derechos y Contribuciones Municipales hasta la fecha de emisión.</p>
                  <p className="text-sm text-right mt-4 italic text-slate-600">Válido por 30 días calendario.<br />Dado en Changuinola, el {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.</p>
                </div>
                {/* Footer / Signatures */}
                <div className="w-full mt-2 pt-2 border-t border-slate-300 relative z-10 flex justify-between items-end">
                  <div className="text-center">
                    <div className="h-20 w-20 bg-white border border-slate-200 mb-1 mx-auto flex items-center justify-center p-1">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://changuinola.gob.pa/verify/${activeTaxpayer.id}/${Date.now()}`} alt="QR Verificación" className="w-full h-full object-contain" crossOrigin="anonymous" />
                    </div>
                    <p className="text-[7px] font-mono text-slate-500 tracking-wider">ESCANEAR PARA VERIFICAR<br />{`SIGMA-${Date.now().toString().slice(-8)}`}</p>
                  </div>
                  <div className="text-center flex-1 px-4">
                    <p className="text-[8px] text-slate-400 leading-tight">Generado por Plataforma SIGMA Digital.<br />Válido por Ley 83 de 2012 (Gobierno Electrónico).<br />Verificar autenticidad escaneando el código QR.<br /><strong>Vence: {new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString('es-ES')}</strong></p>
                  </div>
                  <div className="text-center w-48">
                    <div className="border-b-2 border-slate-900 mb-1 h-10 flex items-end justify-center pb-1">
                      <span className="font-script text-lg text-blue-900 opacity-80 rotate-[-5deg]">Tesorero Municipal</span>
                    </div>
                    <p className="font-bold text-[9px] uppercase">Tesorero Municipal</p>
                    <p className="text-[8px] text-slate-500">Autoridad Competente</p>
                  </div>
                </div>
                <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-800 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] print:h-2"></div>
                <div className="absolute bottom-0 left-0 right-0 h-2 bg-emerald-800 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] print:h-2"></div>
              </div>
            </div>
          </div>
          <div className="w-full flex justify-center gap-4 bg-black/50 p-4 rounded-xl backdrop-blur-sm z-50 sticky bottom-4 no-print shrink-0 mt-[-100px] sm:mt-[-150px] md:mt-[-200px] lg:mt-[-100px]">
            <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform active:scale-95 flex items-center gap-2"><Printer size={20} /> Imprimir</button>
            <button onClick={downloadPazSalvo} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform active:scale-95 flex items-center gap-2"><Download size={20} /> Descargar PDF</button>
            <button onClick={() => setShowPazSalvo(false)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform active:scale-95">Cerrar</button>
          </div>
        </div>
      )}

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
                          B/. {(lastTransaction.amount || 0).toFixed(2)}
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
                  <span className="text-xl font-bold text-slate-900">B/. {(lastTransaction.amount || 0).toFixed(2)}</span>
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
        <div className="flex items-center gap-3 relative">
          
          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all"
              title="Forzar actualización desde el servidor"
            >
              <RefreshCw size={16} /> <span className="hidden sm:inline">Refrescar</span>
            </button>
          )}

          {/* Admin Requests Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowRequestsDropdown(!showRequestsDropdown)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs transition-all border ${
                (adminRequests || []).filter(r => r.status === 'APPROVED').length > 0 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse' 
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <Bell size={16} />
              <span className="hidden md:inline">Solicitudes</span>
              { (adminRequests || []).filter(r => r.status !== 'ARCHIVED').length > 0 && (
                <span className="bg-red-500 text-white text-[10px] h-4 w-4 flex items-center justify-center rounded-full">
                  {(adminRequests || []).filter(r => r.status !== 'ARCHIVED').length}
                </span>
              )}
            </button>

            {showRequestsDropdown && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-[100] animate-scale-up">
                <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                  <h4 className="font-bold text-xs flex items-center gap-2">
                    <Banknote size={14} /> Historial de Solicitudes
                  </h4>
                  <button onClick={() => setShowRequestsDropdown(false)}><X size={14} /></button>
                </div>
                <div className="max-h-96 overflow-y-auto p-2 bg-slate-50 space-y-2">
                  {(adminRequests || []).filter(r => r.status !== 'ARCHIVED').length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                      No hay solicitudes pendientes.
                    </div>
                  ) : (
                    [...(adminRequests || [])].filter(r => r.status !== 'ARCHIVED').reverse().map(req => (
                      <div key={req.id} className={`p-3 rounded-lg border text-xs shadow-sm relative group ${
                        req.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' :
                        req.status === 'REJECTED' ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'
                      }`}>
                        {req.status !== 'PENDING' && (
                          <button
                            onClick={() => onArchiveRequest && onArchiveRequest(req.id)}
                            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 bg-white/50 rounded-full p-1"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <div className="flex justify-between items-start mb-1 pr-4">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            req.type === 'VOID_TRANSACTION' ? 'bg-slate-200 text-slate-600' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {req.type === 'VOID_TRANSACTION' ? 'Anulación' : 'Arreglo'}
                          </span>
                          <span className={`text-[9px] font-bold ${
                            req.status === 'APPROVED' ? 'text-emerald-600' :
                            req.status === 'REJECTED' ? 'text-red-600' : 'text-amber-500'
                          }`}>
                            {req.status === 'PENDING' ? 'ESPERANDO' : req.status}
                          </span>
                        </div>
                        <p className="font-bold text-slate-700 truncate">{req.taxpayerName}</p>
                        {req.status === 'APPROVED' && (
                          <div className="mt-2">
                            <p className="text-[10px] text-emerald-700 mb-1 font-medium">{req.responseNote || 'Aprobado'}</p>
                            <button
                              onClick={() => {
                                setLoadedArrangement(req);
                                  if (req.taxpayerId) {
                                    setSelectedTaxpayerId(req.taxpayerId);
                                  } else {
                                    const tp = taxpayers.find(t => t.name === req.taxpayerName);
                                    if (tp) setSelectedTaxpayerId(tp.id);
                                  }
                                
                                if (req.type === 'PAYMENT_ARRANGEMENT') {
                                  setPaymentMethod(PaymentMethod.ARREGLO_PAGO as any);
                                } else if (req.type === 'VOID_TRANSACTION' && req.transactionId) {
                                  // Find original transaction to reload data for correction
                                  const origTx = transactions.find(tx => tx.id === req.transactionId);
                                  if (origTx) {
                                    setSelectedTax(origTx.taxType);
                                    setPaymentMethod(origTx.paymentMethod);
                                    if (origTx.metadata?.plateNumber) setPlateNumber(origTx.metadata.plateNumber);
                                    if (origTx.metadata?.trashType) setTrashType(origTx.metadata.trashType);
                                    if (origTx.metadata?.constArea) setConstArea(origTx.metadata.constArea);
                                    alert(`DATOS CARGADOS PARA CORRECCIÓN\n-------------------------\nContribuyente: ${req.taxpayerName}\nConcepto: ${origTx.description}\nPor favor, realice las correcciones y procese el nuevo cobro.`);
                                  }
                                }
                                
                                if (onArchiveRequest) onArchiveRequest(req.id);
                                setShowRequestsDropdown(false);
                              }}
                              className="w-full bg-emerald-600 text-white text-[10px] font-bold py-1.5 rounded hover:bg-emerald-700"
                            >
                              CARGAR ACCIÓN
                            </button>
                          </div>
                        )}
                        {req.status === 'REJECTED' && (
                          <p className="mt-1 text-[10px] text-red-600 italic">"{req.responseNote}"</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleDailyClosing}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-900 transition-colors shadow-sm"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Cierre del Día</span>
          </button>
        </div>
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
              autoFocus
              className="block w-full pl-10 pr-3 py-4 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 sm:text-lg shadow-sm"
              placeholder="Buscar Contribuyente (Nombre o Cédula)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
            />

            {showDropdown && searchTerm.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-xl shadow-2xl border border-slate-200 max-h-80 overflow-y-auto z-50">
                {filteredTaxpayers.length > 0 ? (
                  filteredTaxpayers.map((tp) => (
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
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <AlertCircle size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-bold">No se encontraron resultados</p>
                    <p className="text-xs text-slate-400 mt-1">Verifique el nombre o número de cédula/RUC</p>
                  </div>
                )}
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
                  onClick={() => {
                    // Charge $3.00 for the certificate
                    const tx = onPayment({
                      taxType: TaxType.COMERCIO, // Categorize as Commerce/Misc
                      taxpayerId: activeTaxpayer.id,
                      amount: 3.00,
                      paymentMethod: PaymentMethod.EFECTIVO,
                      description: 'TRAMITE: CERTIFICADO PAZ Y SALVO MUNICIPAL',
                      metadata: { isPazSalvo: true }
                    });
                    setLastTransaction(tx);
                    // Generate PDF immediately after "paying"
                    alert("Cobro de B/. 3.00 realizado. Generando certificado...");
                    // In a real flow we might wait for confirmation, but here we assume 'onPayment' is synchronous for the UI update.
                    // We can trigger a separate PDF generator for the certificate.
                    // For now, let's just reuse the invoice modal which shows the payment, 
                    // BUT theoretically we should show the ACTUAL certificate.
                    // Let's toggle a flag to show the Certificate Modal instead of Invoice, or both.
                    // Converting the invoice modal to show certificate if metadata.isPazSalvo is true?
                    // Or simplified: Just print the invoice which confirms the PAZ Y SALVO payment.
                    setShowInvoice(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 transition-transform active:scale-95"
                >
                  <CheckCircle size={20} /> Generar Paz y Salvo (B/. 3.00)
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
              <div className="flex items-center gap-3">
                <span className="text-xs bg-white/20 px-2 py-1 rounded font-mono">Total: B/. {(taxpayerDebts.reduce((acc, d) => acc + (d.amount || 0), 0) || 0).toFixed(2)}</span>
                {taxpayerDebts.length > 1 && (
                  <button
                    onClick={handlePayAllDebts}
                    className="bg-white text-red-600 px-3 py-1 rounded-lg text-xs font-bold shadow-md hover:bg-slate-50 transition-all active:scale-95"
                  >
                    Cobrar Totalidad
                  </button>
                )}
              </div>
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
                  {taxpayerDebts.map((debt) => (
                    <tr key={debt.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{debt.label}</p>
                        <p className="text-xs text-slate-500">{debt.description}</p>
                      </td>
                      <td className="px-6 py-4 text-right font-extrabold text-red-600">
                        B/. {(debt.amount || 0).toFixed(2)}
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
              { id: TaxType.VEHICULO, label: 'Placa', icon: Car, enabled: activeTaxpayer?.vehicles && activeTaxpayer.vehicles.length > 0 },
              { id: TaxType.CONSTRUCCION, label: 'Construcción', icon: Building2, enabled: activeTaxpayer?.hasConstruction },
              { id: TaxType.BASURA, label: 'Basura', icon: Trash2, enabled: activeTaxpayer?.hasGarbageService },
              { id: TaxType.COMERCIO, label: 'Comercio', icon: Store, enabled: activeTaxpayer?.hasCommercialActivity },
            ].filter(t => !activeTaxpayer || t.enabled).map((tax) => {
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
                <option value="RESIDENCIAL">Residencial (B/. {(config?.garbageResidentialRate || 0).toFixed(2)})</option>
                <option value="COMERCIAL">Comercial (B/. {(config?.garbageCommercialRate || 0).toFixed(2)})</option>
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
            <span className="font-mono text-2xl font-bold">B/. {(calculateTotal() || 0).toFixed(2)}</span>
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
                    <option value="VOID_TRANSACTION">Anulación / Descobro (Solicitar)</option>
                    <option value="PAYMENT_ARRANGEMENT">Arreglo de Pago (Solicitar)</option>
                    <option value="UPDATE_TAXPAYER">Editar Datos de Contribuyente (Solicitar)</option>
                  </select>
                </div>

                {newRequestType === 'UPDATE_TAXPAYER' && (
                  <div className="bg-amber-50 p-3 rounded border border-amber-200 text-xs text-amber-800 mb-2">
                    <p className="font-bold flex items-center gap-1"><AlertCircle size={14} /> Importante</p>
                    <p>Al solicitar edición, el Administrador podrá permitirle modificar datos sensibles como nombre, categoría comercial o saldos.</p>
                  </div>
                )}

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

                {onDirectAdminAuth && (
                  <div className="mt-6 pt-4 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Autorización Presencial (Opcional)</label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        className="flex-1 border border-slate-300 rounded p-2 text-sm bg-slate-50 focus:bg-white"
                        placeholder="PIN/Clave del Administrador"
                        value={offlineAdminPassword}
                        onChange={(e) => setOfflineAdminPassword(e.target.value)}
                      />
                      <button
                        onClick={async () => {
                          if (!offlineAdminPassword) {
                            alert("Ingrese la clave del administrador.");
                            return;
                          }
                          
                          let finalTaxpayerName = activeTaxpayer?.name || 'Desconocido';
                          let finalTaxpayerId = selectedTaxpayerId;

                          if (finalTaxpayerName === 'Desconocido' && requestTargetId) {
                            const tx = transactions.find(t => t.id === requestTargetId);
                            if (tx) {
                              const tp = taxpayers.find(tp => tp.id === tx.taxpayerId);
                              if (tp) {
                                finalTaxpayerName = tp.name;
                                finalTaxpayerId = tp.id;
                              }
                            }
                          }

                          const req: AdminRequest = {
                            id: `REQ-${Date.now()}`,
                            type: newRequestType,
                            status: 'APPROVED', // Will be overridden in backend but useful for context
                            requesterName: currentUser?.name || 'Cajero',
                            taxpayerName: finalTaxpayerName,
                            description: newRequestDesc || 'Autorizado presencialmente',
                            transactionId: requestTargetId,
                            taxpayerId: finalTaxpayerId, 
                            totalDebt: newRequestType === 'PAYMENT_ARRANGEMENT' ? newRequestAmount : undefined,
                            createdAt: new Date().toISOString()
                          };

                          const success = await onDirectAdminAuth(offlineAdminPassword, req);
                          if (success) {
                            setShowRequestModal(false);
                            setNewRequestDesc('');
                            setNewRequestAmount(0);
                            setRequestTargetId('');
                            setOfflineAdminPassword('');
                          } else {
                            alert("Credenciales de administrador incorrectas.");
                          }
                        }}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded text-sm transition-colors flex items-center gap-2"
                      >
                        <Lock size={14} /> Autorizar
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-100 mt-2">
                  <button
                    onClick={() => {
                      setShowRequestModal(false);
                      setOfflineAdminPassword('');
                    }}
                    className="flex-1 bg-slate-100 text-slate-700 py-2 rounded hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      if (onCreateRequest) {
                        let finalTaxpayerName = activeTaxpayer?.name || 'Desconocido';
                        let finalTaxpayerId = selectedTaxpayerId;

                        // If no active taxpayer is selected, try to find it via the transaction ID
                        if (finalTaxpayerName === 'Desconocido' && requestTargetId) {
                          const tx = transactions.find(t => t.id === requestTargetId);
                          if (tx) {
                            const tp = taxpayers.find(tp => tp.id === tx.taxpayerId);
                            if (tp) {
                              finalTaxpayerName = tp.name;
                              finalTaxpayerId = tp.id;
                            }
                          }
                        }

                        const req: AdminRequest = {
                          id: `REQ-${Date.now()}`,
                          type: newRequestType,
                          status: 'PENDING',
                          requesterName: currentUser?.name || 'Cajero',
                          taxpayerName: finalTaxpayerName,
                          description: newRequestDesc,
                          transactionId: requestTargetId,
                          taxpayerId: finalTaxpayerId, 
                          totalDebt: newRequestType === 'PAYMENT_ARRANGEMENT' ? newRequestAmount : undefined,
                          createdAt: new Date().toISOString()
                        };
                        onCreateRequest(req);
                        setShowRequestModal(false);
                        setNewRequestDesc('');
                        setNewRequestAmount(0);
                        setRequestTargetId('');
                        alert("Solicitud enviada exitosamente al Administrador. Recibirá una notificación cuando sea procesada.");
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

      {/* --- RECENT TRANSACTIONS (FOR VOID/REFERENCE) --- */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <History size={18} /> Transacciones {historyFilterDate === new Date().toLocaleDateString('en-CA') ? '(Hoy)' : `(${historyFilterDate})`}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">Ver Fecha:</span>
            <input 
              type="date" 
              value={historyFilterDate}
              onChange={(e) => setHistoryFilterDate(e.target.value)}
              className="text-xs border rounded-lg px-2 py-1 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="px-6 py-3">Hora</th>
                <th className="px-6 py-3">Contribuyente</th>
                <th className="px-6 py-3">Concepto</th>
                <th className="px-6 py-3 text-center">Estado</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(transactions || [])
                .filter(t => t.tellerName === currentUser?.name && t.date === historyFilterDate && !t.id.startsWith('VOID-'))
                .sort((a, b) => b.time.localeCompare(a.time)) // Newest first
                .slice(0, 15)
                .map(tx => (
                  <tr key={tx.id} className={`hover:bg-slate-50 transition-colors ${tx.status === 'ANULADO' ? 'bg-red-50/30 opacity-80' : ''}`}>
                    <td className="px-6 py-4 font-mono text-xs">{tx.time}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                      {taxpayers.find(tp => tp.id === tx.taxpayerId)?.name || 'Desconocido'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]">{tx.description}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tx.status === 'ANULADO' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${tx.amount < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                      B/. {(tx.amount || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {tx.status !== 'ANULADO' && (
                        <button
                          onClick={() => {
                            setRequestTargetId(tx.id);
                            setNewRequestType('VOID_TRANSACTION');
                            setNewRequestDesc(`Solicito anulación del recibo ${tx.id} por error en el cobro.`);
                            setShowRequestModal(true);
                          }}
                          className="text-red-600 hover:text-red-700 font-bold text-xs bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              {(transactions || []).filter(t => t.tellerName === currentUser?.name && t.date === historyFilterDate).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-400 italic">No se encontraron transacciones para esta fecha.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div >
  );
};