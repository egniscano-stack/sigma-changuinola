import React, { useState } from 'react';
import { Taxpayer, Transaction, TaxType, PaymentMethod, MunicipalityInfo } from '../types';
import { CreditCard, LogOut, CheckCircle, AlertCircle, History, User, Lock, XCircle, Printer, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TaxpayerPortalProps {
    currentUser: any; // User object with extended taxpayer properties ideally
    taxpayer: Taxpayer;
    transactions: Transaction[];
    municipalityInfo: MunicipalityInfo;
    onPayment: (paymentData: any) => Transaction;
    onLogout: () => void;
}

export const TaxpayerPortal: React.FC<TaxpayerPortalProps> = ({
    currentUser,
    taxpayer,
    transactions,
    municipalityInfo,
    onPayment,
    onLogout
}) => {
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedTaxToPay, setSelectedTaxToPay] = useState<TaxType | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<number>(0);
    const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
    const [showReceipt, setShowReceipt] = useState(false);
    const [showPazSalvo, setShowPazSalvo] = useState(false);

    // DYNAMIC PENDING TAXES LOGIC
    // We check if there are paid transactions for the current month for each tax type applicable to the taxpayer.
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Helper to check if paid this month
    const isPaidThisMonth = (type: TaxType) => {
        return transactions.some(t =>
            t.taxpayerId === taxpayer.id &&
            t.taxType === type &&
            t.status === 'PAGADO' &&
            t.date.startsWith(currentMonth)
        );
    };

    const potentialTaxes = [];

    // 1. Vehicle Tax (If has vehicles) - Simplified: Assume annual due if not paid
    // In a real app we'd check vehicle renewal month. Here we just check if paid recently.
    if ((taxpayer.vehicles?.length || 0) > 0 && !isPaidThisMonth(TaxType.VEHICULO)) {
        potentialTaxes.push({ id: 'tax-veh', type: TaxType.VEHICULO, label: 'Impuesto de Circulación (Placa)', amount: 25.00 });
    }

    // 2. Garbage Tax (If active)
    if (taxpayer.hasGarbageService && !isPaidThisMonth(TaxType.BASURA)) {
        potentialTaxes.push({
            id: 'tax-bas',
            type: TaxType.BASURA,
            label: 'Tasa de Aseo - Mes Actual',
            amount: taxpayer.type === 'JURIDICA' ? 15.00 : 5.00 // Simple logic based on type
        });
    }

    // 3. Commercial Tax (If commercial)
    if (taxpayer.hasCommercialActivity && !isPaidThisMonth(TaxType.COMERCIO)) {
        potentialTaxes.push({
            id: 'tax-com',
            type: TaxType.COMERCIO,
            label: 'Impuesto Comercial - Declaración Mensual',
            amount: 50.00 // Base amount or calculated
        });
    }

    const pendingTaxes = potentialTaxes;

    const myHistory = transactions.filter(t => t.taxpayerId === taxpayer.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const handleInitiatePayment = (tax: any) => {
        setSelectedTaxToPay(tax.type);
        setPaymentAmount(tax.amount);
        setShowPaymentModal(true);
    };

    const processPayment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTaxToPay) return;

        const tx = onPayment({
            taxpayerId: taxpayer.id,
            taxType: selectedTaxToPay,
            amount: paymentAmount,
            paymentMethod: PaymentMethod.ONLINE,
            description: `PAGO ONLINE - ${selectedTaxToPay}`,
            metadata: { source: 'PORTAL_WEB' }
        });

        setLastTransaction(tx);
        setShowPaymentModal(false);
        setShowReceipt(true);
    };

    const downloadReceipt = async () => {
        const element = document.getElementById('portal-invoice-content');
        if (!element) return;

        try {
            const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF();
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            pdf.save(`Recibo_Online_${lastTransaction?.id}.pdf`);
        } catch (error) {
            console.error("Error PDF", error);
            alert("Error al generar PDF: " + (error as any).message);
        }
    };

    const downloadPazSalvo = async () => {
        const element = document.getElementById('paz-salvo-certificate');
        if (!element) return;

        try {
            // Wait for everything to render
            await new Promise(resolve => setTimeout(resolve, 500));
            const canvas = await html2canvas(element, {
                scale: 2, // High quality
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            // Landscape PDF
            const pdf = new jsPDF('l', 'mm', 'letter');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            // Should fit full page
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Paz_y_Salvo_${taxpayer.docId}.pdf`);
        } catch (error) {
            console.error("Error generating Certificate", error);
            alert("Error al generar el documento: " + (error as any).message);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            {/* HEADER */}
            {/* HEADER */}
            <header className="bg-slate-900 text-white shadow-lg relative z-10">
                <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="bg-white p-1.5 rounded-full shadow-md ring-2 ring-emerald-500/50 shrink-0">
                            <img src="/logo-municipio.png" alt="Escudo Municipal" className="h-12 w-12 sm:h-16 sm:w-16 object-contain" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="font-bold text-lg sm:text-2xl leading-none tracking-tight truncate">Sistema de Cobro Digital</h1>
                            <p className="text-xs sm:text-base text-emerald-400 font-semibold mt-0.5 truncate">Municipio de Changuinola</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className="w-full sm:w-auto flex items-center justify-center text-sm bg-slate-800 hover:bg-red-600/80 px-4 py-2 rounded-lg transition-colors border border-slate-700">
                        <LogOut size={16} className="mr-2" /> Salir
                    </button>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-8">

                {/* Welcome Card */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-xl mb-8 flex flex-col md:flex-row justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold mb-1">Bienvenido, {taxpayer.name}</h2>
                        <p className="opacity-90 flex items-center gap-2 text-sm"><User size={16} /> {taxpayer.docId} • N° {taxpayer.taxpayerNumber}</p>
                    </div>
                    <div className="mt-4 md:mt-0 bg-white/10 px-6 py-3 rounded-xl backdrop-blur-sm text-center">
                        <p className="text-xs uppercase font-bold opacity-70">Estado de Cuenta</p>
                        <p className="text-xl font-bold">Al Día</p>
                    </div>
                </div>

                {/* Tabs & Actions */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 border-b border-slate-300 pb-2">
                    <div className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`pb-3 px-2 font-bold text-sm transition-colors ${activeTab === 'pending' ? 'text-emerald-600 border-b-4 border-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Pagos Pendientes
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`pb-3 px-2 font-bold text-sm transition-colors ${activeTab === 'history' ? 'text-emerald-600 border-b-4 border-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Historial de Pagos
                        </button>
                    </div>

                    <div className="mt-4 md:mt-0">
                        {pendingTaxes.length === 0 ? (
                            <button
                                onClick={() => setShowPazSalvo(true)}
                                className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-transform active:scale-95 flex items-center gap-2"
                            >
                                <CheckCircle size={18} /> Descargar Paz y Salvo
                            </button>
                        ) : (
                            <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                                * Paga tus deudas para descargar Paz y Salvo
                            </div>
                        )}
                    </div>
                </div>

                {/* CONTENT */}
                {activeTab === 'pending' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        {pendingTaxes.map(tax => (
                            <div key={tax.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                                        <AlertCircle size={24} />
                                    </div>
                                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded">PENDIENTE</span>
                                </div>
                                <h3 className="font-bold text-slate-800 text-lg mb-1">{tax.label}</h3>
                                <p className="text-slate-500 text-sm mb-6">Vence: 30 de este mes</p>

                                <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                                    <span className="text-2xl font-extrabold text-slate-900">B/. {tax.amount.toFixed(2)}</span>
                                    <button
                                        onClick={() => handleInitiatePayment(tax)}
                                        className="bg-slate-900 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold transition-colors flex items-center gap-2 shadow-lg shadow-emerald-900/10"
                                    >
                                        <CreditCard size={18} /> Pagar Ahora
                                    </button>
                                </div>
                            </div>
                        ))}
                        {pendingTaxes.length === 0 && (
                            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                                <CheckCircle size={48} className="text-emerald-200 mx-auto mb-4" />
                                <p className="text-slate-400 font-medium">¡Excelente! No tienes pagos pendientes.</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <>
                        <div className="md:hidden space-y-4">
                            {myHistory.map(tx => (
                                <div key={tx.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-slate-500">{tx.date}</span>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${tx.paymentMethod === 'ONLINE' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {tx.paymentMethod}
                                        </span>
                                    </div>
                                    <p className="font-bold text-slate-800 text-sm mb-1">{tx.description}</p>
                                    <p className="text-xs text-slate-400 font-mono mb-3">Ref: {tx.id}</p>
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                                        <span className="text-sm font-extrabold text-slate-900">B/. {tx.amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            ))}
                            {myHistory.length === 0 && (
                                <div className="text-center py-8 text-slate-400">No hay historial disponible.</div>
                            )}
                        </div>

                        <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-4">Fecha</th>
                                        <th className="px-6 py-4">Descripción</th>
                                        <th className="px-6 py-4">Método</th>
                                        <th className="px-6 py-4 text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {myHistory.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 text-sm text-slate-600">{tx.date}</td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-800">
                                                {tx.description}
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{tx.id}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${tx.paymentMethod === 'ONLINE' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {tx.paymentMethod}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">B/. {tx.amount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    {myHistory.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-slate-400">No hay historial disponible.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

            </div>

            {/* PAYMENT MODAL (WOMPI INTEGRATION) */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                        <div className="bg-[#2C2A29] p-6 text-white flex justify-between items-center border-b-4 border-[#FF003d]">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-lg tracking-tight">Wompi</span>
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded text-white/80">Pasarela Segura</span>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} className="hover:text-red-400"><LogOut size={20} className="rotate-180" /></button>
                        </div>

                        <form onSubmit={processPayment} className="p-6 space-y-4">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-2">
                                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Monto a Pagar</p>
                                <p className="text-2xl font-extrabold text-[#2C2A29]">B/. {paymentAmount.toFixed(2)}</p>
                                <p className="text-xs text-slate-400 mt-1">{selectedTaxToPay}</p>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Correo Electrónico</label>
                                    <input required type="email" placeholder="ejemplo@correo.com" className="w-full border border-slate-300 rounded-lg p-3" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Número de Tarjeta</label>
                                    <div className="relative">
                                        <input required type="text" placeholder="0000 0000 0000 0000" className="w-full border border-slate-300 rounded-lg p-3 pl-10 font-mono text-lg" maxLength={19} />
                                        <CreditCard className="absolute left-3 top-3.5 text-slate-400" size={20} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Vencimiento</label>
                                        <input required type="text" placeholder="MM/AA" className="w-full border border-slate-300 rounded-lg p-3 font-mono text-center" maxLength={5} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">CVC / CVV</label>
                                        <input required type="text" placeholder="123" className="w-full border border-slate-300 rounded-lg p-3 font-mono text-center" maxLength={3} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Titular de la Tarjeta</label>
                                    <input required type="text" placeholder="NOMBRE Y APELLIDO" className="w-full border border-slate-300 rounded-lg p-3 uppercase" />
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-[#3440ca] hover:bg-[#2b35a8] text-white font-bold py-4 rounded-xl shadow-lg mt-4 transition-transform active:scale-95 flex justify-center items-center gap-2">
                                PAGAR CON WOMPI
                            </button>
                            <div className="text-center pt-2">
                                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                                    <Lock size={10} /> Pagos seguros procesados por Wompi Panamá
                                </p>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* OFFICIAL DIGITAL INVOICE MODAL */}
            {showReceipt && lastTransaction && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <style>{`
                        @media print {
                            @page { size: landscape; margin: 0; }
                            body * { visibility: hidden; }
                            #portal-invoice-content, #portal-invoice-content * { visibility: visible; }
                            #portal-invoice-content { 
                                position: absolute; left: 50%; top: 50%; 
                                transform: translate(-50%, -50%) scale(0.9);
                                width: 100%; max-width: 900px;
                                margin: 0; padding: 0; box-shadow: none; border: none; 
                            }
                            .no-print { display: none !important; }
                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        }
                    `}</style>

                    <div id="portal-invoice-content" className="bg-white shadow-2xl w-full max-w-4xl rounded-lg overflow-hidden flex flex-col animate-fade-in relative">

                        {/* Digital Stamp Overlay */}
                        <div className="absolute top-10 right-10 opacity-10 pointer-events-none no-print">
                            <CheckCircle size={200} className="text-emerald-900" />
                        </div>

                        {/* Invoice Header */}
                        <div className="bg-white p-6 md:p-8 pb-4 relative z-10">
                            <div className="flex justify-center mb-6">
                                <img
                                    src="/municipio-logo-bw.png"
                                    alt="Escudo Municipal"
                                    className="h-32 object-contain grayscale"
                                />
                            </div>

                            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-4">
                                <div>
                                    <h1 className="text-xl font-extrabold uppercase text-slate-900 leading-none">{municipalityInfo.name}</h1>
                                    <p className="text-xs text-slate-600 font-medium mt-1">{municipalityInfo.province}</p>
                                    <p className="text-xs text-slate-600">RUC: {municipalityInfo.ruc} • {municipalityInfo.phone}</p>
                                </div>
                                <div className="text-right">
                                    <h2 className="text-lg font-bold uppercase tracking-wider text-slate-800">Recibo Digital</h2>
                                    <p className="font-mono text-base font-bold text-red-600">#{lastTransaction.id}</p>
                                    <p className="text-xs text-slate-500">{lastTransaction.date}</p>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex flex-row gap-6">
                                <div className="w-1/3 border-r border-slate-200 pr-4">
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Recibimos de:</p>
                                    <p className="font-bold text-base text-slate-900 leading-tight mb-1">{taxpayer.name}</p>
                                    <p className="text-xs font-mono text-slate-600 mb-2">ID: {taxpayer.docId}</p>
                                    <p className="text-xs text-slate-500">{taxpayer.address}</p>
                                </div>

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
                                                        Método: {lastTransaction.paymentMethod} (Validado Online)
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

                            {/* Total Bar */}
                            <div className="mt-4 flex justify-end">
                                <div className="bg-slate-100 px-6 py-2 rounded flex items-center gap-4 border border-slate-200">
                                    <span className="text-sm font-bold text-slate-600">TOTAL PAGADO</span>
                                    <span className="text-xl font-bold text-slate-900">B/. {lastTransaction.amount.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-end">
                                <div className="text-[10px] text-slate-400 max-w-xs leading-tight">
                                    Este comprobante digital tiene la misma validez que el recibo físico.
                                    <br />Generado el {new Date().toLocaleString()}.
                                </div>
                                <div className="text-center">
                                    <div className="border-b border-slate-300 w-32 mb-1"></div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">Autoservicio Web</p>
                                </div>
                            </div>
                        </div>

                        {/* Action Bar */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-3 no-print">
                            <button
                                onClick={downloadReceipt}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all"
                            >
                                <Download size={16} /> PDF
                            </button>
                            <button onClick={() => window.print()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-all">
                                <Printer size={16} /> Imprimir
                            </button>
                            <button onClick={() => setShowReceipt(false)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm transition-colors">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PAZ Y SALVO CERTIFICATE MODAL (LANDSCAPE) */}
            {showPazSalvo && (
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
                        <button onClick={() => setShowPazSalvo(false)} className="hover:text-red-400"><XCircle size={24} /></button>
                    </div>

                    <div className="flex-1 w-full flex flex-col items-center justify-center overflow-y-auto py-4 min-h-0">
                        <div className="relative flex-shrink-0 my-4 transform-gpu">
                            <div id="paz-salvo-certificate" className="bg-white w-[279.4mm] h-[215.9mm] p-16 shadow-2xl relative text-slate-900 font-serif mx-auto scale-[0.35] sm:scale-[0.45] md:scale-[0.6] lg:scale-[0.75] origin-top flex flex-col justify-between shrink-0">

                                {/* Watermark */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none select-none overflow-hidden">
                                    <div className="text-[20rem] font-black -rotate-12 text-slate-900 whitespace-nowrap">SIGMA</div>
                                </div>

                                {/* Certificate Header - Compressed */}
                                {/* Certificate Header - Highly Compressed */}
                                <div className="text-center w-full border-b-2 border-emerald-800 pb-2 mb-2 relative z-10 flex flex-col items-center">
                                    <img src="/municipio-logo-bw.png" alt="Logo" className="h-16 w-auto mb-1 grayscale object-contain" />

                                    <h1 className="text-lg font-bold uppercase tracking-widest text-slate-900 leading-none">República de Panamá</h1>
                                    <h2 className="text-base font-bold text-emerald-800 uppercase tracking-wider leading-tight">Municipio de Changuinola</h2>
                                    <p className="text-[10px] font-semibold text-slate-600 mt-0.5 uppercase tracking-wide">Departamento de Tesorería Municipal</p>
                                </div>

                                <h2 className="text-3xl font-extrabold uppercase my-2 tracking-widest text-slate-900 decoration-4 underline decoration-emerald-500 underline-offset-4 relative z-10 text-center">Paz y Salvo</h2>

                                {/* Certificate Body - Compressed */}
                                <div className="w-full relative z-10 text-justify leading-snug px-4 flex-1 flex flex-col justify-center">
                                    <p className="text-base mb-2">
                                        <strong>A QUIEN CONCIERNA:</strong>
                                    </p>
                                    <p className="text-base mb-2 indent-8">
                                        La Tesorería Municipal de Changuinola CERTIFICA por este medio que el contribuyente descrito a continuación, se encuentra legalmente registrado en nuestra base de datos:
                                    </p>

                                    <div className="bg-slate-50 border border-slate-200 p-3 my-2 rounded-lg shadow-sm mx-4">
                                        <div className="flex justify-between items-center text-center">
                                            <div className="text-left">
                                                <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Nombre / Razón Social</p>
                                                <p className="text-xl font-bold text-slate-900 leading-tight">{taxpayer.name}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">Cédula / RUC</p>
                                                <p className="text-xl font-mono font-bold text-slate-900 leading-tight">{taxpayer.docId}</p>
                                            </div>
                                        </div>
                                        <div className="border-t border-slate-200 mt-2 pt-2 flex justify-between items-center">
                                            <span className="text-sm text-slate-500 font-mono">N° Contribuyente: {taxpayer.taxpayerNumber}</span>
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                                <span className="text-xs font-bold text-emerald-700 uppercase">Estado: SOLVENTE</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-base mb-1 indent-8 mt-2">
                                        Por lo cual, se le declara <strong>PAZ Y SALVO</strong> con el Tesoro Municipal en concepto de Impuestos, Tasas, Derechos y Contribuciones Municipales hasta la fecha de emisión.
                                    </p>

                                    <p className="text-sm text-right mt-4 italic text-slate-600">
                                        Válido por 30 días calendario.
                                        <br />Dado en Changuinola, el {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
                                    </p>
                                </div>

                                {/* Footer / Signatures - Highly Compressed */}
                                <div className="w-full mt-2 pt-2 border-t border-slate-300 relative z-10 flex justify-between items-end">
                                    <div className="text-center">
                                        <div className="h-20 w-20 bg-white border border-slate-200 mb-1 mx-auto flex items-center justify-center p-1">
                                            <img
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://changuinola.gob.pa/verify/${taxpayer.id}/${Date.now()}`}
                                                alt="QR Verificación"
                                                className="w-full h-full object-contain"
                                                crossOrigin="anonymous"
                                            />
                                        </div>
                                        <p className="text-[7px] font-mono text-slate-500 tracking-wider">ESCANEAR PARA VERIFICAR<br />{`SIGMA-${Date.now().toString().slice(-8)}`}</p>
                                    </div>

                                    <div className="text-center flex-1 px-4">
                                        <p className="text-[8px] text-slate-400 leading-tight">
                                            Generado por Plataforma SIGMA Digital.
                                            <br />Válido por Ley 83 de 2012 (Gobierno Electrónico).
                                            <br />Verificar autenticidad escaneando el código QR.
                                            <br /><strong>Vence: {new Date(new Date().setDate(new Date().getDate() + 30)).toLocaleDateString('es-ES')}</strong>
                                        </p>
                                    </div>

                                    <div className="text-center w-48">
                                        <div className="border-b-2 border-slate-900 mb-1 h-10 flex items-end justify-center pb-1">
                                            <span className="font-script text-lg text-blue-900 opacity-80 rotate-[-5deg]">Tesorero Municipal</span>
                                        </div>
                                        <p className="font-bold text-[9px] uppercase">Tesorero Municipal</p>
                                        <p className="text-[8px] text-slate-500">Autoridad Competente</p>
                                    </div>
                                </div>

                                {/* Lateral Deco (Top and Bottom for Landscape) */}
                                <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-800 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] print:h-2"></div>
                                <div className="absolute bottom-0 left-0 right-0 h-2 bg-emerald-800 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] print:h-2"></div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full flex justify-center gap-4 bg-black/50 p-4 rounded-xl backdrop-blur-sm z-50 sticky bottom-4 no-print shrink-0 mt-[-100px] sm:mt-[-150px] md:mt-[-200px] lg:mt-[-100px]">
                        <button
                            onClick={() => window.print()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                        >
                            <Printer size={20} /> Imprimir
                        </button>
                        <button
                            onClick={downloadPazSalvo}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                        >
                            <Download size={20} /> Descargar PDF
                        </button>
                        <button
                            onClick={() => setShowPazSalvo(false)}
                            className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform active:scale-95"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
