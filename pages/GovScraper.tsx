import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    Globe, Search, Download, CheckCircle2, XCircle, AlertTriangle,
    Loader2, MapPin, ChevronDown, ChevronUp, ExternalLink, Info,
    UserPlus, ScanLine, Clock, Upload, FileSpreadsheet, Eye,
    ArrowRight, BookOpen, MousePointer, FileDown, Table2, X, CheckCheck
} from 'lucide-react';
import { Taxpayer, TaxpayerType, TaxpayerStatus, CommercialCategory, Corregimiento } from '../types';

// ============================================================
// TYPES
// ============================================================
interface ScrapedBusiness {
    nombreComercial: string;
    nombrePropietario?: string;
    ruc?: string;
    dv?: string;
    actividad?: string;
    corregimiento?: string;
    distrito: string;
    provincia: string;
    direccion?: string;
    fechaAviso?: string;
    estado?: string;
    avisoOperaciones?: string;
    source: 'PANAMA_EMPRENDE' | 'DEMO_DATA';
    matchStatus?: 'UNREGISTERED' | 'REGISTERED' | 'POSSIBLE_MATCH';
    matchedTaxpayerId?: string;
}
interface GovScraperProps {
    taxpayers: Taxpayer[];
    onImportTaxpayer: (taxpayer: Taxpayer) => void;
    currentUserName: string;
    onBack?: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const CORREGIMIENTOS = [
    'Changuinola', 'Almirante', 'Banca', 'Basimento', 'Bocas del Toro', 'Boca del Drago',
    'Caldera', 'Chiriqui Grande', 'El Empalme', 'Guabito', 'Las Delicias', 'Miramar',
    'Punta Pena', 'Rambala', 'San San', 'El Silencio', 'Teribe', 'Valle Escondido',
];

// ============================================================
// HELPERS
// ============================================================
function compareBusiness(b: ScrapedBusiness, taxpayers: Taxpayer[]): ScrapedBusiness {
    if (!b.ruc) return { ...b, matchStatus: 'UNREGISTERED' };
    const rucClean = b.ruc.replace(/[-\s]/g, '').toUpperCase();
    const nameKey = b.nombreComercial.toLowerCase().substring(0, 8);
    for (const tp of taxpayers) {
        if (tp.docId.replace(/[-\s]/g, '').toUpperCase() === rucClean)
            return { ...b, matchStatus: 'REGISTERED', matchedTaxpayerId: tp.id };
        if (tp.name.toLowerCase().includes(nameKey) || nameKey.includes(tp.name.toLowerCase().substring(0, 8)))
            return { ...b, matchStatus: 'POSSIBLE_MATCH', matchedTaxpayerId: tp.id };
    }
    return { ...b, matchStatus: 'UNREGISTERED' };
}

function normalize(s: string) { return s.toLowerCase().replace(/[^a-z]/g, ''); }

function guessCorregimiento(text: string): string {
    const map: [string, string][] = [
        ['almirante', 'Almirante'], ['guabito', 'Guabito'], ['caldera', 'Caldera'],
        ['chiriqui grande', 'Chiriqui Grande'], ['chirigui', 'Chiriqui Grande'],
        ['empalme', 'El Empalme'], ['delicias', 'Las Delicias'], ['silencio', 'El Silencio'],
        ['bocas del toro', 'Bocas del Toro'], ['basimento', 'Basimento'],
        ['boca del drago', 'Boca del Drago'], ['drago', 'Boca del Drago'],
        ['miramar', 'Miramar'], ['rambala', 'Rambala'], ['san san', 'San San'],
        ['teribe', 'Teribe'], ['punta pena', 'Punta Pena'], ['valle escondido', 'Valle Escondido'],
        ['banca', 'Banca'], ['changuinola', 'Changuinola'],
    ];
    const t = text.toLowerCase();
    for (const [key, val] of map) { if (t.includes(key)) return val; }
    return 'Changuinola';
}

// ============================================================
// CSV/EXCEL PARSER — soporta formato Panama Emprende
// ============================================================
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
            result.push(current.trim()); current = '';
        } else { current += ch; }
    }
    result.push(current.trim());
    return result;
}

