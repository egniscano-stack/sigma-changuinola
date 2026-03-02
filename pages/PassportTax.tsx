import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import Tesseract from 'tesseract.js';
import {
    Globe, FileText, User, Calendar, MapPin,
    CheckCircle, Printer, Download, ArrowLeft, X, AlertTriangle, Check,
    Camera, Upload, Loader2, BadgeCheck, Shield, Scan, Trash2
} from 'lucide-react';
import { MunicipalityInfo } from '../types';

interface PassportTaxProps {
    currentUserName: string;
    municipalityInfo: MunicipalityInfo;
    onBack: () => void;
}

interface PassportData {
    passportNumber: string;
    fullName: string;
    nationality: string;
    dateOfBirth: string;
    entryDate: string;
    exitDate: string;
    entryPort: string;
    purpose: string;
    accommodation: string;
    phone: string;
    email: string;
}

interface TourismInvoice {
    invoiceId: string;
    issuedAt: string;
    passportData: PassportData;
    amount: number;
    taxType: string;
    tellerName: string;
    verificationCode: string;
    qrUrl: string;
}

const TOURISM_TAX_RATE = 3.00; // B/. 3.00 por turista
const ENTRY_PORTS = [
    'Aeropuerto Internacional de Bocas del Toro',
    'Puesto de Control Guabito',
    'Puerto de Almirante',
    'Puesto de Control Sixaola-Changuinola',
    'Marina de Bocas Town',
    'Otro',
];

const PURPOSES = [
    'Turismo / Vacaciones',
    'Ecoturismo',
    'Negocios',
    'Tránsito',
    'Investigación Científica',
    'Voluntariado',
    'Otro',
];

const NATIONALITIES = [
    'Panameño/a', 'Estadounidense', 'Canadiense', 'Alemán/a', 'Francés/a', 'Británico/a',
    'Español/a', 'Italiano/a', 'Australiano/a', 'Brasileño/a', 'Colombiano/a',
    'Costarricense', 'Holandés/a', 'Suizo/a', 'Japonés/a', 'Chino/a',
    'Mexicano/a', 'Argentino/a', 'Cubano/a', 'Venezolano/a', 'Nicaragüense', 'Otro',
];

