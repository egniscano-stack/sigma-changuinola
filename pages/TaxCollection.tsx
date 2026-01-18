import React, { useState, useEffect, useRef } from 'react';
import { Taxpayer, TaxConfig, TaxType, CommercialCategory, PaymentMethod, Transaction, User, MunicipalityInfo } from '../types';
import { Car, Building2, Trash2, Store, CreditCard, Search, Banknote, Printer, CheckCircle, X, ArrowLeft, Save, User as UserIcon, MapPin, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TaxCollectionProps {
  taxpayers: Taxpayer[];
  config: TaxConfig;
  onPayment: (data: any) => Transaction;
  currentUser: User;
  municipalityInfo: MunicipalityInfo;
  initialTaxpayer?: Taxpayer | null; // Optional prop to pre-fill
}

export const TaxCollection: React.FC<TaxCollectionProps> = ({ taxpayers, config, onPayment, currentUser, municipalityInfo, initialTaxpayer }) => {
  const [selectedTax, setSelectedTax] = useState<TaxType>(TaxType.VEHICULO);
  const [selectedTaxpayerId, setSelectedTaxpayerId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.EFECTIVO);

  // Specific Form States
  const [plateNumber, setPlateNumber] = useState('');
  const [constArea, setConstArea] = useState(0);
  const [trashType, setTrashType] = useState('RESIDENCIAL');

  // Invoice State
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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

  // Filter Logic
  const filteredTaxpayers = searchTerm.length > 0
    ? taxpayers.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.docId.includes(searchTerm) ||
      t.taxpayerNumber?.includes(searchTerm)
    )
    : [];

  const activeTaxpayer = taxpayers.find(t => t.id === selectedTaxpayerId);

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
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Caja Principal</h2>
        <p className="text-slate-500 text-sm">Procesamiento de pagos y emisión de recibos.</p>
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
      </div>

      {/* --- FORM --- */}
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
        </form>
      </div>
    </div>
  );
};