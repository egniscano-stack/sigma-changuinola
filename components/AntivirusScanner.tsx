import React, { useState } from 'react';
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
    ShieldX,
    Loader2,
    FileSearch,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ChevronDown,
    ChevronUp,
    Info,
    Zap,
} from 'lucide-react';
import {
    scanFile,
    ScanStatus,
    FileScanResult,
    ALLOWED_TYPES,
    getScanStatusColor,
    formatScanSummary,
} from '../services/antivirus';

// ============================================================
// TYPES
// ============================================================

interface AntivirusScannerProps {
    files: Record<string, File>;
    context: keyof typeof ALLOWED_TYPES;
    username?: string;
    sessionId?: string;
    onScanComplete: (allClean: boolean, results: Record<string, FileScanResult>) => void;
    onCancel?: () => void;
}

// ============================================================
// STATUS ICON COMPONENT
// ============================================================
const StatusIcon: React.FC<{ status: ScanStatus; size?: number }> = ({ status, size = 20 }) => {
    switch (status) {
        case 'CLEAN': return <ShieldCheck size={size} className="text-emerald-500" />;
        case 'SCANNING': return <Loader2 size={size} className="text-blue-500 animate-spin" />;
        case 'SUSPICIOUS': return <ShieldAlert size={size} className="text-amber-500" />;
        case 'INFECTED': return <ShieldX size={size} className="text-red-500" />;
        case 'ERROR': return <AlertTriangle size={size} className="text-slate-400" />;
        default: return <Shield size={size} className="text-slate-400" />;
    }
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const AntivirusScanner: React.FC<AntivirusScannerProps> = ({
    files,
    context,
    username = 'USUARIO',
    sessionId = 'SESION',
    onScanComplete,
    onCancel,
}) => {
    const [isScanning, setIsScanning] = useState(false);
    const [scanStarted, setScanStarted] = useState(false);
    const [results, setResults] = useState<Record<string, FileScanResult>>({});
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
    const [scanComplete, setScanComplete] = useState(false);

    const fileCount = Object.keys(files).length;

    const handleStartScan = async () => {
        if (fileCount === 0) return;

        setIsScanning(true);
        setScanStarted(true);
        setScanComplete(false);
        setResults({});
        setProgress(0);

        const allResults: Record<string, FileScanResult> = {};
        const fileEntries = Object.entries(files);
        let allClean = true;

        for (let i = 0; i < fileEntries.length; i++) {
            const [key, file] = fileEntries[i] as [string, File];
            setCurrentFile(key);
            setProgress(Math.round((i / fileEntries.length) * 100));

            // Small visual delay so user can see each file being scanned
            await new Promise(res => setTimeout(res, 200));

            const result: FileScanResult = await scanFile(file, context, username, sessionId);
            allResults[key] = result;

            // Update results as each file completes
            setResults(prev => ({ ...prev, [key]: result }));

            if (result.status !== 'CLEAN') {
                allClean = false;
            }
        }

        setProgress(100);
        setCurrentFile(null);
        setIsScanning(false);
        setScanComplete(true);

        // Small pause before calling onScanComplete so user sees 100%
        await new Promise(res => setTimeout(res, 600));

        onScanComplete(allClean, allResults);
    };

    const toggleExpand = (key: string) => {
        setExpandedFiles(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'text-red-700 bg-red-50 border-red-200';
            case 'HIGH': return 'text-orange-700 bg-orange-50 border-orange-200';
            case 'MEDIUM': return 'text-amber-700 bg-amber-50 border-amber-200';
            case 'LOW': return 'text-blue-700 bg-blue-50 border-blue-200';
            default: return 'text-slate-700 bg-slate-50 border-slate-200';
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    };

    const resultValues = Object.values(results) as FileScanResult[];
    const totalThreats = resultValues.reduce((acc, r) => acc + r.threats.length, 0);
    const infectedFiles = resultValues.filter(r => r.status === 'INFECTED').length;
    const suspiciousFiles = resultValues.filter(r => r.status === 'SUSPICIOUS').length;
    const cleanFiles = resultValues.filter(r => r.status === 'CLEAN').length;

    return (
        <div className="rounded-2xl border-2 border-slate-200 overflow-hidden shadow-xl" style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        }}>
            {/* Header */}
            <div className="p-5 border-b border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Shield size={22} className="text-emerald-400" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-lg leading-tight">Escáner Antivirus SIGMA</h3>
                    <p className="text-slate-400 text-xs">Análisis de seguridad multi-capa para archivos gubernamentales</p>
                </div>
                <div className="ml-auto flex items-center gap-2 bg-emerald-900/30 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full">
                    <Zap size={12} />
                    <span>Protección Activa</span>
                </div>
            </div>

            {/* File List Preview */}
            {!scanStarted && (
                <div className="p-5">
                    <p className="text-slate-400 text-xs uppercase font-bold mb-3 tracking-wider">
                        Archivos a Escanear ({fileCount})
                    </p>
                    <div className="space-y-2 mb-5">
                        {(Object.entries(files) as [string, File][]).map(([key, file]) => (
                            <div key={key} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
                                <FileSearch size={16} className="text-slate-400 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-sm font-medium truncate">{file.name}</p>
                                    <p className="text-slate-500 text-xs">{formatFileSize(file.size)} • {key}</p>
                                </div>
                                <Shield size={14} className="text-slate-600" />
                            </div>
                        ))}
                    </div>

                    {/* Scan Layers Info */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-5">
                        <p className="text-slate-300 text-xs font-bold uppercase mb-3 tracking-wider">Capas de Análisis</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                                '🔬 Análisis de Magic Bytes',
                                '🔐 Detección de Ejecutables',
                                '📄 Escaneo de PDFs maliciosos',
                                '⚡ Detección de scripts JS/VBS',
                                '📏 Validación de tamaño y tipo',
                                '🛡️ Anti-bypass doble extensión',
                                '🈲 Detección Null Byte',
                                '☁️ VirusTotal (si configurado)',
                            ].map((layer, i) => (
                                <div key={i} className="flex items-center gap-2 text-slate-400">
                                    <span>{layer}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleStartScan}
                            disabled={fileCount === 0}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/30"
                        >
                            <Shield size={18} />
                            Iniciar Escaneo Antivirus
                        </button>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="px-4 py-3 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                Omitir
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Scanning Progress */}
            {isScanning && (
                <div className="p-5">
                    {/* Progress Bar */}
                    <div className="mb-4">
                        <div className="flex justify-between text-xs text-slate-400 mb-2">
                            <span>Escaneando...</span>
                            <span className="text-emerald-400 font-bold">{progress}%</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Current File Being Scanned */}
                    {currentFile && (
                        <div className="flex items-center gap-3 bg-blue-900/30 border border-blue-500/20 rounded-xl p-3 mb-4">
                            <Loader2 size={18} className="text-blue-400 animate-spin flex-shrink-0" />
                            <div>
                                <p className="text-blue-300 text-sm font-medium">Analizando:</p>
                                <p className="text-white text-xs truncate">{files[currentFile]?.name}</p>
                            </div>
                        </div>
                    )}

                    {/* Live Results */}
                    <div className="space-y-2">
                        {(Object.entries(results) as [string, FileScanResult][]).map(([key, result]) => (
                            <div key={key} className={`flex items-center gap-3 rounded-xl p-3 border ${getScanStatusColor(result.status)}`}>
                                <StatusIcon status={result.status} size={18} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{result.file.name}</p>
                                </div>
                                <span className="text-xs font-bold">{result.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Scan Complete Results */}
            {scanComplete && !isScanning && (
                <div className="p-5">
                    {/* Summary Banner */}
                    <div className={`rounded-xl p-4 mb-4 border-2 ${infectedFiles > 0
                        ? 'bg-red-950 border-red-500 text-red-200'
                        : suspiciousFiles > 0
                            ? 'bg-amber-950 border-amber-500 text-amber-200'
                            : 'bg-emerald-950 border-emerald-500 text-emerald-200'
                        }`}>
                        <div className="flex items-center gap-3">
                            {infectedFiles > 0 ? (
                                <ShieldX size={28} className="text-red-400 flex-shrink-0" />
                            ) : suspiciousFiles > 0 ? (
                                <ShieldAlert size={28} className="text-amber-400 flex-shrink-0" />
                            ) : (
                                <ShieldCheck size={28} className="text-emerald-400 flex-shrink-0" />
                            )}
                            <div>
                                <p className="font-bold text-lg leading-tight">
                                    {infectedFiles > 0
                                        ? `¡${infectedFiles} archivo(s) infectado(s) detectado(s)!`
                                        : suspiciousFiles > 0
                                            ? `${suspiciousFiles} archivo(s) sospechoso(s)`
                                            : '¡Todos los archivos están limpios!'}
                                </p>
                                <p className="text-sm opacity-80">
                                    {cleanFiles}/{fileCount} limpios • {totalThreats} amenaza(s) total
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Per-File Results */}
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                        {(Object.entries(results) as [string, FileScanResult][]).map(([key, result]) => (
                            <div key={key} className="rounded-xl border overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                                {/* File Header Row */}
                                <button
                                    onClick={() => toggleExpand(key)}
                                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                                >
                                    <StatusIcon status={result.status} size={20} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white text-sm font-medium truncate">{result.file.name}</p>
                                        <p className="text-slate-500 text-xs">{formatFileSize(result.file.size)} • {result.detectedType}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {result.threats.length > 0 && (
                                            <span className="bg-red-900/50 text-red-300 text-xs font-bold px-2 py-0.5 rounded-full border border-red-500/30">
                                                {result.threats.length} amenaza(s)
                                            </span>
                                        )}
                                        {result.status === 'CLEAN' && (
                                            <span className="bg-emerald-900/40 text-emerald-400 text-xs font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                ✓ LIMPIO
                                            </span>
                                        )}
                                        {expandedFiles.has(key) ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                                    </div>
                                </button>

                                {/* Expanded Details */}
                                {expandedFiles.has(key) && (
                                    <div className="border-t border-white/10 p-4 space-y-3">
                                        {/* Scan Metadata */}
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-white/5 rounded-lg p-2">
                                                <p className="text-slate-500 uppercase">Hash SHA-256</p>
                                                <p className="text-slate-300 font-mono truncate">{result.hash.substring(0, 20)}...</p>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2">
                                                <p className="text-slate-500 uppercase">Tipo Real</p>
                                                <p className="text-slate-300">{result.detectedType}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2">
                                                <p className="text-slate-500 uppercase">Firma (Magic)</p>
                                                <p className="text-slate-300 font-mono">{result.fileSignature}</p>
                                            </div>
                                            <div className="bg-white/5 rounded-lg p-2">
                                                <p className="text-slate-500 uppercase">Escaneo en</p>
                                                <p className="text-slate-300">{result.scanDurationMs}ms</p>
                                            </div>
                                        </div>

                                        {/* VirusTotal Badge */}
                                        {result.isVirusTotalChecked && (
                                            <div className={`flex items-center gap-2 text-xs rounded-lg p-2 border ${result.virusTotalReport && result.virusTotalReport.positives > 0
                                                ? 'bg-red-900/30 border-red-500/30 text-red-300'
                                                : 'bg-emerald-900/20 border-emerald-500/20 text-emerald-400'
                                                }`}>
                                                <Shield size={12} />
                                                {result.virusTotalReport
                                                    ? `VirusTotal: ${result.virusTotalReport.positives}/${result.virusTotalReport.total} positivos`
                                                    : 'VirusTotal: Sin informe (hash nuevo)'}
                                            </div>
                                        )}

                                        {/* Threats List */}
                                        {result.threats.length > 0 ? (
                                            <div className="space-y-2">
                                                <p className="text-xs text-slate-500 uppercase font-bold">Amenazas Detectadas</p>
                                                {result.threats.map((threat, i) => (
                                                    <div key={i} className={`rounded-lg p-3 border text-xs ${getSeverityColor(threat.severity)}`}>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <XCircle size={12} />
                                                            <span className="font-bold uppercase">{threat.severity} — {threat.type}</span>
                                                        </div>
                                                        <p className="opacity-90">{threat.description}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-900/20 rounded-lg p-3 border border-emerald-500/20">
                                                <CheckCircle2 size={14} />
                                                <span>Sin amenazas detectadas en este archivo</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Action Note for Infected files */}
                    {infectedFiles > 0 && (
                        <div className="mt-4 bg-red-900/30 border border-red-500/30 text-red-200 rounded-xl p-4 text-sm">
                            <div className="flex items-start gap-3">
                                <Info size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold text-red-300 mb-1">Acción Requerida</p>
                                    <p className="text-xs opacity-90">
                                        Los archivos infectados han sido BLOQUEADOS y no se subirán al sistema. Descarte estos archivos, escanéelos con un antivirus local y contáctese con el administrador del sistema si considera que es una alerta incorrecta.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
                <p className="text-slate-600 text-xs">SIGMA Antivirus Engine v1.0 · Gobierno de Panamá</p>
                {scanComplete && (
                    <p className="text-slate-500 text-xs">
                        {new Date().toLocaleString('es-PA')}
                    </p>
                )}
            </div>
        </div>
    );
};