export const PassportTax: React.FC<PassportTaxProps> = ({ currentUserName, municipalityInfo, onBack }) => {
    const [step, setStep] = useState<'form' | 'invoice'>('form');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanImage, setScanImage] = useState<string | null>(null);
    const [ocrProgress, setOcrProgress] = useState<number>(0);
    const [invoice, setInvoice] = useState<TourismInvoice | null>(null);
    const invoiceRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const today = new Date().toISOString().split('T')[0];

    const [formData, setFormData] = useState<PassportData>({
        passportNumber: '',
        fullName: '',
        nationality: '',
        dateOfBirth: '',
        entryDate: today,
        exitDate: '',
        entryPort: '',
        purpose: 'Turismo / Vacaciones',
        accommodation: '',
        phone: '',
        email: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const extractPassportData = (text: string) => {
        const fullText = text.toUpperCase();
        const lines = text.split('\n').map(l => l.trim().toUpperCase()).filter(l => l.length > 0);
        const result: Partial<PassportData> = {};

        console.log("Analyzing OCR lines:", lines);

        // 1. Passport Number: Avoid words like "PASSPORT", "PASAPORTE", "NUMBER"
        const forbiddenWords = ['PASSPORT', 'PASAPORTE', 'PASS', 'DOCUMENT', 'NUMBER', 'NOMBRE', 'REPUBLICA', 'PANAMA', 'COLOMBIA'];

        // Find alphanumeric strings of 6-15 chars that aren't forbidden
        const allPotentialIds: string[] = [];
        text.toUpperCase().match(/\b[A-Z0-9]{6,15}\b/g)?.forEach(match => {
            if (!forbiddenWords.includes(match) && /[0-9]/.test(match)) {
                allPotentialIds.push(match);
            }
        });

        if (allPotentialIds.length > 0) {
            // Usually the first numeric-heavy ID is the passport number
            result.passportNumber = allPotentialIds[0];
        }

        // 2. Name Detection: More robust
        const nameHeaders = ['NAME', 'NOMBRE', 'NOMBRES', 'APELLIDO', 'SURNAME', 'GIVEN'];
        let foundName = false;

        for (let i = 0; i < lines.length; i++) {
            if (nameHeaders.some(h => lines[i].includes(h))) {
                const nextLine = lines[i + 1] || '';
                // If header is on same line as value: "NAME: JOHN DOE"
                const parts = lines[i].split(/[:\-\.]/).map(p => p.trim());
                if (parts.length > 1 && parts[1].length > 3) {
                    result.fullName = parts[1];
                    foundName = true;
                    break;
                }
                // If value is on next line
                if (nextLine && nextLine.length > 4 && !nameHeaders.some(h => nextLine.includes(h))) {
                    result.fullName = nextLine;
                    foundName = true;
                    break;
                }
            }
        }

        // 3. Nationality: Check full text against our list
        for (const nationality of NATIONALITIES) {
            const country = nationality.split('/')[0].toUpperCase();
            if (fullText.includes(country)) {
                result.nationality = nationality;
                break;
            }
        }

        // 4. Date of Birth: Look for older dates (heuristic)
        const dateRegex = /\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\b/g;
        const matches = [...text.matchAll(dateRegex)];
        if (matches.length > 0) {
            // Prefer dates that look like birth dates (older) or just the first found
            result.dateOfBirth = matches[0][0].replace(/\//g, '-');
        }

        return result;
    };

    const [showScanSuccess, setShowScanSuccess] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();

            setIsScanning(true);
            setOcrProgress(0);
            setShowScanSuccess(false);

            reader.onloadend = async () => {
                const base64Image = reader.result as string;
                setScanImage(base64Image);

                try {
                    console.log("Starting OCR with Tesseract.recognize...");
                    const { data: { text } } = await Tesseract.recognize(
                        base64Image,
                        'eng',
                        {
                            logger: m => {
                                if (m.status === 'recognizing text') {
                                    setOcrProgress(Math.floor(m.progress * 100));
                                }
                            }
                        }
                    );

                    console.log("OCR Success. Extracted text:", text);
                    const extracted = extractPassportData(text);

                    setFormData(prev => ({
                        ...prev,
                        passportNumber: extracted.passportNumber || prev.passportNumber,
                        fullName: extracted.fullName || prev.fullName,
                        nationality: extracted.nationality || prev.nationality,
                        dateOfBirth: extracted.dateOfBirth || prev.dateOfBirth
                    }));

                    if (extracted.passportNumber || extracted.fullName) {
                        setShowScanSuccess(true);
                        setTimeout(() => setShowScanSuccess(false), 5000);
                    } else {
                        alert("No se detectaron datos claros. Por favor verifique los campos manualmente.");
                    }

                } catch (err) {
                    console.error("OCR Final Error:", err);
                    alert("Error al procesar la imagen (OCR). Verifique que sea una imagen clara del pasaporte.");
                } finally {
                    setIsScanning(false);
                    setScanImage(null);
                    setOcrProgress(0);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const triggerCamera = () => {
        fileInputRef.current?.click();
    };

    const setField = (field: keyof PassportData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const inputCls = (field: string) => `w-full p-3 rounded-xl border ${errors[field] ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-teal-500 bg-slate-50'} transition-all text-slate-700 outline-none`;

    const handleReset = () => {
        setFormData({
            passportNumber: '',
            fullName: '',
            nationality: '',
            dateOfBirth: '',
            entryDate: today,
            exitDate: '',
            entryPort: '',
            purpose: 'Turismo / Vacaciones',
            accommodation: '',
            phone: '',
            email: '',
        });
        setInvoice(null);
        setStep('form');
        setErrors({});
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!formData.passportNumber.trim()) errs.passportNumber = 'Número de pasaporte requerido';
        if (!formData.fullName.trim()) errs.fullName = 'Nombre completo requerido';
        if (!formData.nationality) errs.nationality = 'Seleccione la nacionalidad';
        if (!formData.dateOfBirth) errs.dateOfBirth = 'Fecha de nacimiento requerida';
        if (!formData.entryDate) errs.entryDate = 'Fecha de entrada requerida';
        if (!formData.entryPort) errs.entryPort = 'Puerto/Puesto de entrada requerido';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleGenerate = () => {
        if (!validate()) return;

        const verificationCode = `TURISMO-${Date.now().toString(36).toUpperCase()}-${formData.passportNumber.slice(-4).toUpperCase()}`;
        const invoiceId = `TUR-${Date.now()}`;
        const qrUrl = `https://changuinola.gob.pa/verify/tourism/${invoiceId}?code=${verificationCode}`;

        const newInvoice: TourismInvoice = {
            invoiceId,
            issuedAt: new Date().toISOString(),
            passportData: { ...formData },
            amount: TOURISM_TAX_RATE,
            taxType: 'IMPUESTO DE TURISMO MUNICIPAL',
            tellerName: currentUserName,
            verificationCode,
            qrUrl,
        };

        setInvoice(newInvoice);
        setStep('invoice');
    };

    const handlePrint = () => window.print();

    const handleDownloadPDF = async () => {
        const element = document.getElementById('tourism-invoice-print');
        if (!element) return;
        setIsGeneratingPdf(true);
        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                ignoreElements: (el) => el.classList.contains('no-print'),
                backgroundColor: '#ffffff',
                useCORS: true,
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, imgHeight);
            pdf.save(`Impuesto_Turismo_${invoice?.passportData.passportNumber}_${invoice?.invoiceId}.pdf`);
        } catch (e) {
            console.error('Error generating PDF:', e);
            alert('Error al generar el PDF.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // ═══════════════════════════════════════════════
    //  INVOICE VIEW
    // ═══════════════════════════════════════════════
    if (step === 'invoice' && invoice) {
        const issuedDate = new Date(invoice.issuedAt);
        const formattedDate = issuedDate.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        const formattedTime = issuedDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center py-6 px-4">

                {/* Control bar above invoice */}
                <div className="w-full max-w-2xl flex justify-between items-center mb-4 no-print">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        <BadgeCheck className="text-emerald-400" />
                        Factura Generada Exitosamente
                    </h2>
                    <div className="flex gap-3">
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg"
                        >
                            <Printer size={16} /> Imprimir
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPdf}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg disabled:opacity-50"
                        >
                            <Download size={16} /> {isGeneratingPdf ? 'Generando...' : 'PDF'}
                        </button>
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all"
                        >
                            <ArrowLeft size={16} /> Nuevo
                        </button>
                    </div>
                </div>

                {/* ════════ PRINTABLE INVOICE ════════ */}
                <div
                    id="tourism-invoice-print"
                    className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Top accent bar */}
                    <div className="h-3 bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-600" />

                    {/* Header */}
                    <div className="px-8 pt-6 pb-4 border-b-2 border-slate-200">
                        <div className="flex justify-between items-start">
                            <div className="flex items-start gap-4">
                                <img
                                    src={`${import.meta.env.BASE_URL}municipio-logo-bw.png`}
                                    alt="Logo Municipio"
                                    className="h-20 w-auto object-contain grayscale"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                                <div>
                                    <h1 className="font-extrabold text-slate-900 text-base uppercase leading-tight">
                                        {municipalityInfo.name}
                                    </h1>
                                    <p className="text-xs text-slate-500 mt-0.5">{municipalityInfo.province}</p>
                                    <p className="text-xs text-slate-500">RUC: {municipalityInfo.ruc}</p>
                                    <div className="mt-2 inline-flex items-center gap-1 bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                        <Globe size={10} /> Dirección de Turismo Municipal
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="inline-block bg-slate-900 text-white px-4 py-2 rounded-xl">
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Nº Factura</p>
                                    <p className="font-mono font-extrabold text-emerald-400 text-base tracking-wider">{invoice.invoiceId}</p>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">{formattedDate}</p>
                                <p className="text-xs text-slate-400">{formattedTime} hrs</p>
                            </div>
                        </div>
                    </div>

                    {/* Title Band */}
                    <div className="bg-gradient-to-r from-teal-600 to-emerald-700 px-8 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Globe className="text-white" size={22} />
                            <div>
                                <h2 className="text-white font-extrabold text-base uppercase tracking-wide">
                                    Comprobante de Impuesto al Turismo
                                </h2>
                                <p className="text-teal-100 text-[10px] font-medium">
                                    Ley Municipal de Turismo — Municipio de Changuinola
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-teal-100 text-xs font-bold">TOTAL</p>
                            <p className="text-white font-extrabold text-2xl">B/. {invoice.amount.toFixed(2)}</p>
                        </div>
                    </div>

                    {/* Body: Two Columns */}
                    <div className="px-8 py-5 grid grid-cols-2 gap-x-8 gap-y-4">

                        {/* Passport Info */}
                        <div className="col-span-2">
                            <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3 border-b border-slate-100 pb-1 flex items-center gap-1">
                                <FileText size={10} /> Datos del Pasaporte / Viajero
                            </h3>
                        </div>

                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Número de Pasaporte</p>
                            <p className="font-mono font-extrabold text-slate-900 text-base tracking-widest bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg inline-block">
                                {invoice.passportData.passportNumber}
                            </p>
                        </div>

                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Nombre Completo</p>
                            <p className="font-bold text-slate-900 text-sm">{invoice.passportData.fullName}</p>
                        </div>

                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Nacionalidad</p>
                            <p className="text-slate-700 text-sm font-medium flex items-center gap-1">
                                <Globe size={12} className="text-teal-500" /> {invoice.passportData.nationality}
                            </p>
                        </div>

                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Fecha de Nacimiento</p>
                            <p className="text-slate-700 text-sm font-medium">{invoice.passportData.dateOfBirth}</p>
                        </div>

                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Fecha de Entrada</p>
                            <p className="text-slate-700 text-sm font-medium flex items-center gap-1">
                                <Calendar size={12} className="text-emerald-500" /> {invoice.passportData.entryDate}
                            </p>
                        </div>

                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Fecha de Salida Prevista</p>
                            <p className="text-slate-700 text-sm font-medium flex items-center gap-1">
                                <Calendar size={12} className="text-rose-400" /> {invoice.passportData.exitDate || 'No especificada'}
                            </p>
                        </div>

                        <div className="col-span-2">
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Puerto / Puesto de Entrada</p>
                            <p className="text-slate-700 text-sm font-medium flex items-center gap-1">
                                <MapPin size={12} className="text-blue-500" /> {invoice.passportData.entryPort}
                            </p>
                        </div>

                        <div>
                            <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Propósito de Visita</p>
                            <p className="text-slate-700 text-sm">{invoice.passportData.purpose}</p>
                        </div>

                        {invoice.passportData.accommodation && (
                            <div>
                                <p className="text-[9px] uppercase text-slate-400 font-bold mb-0.5">Hospedaje</p>
                                <p className="text-slate-700 text-sm">{invoice.passportData.accommodation}</p>
                            </div>
                        )}

                        {/* Financial Details */}
                        <div className="col-span-2 mt-2">
                            <h3 className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-3 border-b border-slate-100 pb-1 flex items-center gap-1">
                                <Globe size={10} /> Detalles de Pago
                            </h3>
                        </div>

                        <div className="col-span-2 bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-100">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Concepto</p>
                                <p className="text-slate-800 font-bold text-sm">{invoice.taxType}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5 tracking-tighter uppercase font-medium">Tasa Única por Estadía — Municipio de Changuinola</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Cancelado</p>
                                <p className="text-2xl font-black text-slate-900 tracking-tighter">B/. {invoice.amount.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Verification Section */}
                        <div className="col-span-2 mt-4 bg-teal-50 rounded-2xl p-5 border border-teal-100 flex items-center gap-6">
                            <div className="bg-white p-2 rounded-xl shadow-sm border border-teal-100">
                                <QRCodeSVG value={invoice.qrUrl} size={110} level="H" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-teal-800 font-extrabold text-sm uppercase tracking-wide flex items-center gap-2">
                                    <BadgeCheck size={18} className="text-teal-600" />
                                    Código QR de Verificación
                                </h4>
                                <p className="text-teal-700 text-[10px] mt-1 leading-relaxed font-medium">
                                    Este código confirma la validez del pago ante las autoridades municipales y de seguridad en puestos de control.
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                    <div className="bg-teal-600/10 text-teal-700 font-mono text-[10px] px-3 py-1 rounded-full font-bold border border-teal-200 uppercase tracking-widest">
                                        ID: {invoice.verificationCode}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-50 px-8 py-6 border-t border-slate-100">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[9px] uppercase text-slate-400 font-bold mb-1">Cajero / Recaudador</p>
                                <p className="text-slate-700 font-bold text-sm flex items-center gap-1.5">
                                    <User size={12} className="text-slate-400" /> {invoice.tellerName}
                                </p>
                                <p className="text-[9px] text-amber-700 font-bold uppercase tracking-wider mt-3">
                                    ⚠ Documento oficial — Conserve durante toda su estadía
                                </p>
                            </div>
                            <p className="text-[8px] text-slate-400 text-right leading-relaxed max-w-[200px]">
                                Generado por Plataforma SIGMA Digital • Municipio de Changuinola, Panamá •{' '}
                                Verificable en: <span className="font-mono font-bold">changuinola.gob.pa/verify</span>
                            </p>
                        </div>
                    </div>

                    {/* Bottom accent bar */}
                    <div className="h-2 bg-gradient-to-r from-emerald-600 via-teal-500 to-blue-600" />
                </div>

                {/* Done button below */}
                <button
                    onClick={onBack}
                    className="no-print mt-6 text-slate-400 hover:text-white text-sm flex items-center gap-2 transition-colors"
                >
                    <ArrowLeft size={16} /> Volver al Digitalizador
                </button>
            </div>
        );
    }

    // ═══════════════════════════════════════════════
    //  FORM VIEW
    // ═══════════════════════════════════════════════
    return (
        <div className="max-w-3xl mx-auto pb-20">

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
                        <span className="p-2 bg-teal-100 rounded-xl">
                            <Globe className="text-teal-600" size={24} />
                        </span>
                        Digitalizar Pasaporte — Impuesto al Turismo
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        Registre los datos del viajero y genere el comprobante con código QR para verificación.
                    </p>
                </div>
            </div>

            {/* Rate Badge */}
            <div className="mb-6 flex items-center gap-4 bg-gradient-to-r from-teal-600 to-emerald-700 text-white rounded-2xl px-6 py-4 shadow-lg shadow-teal-200">
                <Globe size={36} className="opacity-80 flex-shrink-0" />
                <div className="flex-1">
                    <p className="text-teal-100 text-xs font-bold uppercase tracking-wider">Tasa Municipal de Turismo</p>
                    <p className="text-3xl font-extrabold">B/. {TOURISM_TAX_RATE.toFixed(2)} <span className="text-lg font-medium text-teal-200">/ por viajero</span></p>
                </div>
                <div className="text-right text-xs text-teal-100">
                    <p className="font-bold">La factura generada incluye</p>
                    <p>✓ Código QR de verificación</p>
                    <p>✓ Datos del viajero</p>
                    <p>✓ Código único de control</p>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-6">
                {showScanSuccess && (
                    <div className="bg-emerald-500 text-white px-6 py-3 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-3">
                            <Check size={20} className="bg-emerald-400 p-0.5 rounded-full" />
                            <span className="font-bold text-sm">Datos detectados y cargados correctamente</span>
                        </div>
                        <span className="text-xs bg-emerald-600/50 px-2 py-1 rounded">Verifique los campos</span>
                    </div>
                )}
                <div className="bg-slate-50 p-6 border-b border-slate-100">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div
                            onClick={triggerCamera}
                            className={`w-full md:w-48 h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${isScanning ? 'border-teal-400 bg-teal-50' : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'}`}
                        >
                            {isScanning ? (
                                <div className="text-center">
                                    <Loader2 className="animate-spin text-teal-600 mx-auto mb-2" size={32} />
                                    <p className="text-[10px] font-bold text-teal-700 uppercase tracking-widest">Escaneando...</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <Camera className="text-slate-400 mx-auto mb-2" size={32} />
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center px-2">Escanear Pasaporte</p>
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*"
                                capture="environment"
                            />
                        </div>
                        <div className="flex-1">
                            <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                                <Scan size={18} className="text-teal-600" />
                                Llenado Automático Inteligente
                            </h4>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Tome una foto nítida de la página principal del pasaporte. El sistema detectará automáticamente el número, nombre y nacionalidad para agilizar el cobro.
                            </p>
                            {isScanning && (
                                <div className="mt-3 bg-teal-100 rounded-full h-1.5 w-full overflow-hidden">
                                    <div className="bg-teal-600 h-full animate-pulse shadow-[0_0_10px_rgba(13,148,136,0.5)]" style={{ width: '100%' }}></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* SECTION 1: Passport Info */}
                <div className="border-b border-slate-100">
                    <div className="px-6 pt-6 pb-4">
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 mb-4">
                            <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-extrabold">1</span>
                            Datos del Pasaporte
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                                    Número de Pasaporte <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.passportNumber}
                                    onChange={e => setField('passportNumber', e.target.value.toUpperCase())}
                                    className={`${inputCls('passportNumber')} font-mono text-base tracking-widest uppercase`}
                                    placeholder="Ej. AB1234567"
                                />
                                {errors.passportNumber && <p className="text-red-500 text-xs mt-1">{errors.passportNumber}</p>}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                                    Nombre Completo (como aparece en pasaporte) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={e => setField('fullName', e.target.value.toUpperCase())}
                                    className={`${inputCls('fullName')} uppercase font-semibold`}
                                    placeholder="Ej. JOHN MICHAEL DOE"
                                />
                                {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                                    Nacionalidad <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.nationality}
                                    onChange={e => setField('nationality', e.target.value)}
                                    className={inputCls('nationality')}
                                >
                                    <option value="">Seleccionar...</option>
                                    {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                                {errors.nationality && <p className="text-red-500 text-xs mt-1">{errors.nationality}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                                    Fecha de Nacimiento <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.dateOfBirth}
                                    onChange={e => setField('dateOfBirth', e.target.value)}
                                    className={inputCls('dateOfBirth')}
                                />
                                {errors.dateOfBirth && <p className="text-red-500 text-xs mt-1">{errors.dateOfBirth}</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: Visit Details */}
                <div className="border-b border-slate-100">
                    <div className="px-6 py-5">
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 mb-4">
                            <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-extrabold">2</span>
                            Detalles de la Visita
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                                    Fecha de Entrada <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.entryDate}
                                    onChange={e => setField('entryDate', e.target.value)}
                                    className={inputCls('entryDate')}
                                />
                                {errors.entryDate && <p className="text-red-500 text-xs mt-1">{errors.entryDate}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                                    Fecha de Salida Prevista
                                </label>
                                <input
                                    type="date"
                                    value={formData.exitDate}
                                    onChange={e => setField('exitDate', e.target.value)}
                                    className={inputCls('exitDate')}
                                    min={formData.entryDate}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                                    Puerto / Puesto de Entrada <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.entryPort}
                                    onChange={e => setField('entryPort', e.target.value)}
                                    className={inputCls('entryPort')}
                                >
                                    <option value="">Seleccionar...</option>
                                    {ENTRY_PORTS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                {errors.entryPort && <p className="text-red-500 text-xs mt-1">{errors.entryPort}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                                    Propósito de la Visita
                                </label>
                                <select
                                    value={formData.purpose}
                                    onChange={e => setField('purpose', e.target.value)}
                                    className={inputCls('purpose')}
                                >
                                    {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">
                                    Lugar de Hospedaje
                                </label>
                                <input
                                    type="text"
                                    value={formData.accommodation}
                                    onChange={e => setField('accommodation', e.target.value)}
                                    className={inputCls('accommodation')}
                                    placeholder="Hotel, Hostal, Airbnb..."
                                />
                            </div>

                        </div>
                    </div>
                </div>

                {/* SECTION 3: Contact (optional) */}
                <div className="border-b border-slate-100">
                    <div className="px-6 py-5">
                        <h3 className="font-bold text-slate-800 text-base flex items-center gap-2 mb-4">
                            <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-extrabold">3</span>
                            Contacto <span className="text-slate-400 text-xs font-normal ml-1">(Opcional)</span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">Teléfono / WhatsApp</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setField('phone', e.target.value)}
                                    className={inputCls('phone')}
                                    placeholder="+1 (000) 000-0000"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5 tracking-wider">Correo Electrónico</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setField('email', e.target.value)}
                                    className={inputCls('email')}
                                    placeholder="email@example.com"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary & Submit */}
                <div className="px-6 py-6 bg-slate-50">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Cajero</p>
                            <p className="text-slate-700 font-bold">{currentUserName}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Monto a Cobrar</p>
                            <p className="text-3xl font-extrabold text-teal-700">B/. {TOURISM_TAX_RATE.toFixed(2)}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-lg shadow-xl shadow-teal-200 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                    >
                        <Globe size={22} />
                        COBRAR B/. {TOURISM_TAX_RATE.toFixed(2)} Y GENERAR FACTURA CON QR
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-3 flex items-center justify-center gap-1">
                        <Shield size={12} />
                        La factura incluirá un QR único para verificación en puestos de control
                    </p>
                </div>
            </div>
        </div>
    );
};