function parseFileContent(text: string): ScrapedBusiness[] {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => normalize(h));

    // Map headers to known Panama Emprende columns
    const colMap: Record<string, number> = {};
    const ALIASES: Record<string, string[]> = {
        nombre: ['razonsocial', 'nombre', 'razon', 'nombrecomercial', 'nombreempresa', 'empresa'],
        ruc: ['ruc', 'cedula', 'cedulaoruc', 'numeroruc', 'documentoid', 'docid'],
        aviso: ['aviso', 'numeroaviso', 'numerooperacion', 'avisooperaciones'],
        actividad: ['actividad', 'actividadeconomica', 'giro', 'descripcion', 'tipoactividad'],
        estado: ['estado', 'estatus', 'status'],
        fecha: ['fecha', 'fechaaviso', 'fechainicio', 'fecharegistro', 'inicio'],
        dv: ['dv', 'digitoverificador'],
        propietario: ['propietario', 'dueno', 'duenio', 'representante', 'owner'],
        direccion: ['direccion', 'address', 'ubicacion'],
    };
    headers.forEach((h, i) => {
        for (const [field, aliases] of Object.entries(ALIASES)) {
            if (!colMap[field] && aliases.some(a => h.includes(a))) colMap[field] = i;
        }
    });

    const get = (row: string[], field: string) =>
        colMap[field] !== undefined ? (row[colMap[field]] || '').trim() : '';

    const businesses: ScrapedBusiness[] = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.every(c => !c.trim())) continue;

        const nombre = get(row, 'nombre') || row[0] || '';
        if (!nombre || nombre.length < 2) continue;
        // Skip if it looks like a second header row
        if (/raz[oó]n|nombre emp|n[uú]mero aviso/i.test(nombre)) continue;

        const rucRaw = get(row, 'ruc');
        const corr = guessCorregimiento(nombre + ' ' + get(row, 'direccion') + ' ' + get(row, 'actividad'));

        businesses.push({
            nombreComercial: nombre.toUpperCase(),
            ruc: rucRaw || undefined,
            dv: get(row, 'dv') || undefined,
            avisoOperaciones: get(row, 'aviso') || undefined,
            actividad: get(row, 'actividad') || undefined,
            estado: get(row, 'estado') || 'ACTIVO',
            fechaAviso: get(row, 'fecha') || undefined,
            nombrePropietario: get(row, 'propietario') || undefined,
            direccion: get(row, 'direccion') || undefined,
            corregimiento: corr,
            distrito: 'Changuinola',
            provincia: 'Bocas del Toro',
            source: 'PANAMA_EMPRENDE',
        });
    }
    return businesses;
}

// ============================================================
// INSTRUCTION STEPS component
// ============================================================
const STEPS = [
    {
        icon: <Globe size={20} className="text-indigo-400" />,
        title: 'Abrir el portal',
        desc: 'Ve a panamaemprende.gob.pa y haz clic en "Consulta Pública" en el menú superior.',
        link: 'https://www.panamaemprende.gob.pa/consulta-publica-new',
        linkLabel: 'Ir al portal →',
    },
    {
        icon: <MousePointer size={20} className="text-indigo-400" />,
        title: 'Buscar por ubicación',
        desc: 'En el campo "Razón Social" escribe "Changuinola" y haz clic en Buscar. Luego repite con "Almirante", "Guabito", etc.',
    },
    {
        icon: <FileDown size={20} className="text-indigo-400" />,
        title: 'Exportar los resultados',
        desc: 'En la tabla de resultados busca el botón "Exportar" o "CSV/Excel". Si no aparece, selecciona toda la tabla, cópiala y pégala en un archivo Excel.',
    },
    {
        icon: <Upload size={20} className="text-indigo-400" />,
        title: 'Cargar aquí',
        desc: 'Arrastra o selecciona el archivo CSV o Excel exportado en la zona de carga de abajo.',
    },
];

