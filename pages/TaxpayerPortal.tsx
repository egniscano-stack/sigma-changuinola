import React, { useState } from 'react';
import { Taxpayer, Transaction, TaxType, PaymentMethod, MunicipalityInfo } from '../types';
import { CreditCard, LogOut, CheckCircle, AlertCircle, History, User, Lock } from 'lucide-react';
import * as html2canvas from 'html2canvas'; // Assuming available or simplistic alternative
import jsPDF from 'jspdf';

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
        const element = document.getElementById('online-receipt');
        if (!element) return;

        try {
            const canvas = await (window as any).html2canvas(element, { backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF();
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            pdf.save(`Recibo_Online_${lastTransaction?.id}.pdf`);
        } catch (error) {
            console.error("Error PDF", error);
            alert("Descarga simulada (Librerías pueden no estar completas en entorno local)");
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans">
            {/* HEADER */}
            <header className="bg-slate-900 text-white shadow-lg">
                <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-5">
                        <div className="bg-white p-2 rounded-full shadow-md ring-2 ring-emerald-500/50">
                            <img src="/logo-municipio.png" alt="Escudo Municipal" className="h-20 w-20 object-contain" />
                        </div>
                        <div>
                            <h1 className="font-bold text-2xl leading-none tracking-tight">Sistema de Cobro Digital</h1>
                            <p className="text-base text-emerald-400 font-semibold mt-0.5">Municipio de Changuinola</p>
                        </div>
                    </div>
                    <button onClick={onLogout} className="flex items-center text-sm bg-slate-800 hover:bg-red-600/80 px-4 py-2 rounded-lg transition-colors">
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

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-slate-300">
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

            {/* SUCCESS RECEIPT MODAL */}
            {showReceipt && lastTransaction && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center p-8 text-center" id="online-receipt">
                        <div className="bg-emerald-100 text-emerald-600 p-4 rounded-full mb-4">
                            <CheckCircle size={48} />
                        </div>
                        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">¡Pago Exitoso!</h2>
                        <p className="text-slate-500 text-sm mb-6">Su transacción ha sido procesada correctamente.</p>

                        <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-500">Recibo N°</span>
                                <span className="font-mono font-bold text-slate-800">{lastTransaction.id}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-500">Fecha</span>
                                <span className="font-bold text-slate-800">{lastTransaction.date}</span>
                            </div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-slate-500">Método</span>
                                <span className="font-bold text-slate-800">Wompi (Visa **42)</span>
                            </div>
                            <div className="border-t border-slate-200 my-2 pt-2 flex justify-between text-lg font-extrabold text-emerald-600">
                                <span>Total</span>
                                <span>B/. {lastTransaction.amount.toFixed(2)}</span>
                            </div>
                        </div>

                        <button onClick={() => setShowReceipt(false)} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 mb-3">
                            Cerrar
                        </button>
                        <button onClick={downloadReceipt} className="text-slate-500 text-sm hover:text-slate-800 font-medium">
                            Descargar Comprobante
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