// ============================================================
// MAIN COMPONENT
// ============================================================
export const GovScraper: React.FC<GovScraperProps> = ({
    taxpayers, onImportTaxpayer, currentUserName, onBack
}) => {
    const [mode, setMode] = useState<'auto' | 'manual'>('manual');

    // --- AUTO mode state ---
    const [selectedCorrs, setSelectedCorrs] = useState<string[]>(CORREGIMIENTOS);
    const [isLoading, setIsLoading] = useState(false);
    const [autoMessage, setAutoMessage] = useState('');

    // --- Shared results state ---
    const [businesses, setBusinesses] = useState<ScrapedBusiness[]>([]);
    const [filter, setFilter] = useState<'all' | 'unregistered' | 'registered' | 'possible'>('unregistered');
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const [imported, setImported] = useState<Set<number>>(new Set());
    const [scrapedAt, setScrapedAt] = useState('');

    // --- Manual import state ---
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState('');
    const [parseErrors, setParseErrors] = useState<string[]>([]);
    const [showSteps, setShowSteps] = useState(true);
    const fileRef = useRef<HTMLInputElement>(null);

    // ---- Process & compare businesses ----
    const processBatch = useCallback((raw: ScrapedBusiness[]) => {
        const compared = raw.map(b => compareBusiness(b, taxpayers));
        setBusinesses(compared);
        setScrapedAt(new Date().toISOString());
        setImported(new Set());
        setExpanded(new Set());
    }, [taxpayers]);

    // ---- AUTO: call Edge Function ----
    const handleAutoScrape = useCallback(async () => {
        setIsLoading(true);
        setAutoMessage('Contactando portal Panama Emprende...');
        try {
            const params = selectedCorrs.length === CORREGIMIENTOS.length ? 'all=true' : `corregimiento=${encodeURIComponent(selectedCorrs[0])}`;
            const res = await fetch(`${SUPABASE_URL}/functions/v1/scrape-panama-emprende?${params}`, {
                headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
            });
            const data = await res.json();
            setAutoMessage(data.message || '');
            // Remark source to have Edge metadata
            const raw: ScrapedBusiness[] = (data.businesses || []).map((b: ScrapedBusiness) => ({
                ...b,
                source: 'PANAMA_EMPRENDE' as const,
            }));
            processBatch(raw);
        } catch (e: any) {
            setAutoMessage(`Error: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCorrs, processBatch]);

    // ---- MANUAL: parse uploaded file ----
    const handleFile = useCallback((file: File) => {
        setParseErrors([]);
        const validTypes = ['text/csv', 'application/vnd.ms-excel', '.csv', '.xlsx', '.xls', '.txt'];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!['csv', 'xls', 'xlsx', 'txt'].includes(ext)) {
            setParseErrors(['Formato no soportado. Use CSV, Excel (.xlsx/.xls) o TXT.']);
            return;
        }
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            try {
                const raw = parseFileContent(text);
                if (raw.length === 0) {
                    setParseErrors(['No se encontraron registros válidos. Verifique que el archivo tenga encabezados como "Razón Social", "RUC", "Aviso de Operación".']);
                    return;
                }
                processBatch(raw);
                setShowSteps(false);
            } catch (e: any) {
                setParseErrors([`Error al leer el archivo: ${e.message}`]);
            }
        };
        reader.readAsText(file, 'UTF-8');
    }, [processBatch]);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    // ---- Import a single business ----
    const handleImport = (biz: ScrapedBusiness, idx: number) => {
        const tp: Taxpayer = {
            id: `PE-${Date.now()}-${idx}`,
            taxpayerNumber: `${new Date().getFullYear()}-PE-${Math.floor(1000 + Math.random() * 9000)}`,
            type: biz.ruc && biz.ruc.split('-').length >= 3 ? TaxpayerType.JURIDICA : TaxpayerType.NATURAL,
            status: TaxpayerStatus.ACTIVO,
            docId: (biz.ruc || '').replace(/[-\s]/g, ''),
            dv: biz.dv || '',
            name: biz.nombreComercial,
            address: biz.direccion || biz.corregimiento || '',
            corregimiento: (biz.corregimiento || 'Changuinola') as Corregimiento,
            phone: '', email: '',
            hasCommercialActivity: true,
            commercialCategory: CommercialCategory.CLASE_B,
            commercialName: biz.nombreComercial,
            hasConstruction: false, hasGarbageService: false,
            balance: 0, vehicles: [], documents: {},
            createdAt: new Date().toISOString().split('T')[0],
        };
        onImportTaxpayer(tp);
        setImported(prev => new Set([...prev, idx]));
        setBusinesses(prev => prev.map((b, i) => i === idx ? { ...b, matchStatus: 'REGISTERED' } : b));
    };

    // ---- Import ALL unregistered ----
    const handleImportAll = () => {
        businesses.forEach((b, i) => {
            if (b.matchStatus === 'UNREGISTERED' && !imported.has(i)) handleImport(b, i);
        });
    };

    // ---- Export unregistered CSV ----
    const exportCSV = () => {
        const rows = businesses.filter(b => b.matchStatus === 'UNREGISTERED');
        const header = 'Nombre Comercial,RUC,DV,Actividad,Corregimiento,Aviso Operaciones,Fecha Aviso,Estado';
        const lines = rows.map(b => `"${b.nombreComercial}","${b.ruc || ''}","${b.dv || ''}","${b.actividad || ''}","${b.corregimiento || ''}","${b.avisoOperaciones || ''}","${b.fechaAviso || ''}","${b.estado || ''}"`);
        const csv = [header, ...lines].join('\n');
        const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: `no_inscritos_changuinola_${new Date().toISOString().split('T')[0]}.csv` });
        a.click(); URL.revokeObjectURL(url);
    };

    // ---- Filter ----
    const filtered = businesses
        .filter(b => {
            if (filter === 'unregistered') return b.matchStatus === 'UNREGISTERED';
            if (filter === 'registered') return b.matchStatus === 'REGISTERED';
            if (filter === 'possible') return b.matchStatus === 'POSSIBLE_MATCH';
            return true;
        })
        .filter(b => !search || b.nombreComercial.toLowerCase().includes(search.toLowerCase()) || (b.ruc || '').includes(search) || (b.corregimiento || '').toLowerCase().includes(search.toLowerCase()));

    const unrCount = businesses.filter(b => b.matchStatus === 'UNREGISTERED').length;
    const regCount = businesses.filter(b => b.matchStatus === 'REGISTERED').length;
    const possCount = businesses.filter(b => b.matchStatus === 'POSSIBLE_MATCH').length;

    const STATUS = {
        UNREGISTERED: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', icon: <XCircle size={14} className="text-red-500 flex-shrink-0" />, label: 'No Inscrito' },
        POSSIBLE_MATCH: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', icon: <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />, label: 'Posible Match' },
        REGISTERED: { bg: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />, label: 'Inscrito' },
    };

    return (
        <div className="max-w-7xl mx-auto pb-20 space-y-6">

            {/* ── Header ── */}
            <div className="flex items-start gap-4">
                {onBack && (
                    <button onClick={onBack} className="mt-1 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600">
                        <ArrowRight size={20} className="rotate-180" />
                    </button>
                )}
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2.5 bg-indigo-100 rounded-xl"><Globe className="text-indigo-600" size={26} /></div>
                        <div>
                            <h2 className="text-2xl font-extrabold text-slate-800">Importar desde Panama Emprende</h2>
                            <p className="text-slate-500 text-sm">Detecta negocios con Aviso de Operaciones no inscritos en el municipio</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 ml-14">
                        <a href="https://www.panamaemprende.gob.pa/consulta-publica-new" target="_blank" rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
                            <ExternalLink size={12} /> panamaemprende.gob.pa
                        </a>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} /> Distrito de Changuinola</span>
                    </div>
                </div>

                {/* Mode toggle */}
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1 text-xs font-bold flex-shrink-0">
                    <button
                        onClick={() => setMode('manual')}
                        className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition ${mode === 'manual' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                    ><Upload size={13} /> Importar Archivo</button>
                    <button
                        onClick={() => setMode('auto')}
                        className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition ${mode === 'auto' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
                    ><ScanLine size={13} /> Auto Scraping</button>
                </div>
            </div>

            {/* ══════════════════════════════════════════ */}
            {/* MODO MANUAL                               */}
            {/* ══════════════════════════════════════════ */}
            {mode === 'manual' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* LEFT: instrucciones + upload */}
                    <div className="lg:col-span-1 space-y-4">

                        {/* Instruction card */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <button
                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition"
                                onClick={() => setShowSteps(v => !v)}
                            >
                                <span className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                                    <BookOpen size={16} className="text-indigo-500" />
                                    Cómo exportar desde el portal
                                </span>
                                {showSteps ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                            </button>

                            {showSteps && (
                                <div className="px-4 pb-4 space-y-3">
                                    {STEPS.map((step, i) => (
                                        <div key={i} className="flex gap-3">
                                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-xs font-black text-indigo-600">{i + 1}</div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    {step.icon}
                                                    <p className="font-bold text-slate-700 text-xs">{step.title}</p>
                                                </div>
                                                <p className="text-slate-500 text-[11px] leading-relaxed">{step.desc}</p>
                                                {step.link && (
                                                    <a href={step.link} target="_blank" rel="noopener noreferrer"
                                                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-indigo-600 font-bold hover:underline">
                                                        {step.linkLabel} <ExternalLink size={10} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Tip */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                        <p className="text-amber-800 text-[11px] font-medium leading-relaxed">
                                            💡 <strong>Tip:</strong> En el portal, busca por <em>Changuinola</em>, <em>Almirante</em>, <em>Guabito</em>, etc. en el campo "Razón Social". Exporta cada resultado y carga el archivo aquí.
                                        </p>
                                    </div>

                                    {/* Supported columns */}
                                    <div className="bg-slate-50 rounded-xl p-3">
                                        <p className="text-slate-600 text-[11px] font-bold mb-1.5 uppercase tracking-wide">Columnas reconocidas automáticamente</p>
                                        <div className="flex flex-wrap gap-1">
                                            {['Razón Social', 'RUC', 'Aviso', 'Actividad', 'Estado', 'Fecha', 'DV', 'Propietario'].map(c => (
                                                <span key={c} className="text-[10px] bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-mono">{c}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Upload Zone */}
                        <div
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
                                }`}
                        >
                            <input
                                ref={fileRef} type="file" className="hidden"
                                accept=".csv,.xls,.xlsx,.txt"
                                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                            />
                            <div className="flex flex-col items-center gap-3">
                                <div className={`p-4 rounded-2xl transition ${isDragging ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                                    <FileSpreadsheet size={32} className={isDragging ? 'text-indigo-500' : 'text-slate-400'} />
                                </div>
                                {fileName ? (
                                    <div>
                                        <p className="text-indigo-700 font-bold text-sm">{fileName}</p>
                                        <p className="text-slate-400 text-xs mt-0.5">Clic para cambiar archivo</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-slate-700 font-bold text-sm">Arrastra el archivo aquí</p>
                                        <p className="text-slate-400 text-xs mt-0.5">o haz clic para seleccionar</p>
                                        <p className="text-slate-300 text-[11px] mt-1">CSV · XLS · XLSX · TXT</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Parse errors */}
                        {parseErrors.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                {parseErrors.map((e, i) => (
                                    <p key={i} className="text-red-700 text-xs flex items-start gap-1.5">
                                        <XCircle size={12} className="flex-shrink-0 mt-0.5" /> {e}
                                    </p>
                                ))}
                            </div>
                        )}

                        {/* Column tips */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                            <p className="text-indigo-800 font-bold text-xs mb-2 flex items-center gap-1.5">
                                <Table2 size={13} /> Formato esperado del CSV
                            </p>
                            <div className="overflow-x-auto">
                                <table className="text-[10px] w-full border-collapse">
                                    <thead>
                                        <tr className="bg-indigo-100">
                                            {['Razón Social', 'RUC', 'Aviso', 'Actividad', 'Estado'].map(h => (
                                                <th key={h} className="px-1.5 py-1 text-indigo-700 font-bold text-left border border-indigo-200">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="bg-white">
                                            {['SUPER EL BUEN PRECIO', '8-123-456', 'AO-2024-001', 'Abarrotes', 'ACTIVO'].map((c, i) => (
                                                <td key={i} className="px-1.5 py-1 text-slate-600 border border-indigo-100 font-mono">{c}</td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: results */}
                    {businesses.length > 0 ? (
                        <div className="lg:col-span-2 space-y-4">
                            <ResultsPanel
                                businesses={businesses} filter={filter} setFilter={setFilter}
                                search={search} setSearch={setSearch} filtered={filtered}
                                unrCount={unrCount} regCount={regCount} possCount={possCount}
                                expanded={expanded} setExpanded={setExpanded}
                                imported={imported} handleImport={handleImport}
                                exportCSV={exportCSV} handleImportAll={handleImportAll}
                                scrapedAt={scrapedAt} STATUS={STATUS}
                                sourceLabel="Archivo importado manualmente"
                            />
                        </div>
                    ) : (
                        <div className="lg:col-span-2 flex items-center justify-center">
                            <div className="text-center py-20">
                                <FileSpreadsheet size={56} className="text-slate-200 mx-auto mb-4" />
                                <h3 className="text-slate-500 font-bold mb-2">Esperando archivo</h3>
                                <p className="text-slate-400 text-sm max-w-sm">
                                    Exporta los resultados desde <strong>panamaemprende.gob.pa</strong> siguiendo los pasos de la izquierda, luego carga el archivo CSV o Excel aquí.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════ */}
            {/* MODO AUTO SCRAPING                        */}
            {/* ══════════════════════════════════════════ */}
            {mode === 'auto' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-1 space-y-4">

                        {/* Info card */}
                        <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 text-white rounded-2xl p-5 shadow-xl">
                            <div className="flex items-center gap-2 mb-3">
                                <ScanLine size={20} className="text-indigo-300" />
                                <h3 className="font-bold text-sm">Consulta Automática</h3>
                            </div>
                            <p className="text-indigo-200 text-xs leading-relaxed mb-3">
                                La Edge Function de Supabase intenta conectar al portal MICI. Si detecta reCAPTCHA, usa la base de referencia del Distrito de Changuinola.
                            </p>
                            {autoMessage && (
                                <div className="bg-white/10 rounded-xl p-2.5 text-indigo-100 text-[11px] leading-relaxed">{autoMessage}</div>
                            )}
                        </div>

                        {/* Corregimiento selector */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex justify-between mb-3">
                                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                                    <MapPin size={14} className="text-indigo-500" />
                                    Corregimientos ({selectedCorrs.length}/{CORREGIMIENTOS.length})
                                </h4>
                                <div className="flex gap-2 text-xs">
                                    <button onClick={() => setSelectedCorrs([...CORREGIMIENTOS])} className="text-indigo-600 font-bold hover:underline">Todos</button>
                                    <span className="text-slate-300">|</span>
                                    <button onClick={() => setSelectedCorrs([])} className="text-slate-400 hover:underline">Ninguno</button>
                                </div>
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-0.5">
                                {CORREGIMIENTOS.map(c => (
                                    <label key={c} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm transition ${selectedCorrs.includes(c) ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                                        <input type="checkbox" checked={selectedCorrs.includes(c)}
                                            onChange={() => setSelectedCorrs(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                                            className="accent-indigo-600 rounded"
                                        />
                                        {c}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={handleAutoScrape} disabled={isLoading || selectedCorrs.length === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-200"
                        >
                            {isLoading ? <><Loader2 size={20} className="animate-spin" />Consultando...</> : <><Search size={20} />Iniciar Consulta</>}
                        </button>
                    </div>

                    <div className="lg:col-span-2">
                        {businesses.length > 0 ? (
                            <ResultsPanel
                                businesses={businesses} filter={filter} setFilter={setFilter}
                                search={search} setSearch={setSearch} filtered={filtered}
                                unrCount={unrCount} regCount={regCount} possCount={possCount}
                                expanded={expanded} setExpanded={setExpanded}
                                imported={imported} handleImport={handleImport}
                                exportCSV={exportCSV} handleImportAll={handleImportAll}
                                scrapedAt={scrapedAt} STATUS={STATUS}
                                sourceLabel="Edge Function Supabase"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full min-h-64">
                                <div className="text-center">
                                    <Globe size={56} className="text-slate-200 mx-auto mb-4" />
                                    <h3 className="text-slate-500 font-bold">Listo para consultar</h3>
                                    <p className="text-slate-400 text-sm mt-1">Selecciona corregimientos y presiona "Iniciar Consulta"</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ============================================================
// RESULTS PANEL — shared between both modes
// ============================================================
interface RPProps {
    businesses: ScrapedBusiness[];
    filter: string; setFilter: (f: any) => void;
    search: string; setSearch: (s: string) => void;
    filtered: ScrapedBusiness[];
    unrCount: number; regCount: number; possCount: number;
    expanded: Set<number>; setExpanded: (fn: (prev: Set<number>) => Set<number>) => void;
    imported: Set<number>;
    handleImport: (b: ScrapedBusiness, i: number) => void;
    exportCSV: () => void;
    handleImportAll: () => void;
    scrapedAt: string;
    STATUS: any;
    sourceLabel: string;
}

const ResultsPanel: React.FC<RPProps> = ({
    businesses, filter, setFilter, search, setSearch, filtered,
    unrCount, regCount, possCount, expanded, setExpanded, imported,
    handleImport, exportCSV, handleImportAll, scrapedAt, STATUS, sourceLabel
}) => (
    <div className="space-y-4">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
            {[
                { label: 'No Inscritos', count: unrCount, color: 'red', icon: <XCircle size={16} className="text-red-500" /> },
                { label: 'Posible Match', count: possCount, color: 'amber', icon: <AlertTriangle size={16} className="text-amber-500" /> },
                { label: 'Ya Inscritos', count: regCount, color: 'emerald', icon: <CheckCircle2 size={16} className="text-emerald-500" /> },
            ].map(s => (
                <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-2xl p-4`}>
                    <div className="flex items-center gap-1.5 mb-1">{s.icon}<span className={`text-xs font-bold text-${s.color}-700 uppercase`}>{s.label}</span></div>
                    <p className={`text-3xl font-black text-${s.color}-600`}>{s.count}</p>
                </div>
            ))}
        </div>

        {/* Actions bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm flex flex-wrap gap-2">
            {[
                { key: 'unregistered', label: `No Inscritos (${unrCount})`, cls: 'bg-red-100 text-red-700 border-red-200' },
                { key: 'possible', label: `Posible Match (${possCount})`, cls: 'bg-amber-100 text-amber-700 border-amber-200' },
                { key: 'registered', label: `Inscritos (${regCount})`, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                { key: 'all', label: `Todos (${businesses.length})`, cls: 'bg-slate-100 text-slate-700 border-slate-200' },
            ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${filter === f.key ? f.cls + ' ring-2 ring-offset-1 ring-current' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}>
                    {f.label}
                </button>
            ))}
            <div className="flex-1" />
            <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
                    className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-indigo-400 w-40" />
            </div>
            {unrCount > 0 && (
                <>
                    <button onClick={exportCSV} className="flex items-center gap-1 text-xs bg-slate-700 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-slate-800 transition">
                        <Download size={13} /> CSV
                    </button>
                    <button onClick={handleImportAll} className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-700 transition">
                        <CheckCheck size={13} /> Inscribir todos
                    </button>
                </>
            )}
        </div>

        {/* Business list */}
        <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">No hay resultados con los filtros actuales.</div>
            ) : filtered.map((biz, _) => {
                const realIdx = businesses.indexOf(biz);
                const isExp = expanded.has(realIdx);
                const isImp = imported.has(realIdx);
                const st = STATUS[biz.matchStatus || 'UNREGISTERED'];
                return (
                    <div key={realIdx} className={`rounded-xl border-2 overflow-hidden shadow-sm ${st.bg}`}>
                        <div className="flex items-center gap-3 p-3.5 cursor-pointer hover:brightness-97"
                            onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(realIdx) ? n.delete(realIdx) : n.add(realIdx); return n; })}>
                            {st.icon}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-slate-800 text-sm truncate">{biz.nombreComercial}</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.badge}`}>{st.label}</span>
                                    {biz.source === 'DEMO_DATA' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 font-bold">Referencia</span>}
                                </div>
                                <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                                    {biz.ruc && <span className="font-mono">RUC: {biz.ruc}{biz.dv ? `-${biz.dv}` : ''}</span>}
                                    {biz.corregimiento && <><span>·</span><MapPin size={10} />{biz.corregimiento}</>}
                                    {biz.avisoOperaciones && <><span>·</span>{biz.avisoOperaciones}</>}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {biz.matchStatus === 'UNREGISTERED' && !isImp && (
                                    <button onClick={e => { e.stopPropagation(); handleImport(biz, realIdx); }}
                                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                                        <UserPlus size={11} /> Inscribir
                                    </button>
                                )}
                                {isImp && <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 size={11} />Importado</span>}
                                {isExp ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
                            </div>
                        </div>
                        {isExp && (
                            <div className="border-t border-current border-opacity-20 p-3.5 bg-white/60">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                                    {[
                                        { l: 'Actividad', v: biz.actividad },
                                        { l: 'Estado', v: biz.estado },
                                        { l: 'Aviso Operaciones', v: biz.avisoOperaciones },
                                        { l: 'Fecha Aviso', v: biz.fechaAviso },
                                        { l: 'Propietario', v: biz.nombrePropietario },
                                        { l: 'Dirección', v: biz.direccion },
                                        { l: 'Distrito', v: biz.distrito },
                                        { l: 'Provincia', v: biz.provincia },
                                    ].filter(r => r.v).map(r => (
                                        <div key={r.l} className="bg-white rounded-lg p-2 border border-slate-100">
                                            <p className="text-slate-400 uppercase font-bold text-[9px] mb-0.5">{r.l}</p>
                                            <p className="text-slate-700 font-medium">{r.v}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock size={11} />
            {new Date(scrapedAt).toLocaleString('es-PA')}
            <span className="mx-1">·</span>
            <Info size={11} /> {sourceLabel}
            <span className="mx-1">·</span>
            {businesses.length} negocios analizados
        </div>
    </div>
);
