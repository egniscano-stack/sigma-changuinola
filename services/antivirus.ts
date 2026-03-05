/**
 * SIGMA Changuinola — Módulo Antivirus / Escáner de Archivos
 * Gobierno de Panamá · Municipio de Changuinola
 *
 * Implementa múltiples capas de detección de amenazas en archivos:
 * 1. Validación de Magic Bytes (firma binaria real del archivo)
 * 2. Detección de scripts embebidos en PDFs
 * 3. Detección de macros maliciosas en Office
 * 4. Límites de tamaño y tipo
 * 5. Integración opcional con VirusTotal API
 * 6. Registro de auditoría de todos los escaneos
 */

import { logAuditEvent } from './security';

// ============================================================
// TYPES
// ============================================================

export type ScanStatus = 'PENDING' | 'SCANNING' | 'CLEAN' | 'INFECTED' | 'SUSPICIOUS' | 'ERROR';

export interface ThreatDetails {
    type: 'MAGIC_BYTE_MISMATCH' | 'SCRIPT_INJECTION' | 'MACRO_DETECTED' | 'OVERSIZED' | 'FORBIDDEN_TYPE' | 'VIRUSTOTAL' | 'DOUBLE_EXTENSION' | 'NULL_BYTE';
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
}

export interface FileScanResult {
    file: File;
    status: ScanStatus;
    threats: ThreatDetails[];
    scanDurationMs: number;
    hash: string;         // SHA-256 hash of the file
    fileSignature: string; // Detected magic bytes
    detectedType: string; // What the file ACTUALLY is
    declaredType: string; // What the extension CLAIMS it is
    scanTimestamp: string;
    isVirusTotalChecked: boolean;
    virusTotalReport?: {
        positives: number;
        total: number;
        permalink?: string;
    };
}

// ============================================================
// MAGIC BYTES DATABASE
// Maps the real binary signature to the actual file type
// ============================================================
const MAGIC_BYTES: Array<{
    signature: number[];  // First N bytes (can have null=any)
    offset?: number;      // Starting offset (default: 0)
    mimeType: string;
    description: string;
}> = [
        // IMAGES
        { signature: [0xFF, 0xD8, 0xFF], mimeType: 'image/jpeg', description: 'JPEG Image' },
        { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], mimeType: 'image/png', description: 'PNG Image' },
        { signature: [0x47, 0x49, 0x46, 0x38], mimeType: 'image/gif', description: 'GIF Image' },
        { signature: [0x42, 0x4D], mimeType: 'image/bmp', description: 'BMP Image' },
        { signature: [0x52, 0x49, 0x46, 0x46], mimeType: 'image/webp', description: 'WebP Image' }, // RIFF...WEBP

        // DOCUMENTS
        { signature: [0x25, 0x50, 0x44, 0x46], mimeType: 'application/pdf', description: 'PDF Document' }, // %PDF

        // OFFICE (ZIP-based formats: DOCX, XLSX, PPTX)
        { signature: [0x50, 0x4B, 0x03, 0x04], mimeType: 'application/zip', description: 'ZIP / Office (DOCX/XLSX)' },

        // LEGACY OFFICE (DOC, XLS - OLE format) - CAUTION: Can contain macros
        { signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], mimeType: 'application/msword', description: 'Legacy Office (DOC/XLS) - HIGH RISK' },

        // EXECUTABLES - ALWAYS BLOCK
        { signature: [0x4D, 0x5A], mimeType: 'application/x-msdownload', description: 'Windows Executable (EXE/DLL)' }, // MZ
        { signature: [0x7F, 0x45, 0x4C, 0x46], mimeType: 'application/x-elf', description: 'Linux Executable (ELF)' },
        { signature: [0xCA, 0xFE, 0xBA, 0xBE], mimeType: 'application/x-mach-binary', description: 'macOS Executable (Mach-O)' },
        { signature: [0x23, 0x21], mimeType: 'application/x-sh', description: 'Shell Script' }, // #!

        // COMPRESSED (can hide malware)
        { signature: [0x1F, 0x8B], mimeType: 'application/gzip', description: 'GZIP Archive' },
        { signature: [0x52, 0x61, 0x72, 0x21], mimeType: 'application/vnd.rar', description: 'RAR Archive' },
        { signature: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], mimeType: 'application/x-7z-compressed', description: '7-Zip Archive' },
    ];

// ============================================================
// ALLOWED FILE TYPES (whitelist for each upload context)
// ============================================================
export const ALLOWED_TYPES = {
    TAXPAYER_DOCUMENT: {
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        extensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
        maxSizeMB: 10,
        label: 'Documentos de Contribuyente',
    },
    INVOICE_SCAN: {
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
        extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'],
        maxSizeMB: 5,
        label: 'Escaneo de Factura',
    },
    EXCEL_IMPORT: {
        mimeTypes: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
        ],
        extensions: ['.xlsx', '.xls'],
        maxSizeMB: 20,
        label: 'Importación Excel',
    },
};

// ============================================================
// MALICIOUS PATTERN DETECTION
// ============================================================

// JavaScript injection patterns in PDFs
const PDF_SCRIPT_PATTERNS = [
    /\/JavaScript\s/i,
    /\/JS\s*</i,
    /\/Action\s*<<.*\/S\s*\/JavaScript/i,
    /\/OpenAction/i,
    /\/AA\s*<</, // Additional Actions
    /eval\s*\(/, // eval() in embedded JS
    /app\.alert/i, // Acrobat alert
    /util\.printf/i,
    /this\.submitForm/i,
    /\/Launch/i, // Launch an external program
    /\/URI\s*\(/i, // External URI action
];

// Suspicious content in plain text files
const SCRIPT_INJECTION_PATTERNS = [
    /<script[\s>]/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+\s*=/i,          // onclick=, onerror=, etc.
    /eval\s*\(/i,
    /document\.write/i,
    /window\.location/i,
    /\bexec\s*\(/i,
    /\bshell\b/i,
];

// ============================================================
// UTILITY: Compute SHA-256 hash of a file
// ============================================================
async function computeFileHash(file: File): Promise<string> {
    try {
        const buffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        return 'hash-unavailable';
    }
}

// ============================================================
// UTILITY: Read first N bytes of a file
// ============================================================
function readFileBytes(file: File, count: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(new Uint8Array(reader.result));
            } else {
                reject(new Error('Failed to read file bytes'));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file.slice(0, count));
    });
}

// ============================================================
// UTILITY: Read file as text (for script detection)
// ============================================================
function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file.slice(0, 65536)); // Read first 64KB max
    });
}

// ============================================================
// MAGIC BYTE DETECTION
// ============================================================
function detectMagicBytes(bytes: Uint8Array): { mimeType: string; description: string } | null {
    for (const entry of MAGIC_BYTES) {
        const offset = entry.offset ?? 0;
        const sig = entry.signature;

        if (bytes.length < offset + sig.length) continue;

        const matches = sig.every((byte, i) => byte === bytes[offset + i]);
        if (matches) {
            return { mimeType: entry.mimeType, description: entry.description };
        }
    }
    return null;
}

// ============================================================
// VIRUSTOTAL INTEGRATION (Optional - requires API key)
// ============================================================
async function scanWithVirusTotal(fileHash: string): Promise<{
    positives: number;
    total: number;
    permalink?: string;
} | null> {
    const apiKey = import.meta.env.VITE_VIRUSTOTAL_API_KEY;
    if (!apiKey) return null; // Skip if not configured

    try {
        // First check if we have a cached report for this hash
        const response = await fetch(`https://www.virustotal.com/vtapi/v2/file/report?apikey=${apiKey}&resource=${fileHash}`, {
            method: 'GET',
        });

        if (!response.ok) return null;

        const data = await response.json();

        if (data.response_code === 1) {
            return {
                positives: data.positives || 0,
                total: data.total || 0,
                permalink: data.permalink,
            };
        }

        return null;
    } catch (e) {
        console.warn('[SIGMA Antivirus] VirusTotal check failed (may be offline or rate limited):', e);
        return null;
    }
}

// ============================================================
// MAIN SCANNER FUNCTION
// ============================================================

/**
 * Scans a file for malware, scripts, and other threats.
 * Returns a detailed scan result.
 */
export async function scanFile(
    file: File,
    context: keyof typeof ALLOWED_TYPES,
    scannerUsername: string = 'SYSTEM',
    sessionId: string = 'SYSTEM'
): Promise<FileScanResult> {
    const startTime = Date.now();
    const threats: ThreatDetails[] = [];
    const allowedConfig = ALLOWED_TYPES[context];

    // --- PRE-SCAN INFO ---
    const hash = await computeFileHash(file);
    const fileExtension = '.' + (file.name.split('.').pop()?.toLowerCase() || '');

    // Read first 32 bytes for magic byte detection
    const fileBytes = await readFileBytes(file, 64);
    const magicResult = detectMagicBytes(fileBytes);
    const detectedType = magicResult?.mimeType || 'unknown';
    const detectedDescription = magicResult?.description || 'Unknown Format';

    const result: FileScanResult = {
        file,
        status: 'SCANNING',
        threats: [],
        scanDurationMs: 0,
        hash,
        fileSignature: Array.from(fileBytes.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
        detectedType,
        declaredType: file.type || 'unknown',
        scanTimestamp: new Date().toISOString(),
        isVirusTotalChecked: false,
    };

    // ====================================================
    // CHECK 1: FILE SIZE LIMIT
    // ====================================================
    const maxBytes = allowedConfig.maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
        threats.push({
            type: 'OVERSIZED',
            severity: 'MEDIUM',
            description: `Archivo excede el límite de ${allowedConfig.maxSizeMB}MB (tamaño: ${(file.size / 1024 / 1024).toFixed(2)}MB)`,
        });
    }

    // ====================================================
    // CHECK 2: EXTENSION WHITELIST
    // ====================================================
    if (!allowedConfig.extensions.includes(fileExtension)) {
        threats.push({
            type: 'FORBIDDEN_TYPE',
            severity: 'HIGH',
            description: `Extensión "${fileExtension}" no permitida para ${allowedConfig.label}. Permitidas: ${allowedConfig.extensions.join(', ')}`,
        });
    }

    // ====================================================
    // CHECK 3: DOUBLE EXTENSION ATTACK (e.g., virus.pdf.exe)
    // ====================================================
    const nameParts = file.name.split('.');
    if (nameParts.length > 2) {
        const innerExtension = '.' + nameParts[nameParts.length - 2].toLowerCase();
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar', '.com', '.pif', '.scr'];
        if (dangerousExtensions.includes(innerExtension)) {
            threats.push({
                type: 'DOUBLE_EXTENSION',
                severity: 'CRITICAL',
                description: `¡ALERTA! Extensión doble sospechosa detectada: "${file.name}". Posible intento de enmascaramiento de ejecutable.`,
            });
        }
    }

    // ====================================================
    // CHECK 4: NULL BYTE INJECTION in filename
    // ====================================================
    if (file.name.includes('\0') || file.name.includes('%00')) {
        threats.push({
            type: 'NULL_BYTE',
            severity: 'CRITICAL',
            description: `Null byte detectado en el nombre del archivo: intento de traversal path o bypass de validación.`,
        });
    }

    // ====================================================
    // CHECK 5: MAGIC BYTES vs DECLARED TYPE MISMATCH
    // ====================================================
    if (magicResult) {
        const isExecutable = [
            'application/x-msdownload',
            'application/x-elf',
            'application/x-mach-binary',
            'application/x-sh',
        ].includes(magicResult.mimeType);

        if (isExecutable) {
            threats.push({
                type: 'MAGIC_BYTE_MISMATCH',
                severity: 'CRITICAL',
                description: `¡EXECUTABLE DETECTADO! El archivo "${file.name}" contiene firma binaria de ${magicResult.description}. BLOQUEADO inmediatamente.`,
            });
        } else if (!allowedConfig.mimeTypes.includes(magicResult.mimeType) && !allowedConfig.mimeTypes.includes('application/zip')) {
            // Magic bytes don't match any allowed type
            threats.push({
                type: 'MAGIC_BYTE_MISMATCH',
                severity: 'HIGH',
                description: `Tipo real del archivo (${magicResult.description}) no coincide con los tipos permitidos para este contexto.`,
            });
        }
    } else {
        // Unknown file signature - could be text or something unusual
        // Only flag if extension is image/pdf (those have well-known signatures)
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        if (imageExtensions.includes(fileExtension)) {
            threats.push({
                type: 'MAGIC_BYTE_MISMATCH',
                severity: 'MEDIUM',
                description: `Firma de archivo no reconocida para una imagen "${fileExtension}". El archivo podría estar corrupto o disfrazado.`,
            });
        }
    }

    // ====================================================
    // CHECK 6: SCRIPT INJECTION DETECTION (Text content scan)
    // ====================================================
    if (
        file.type === 'application/pdf' ||
        fileExtension === '.pdf' ||
        file.type.startsWith('text/') ||
        file.size < 512 * 1024 // Only scan text content if < 512KB 
    ) {
        try {
            const textContent = await readFileAsText(file);

            // PDF-specific script detection
            if (fileExtension === '.pdf' || file.type === 'application/pdf') {
                for (const pattern of PDF_SCRIPT_PATTERNS) {
                    if (pattern.test(textContent)) {
                        threats.push({
                            type: 'SCRIPT_INJECTION',
                            severity: 'CRITICAL',
                            description: `PDF con JavaScript/acción activa detectado. Patrón peligroso: "${pattern.toString().slice(1, 30)}". BLOQUEADO.`,
                        });
                        break; // One is enough to block
                    }
                }
            }

            // General script injection
            for (const pattern of SCRIPT_INJECTION_PATTERNS) {
                if (pattern.test(textContent)) {
                    threats.push({
                        type: 'SCRIPT_INJECTION',
                        severity: 'HIGH',
                        description: `Contenido de script sospechoso detectado en el archivo: patrón "${pattern.toString().slice(1, 30)}".`,
                    });
                    break;
                }
            }
        } catch (e) {
            // Couldn't read as text - that's OK for binary files
        }
    }

    // ====================================================
    // CHECK 7: MACRO DETECTION in Office files
    // Legacy .doc, .xls (OLE format) can run macros automatically
    // ====================================================
    if (magicResult?.mimeType === 'application/msword') {
        threats.push({
            type: 'MACRO_DETECTED',
            severity: 'HIGH',
            description: `Formato de Office legado (DOC/XLS) detectado. Estos archivos pueden contener macros VBA maliciosas. Solo se permiten archivos DOCX/XLSX modernos.`,
        });
    }

    // ====================================================
    // CHECK 8: VIRUSTOTAL CLOUD SCAN (if API key configured)
    // ====================================================
    const vtConfig = import.meta.env.VITE_VIRUSTOTAL_API_KEY;
    if (vtConfig && hash !== 'hash-unavailable') {
        const vtResult = await scanWithVirusTotal(hash);
        result.isVirusTotalChecked = true;
        if (vtResult) {
            result.virusTotalReport = vtResult;
            if (vtResult.positives > 0) {
                threats.push({
                    type: 'VIRUSTOTAL',
                    severity: vtResult.positives >= 3 ? 'CRITICAL' : 'HIGH',
                    description: `VirusTotal: ${vtResult.positives}/${vtResult.total} motores detectaron este archivo como malicioso.`,
                });
            }
        }
    }

    // ====================================================
    // DETERMINE FINAL STATUS
    // ====================================================
    const hasCritical = threats.some(t => t.severity === 'CRITICAL');
    const hasHigh = threats.some(t => t.severity === 'HIGH');
    const hasMedium = threats.some(t => t.severity === 'MEDIUM');

    let finalStatus: ScanStatus = 'CLEAN';
    if (hasCritical || hasHigh) finalStatus = 'INFECTED';
    else if (hasMedium) finalStatus = 'SUSPICIOUS';

    result.status = finalStatus;
    result.threats = threats;
    result.scanDurationMs = Date.now() - startTime;

    // ====================================================
    // AUDIT LOG
    // ====================================================
    const severity = finalStatus === 'INFECTED' ? 'CRITICAL' : finalStatus === 'SUSPICIOUS' ? 'WARNING' : 'INFO';

    logAuditEvent({
        username: scannerUsername,
        role: 'SYSTEM',
        action: `FILE_SCAN_${finalStatus}`,
        details: [
            `Archivo: "${file.name}"`,
            `Tamaño: ${(file.size / 1024).toFixed(1)}KB`,
            `Tipo detectado: ${detectedDescription}`,
            `Hash SHA-256: ${hash.substring(0, 16)}...`,
            `Amenazas encontradas: ${threats.length}`,
            threats.length > 0 ? `Amenazas: ${threats.map(t => t.type).join(', ')}` : 'Sin amenazas',
            `Tiempo de escaneo: ${result.scanDurationMs}ms`,
        ].join(' | '),
        severity,
        sessionId,
    });

    return result;
}

// ============================================================
// BATCH SCANNER — Scan multiple files
// ============================================================
export async function scanFiles(
    files: Record<string, File>,
    context: keyof typeof ALLOWED_TYPES,
    username: string,
    sessionId: string
): Promise<{ allClean: boolean; results: Record<string, FileScanResult> }> {
    const results: Record<string, FileScanResult> = {};
    let allClean = true;

    for (const [key, file] of Object.entries(files)) {
        const result = await scanFile(file, context, username, sessionId);
        results[key] = result;
        if (result.status !== 'CLEAN') {
            allClean = false;
        }
    }

    return { allClean, results };
}

// ============================================================
// UTILITY: Format scan result for display
// ============================================================
export function formatScanSummary(result: FileScanResult): string {
    if (result.status === 'CLEAN') return '✅ Archivo limpio — Sin amenazas detectadas';
    if (result.status === 'SUSPICIOUS') return `⚠️ Archivo sospechoso — ${result.threats.length} advertencia(s)`;
    return `🚨 ¡AMENAZA DETECTADA! — ${result.threats.length} amenaza(s) encontrada(s)`;
}

export function getScanStatusColor(status: ScanStatus): string {
    switch (status) {
        case 'CLEAN': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
        case 'SCANNING': return 'text-blue-700 bg-blue-50 border-blue-200';
        case 'SUSPICIOUS': return 'text-amber-700 bg-amber-50 border-amber-200';
        case 'INFECTED': return 'text-red-700 bg-red-50 border-red-200';
        case 'ERROR': return 'text-slate-700 bg-slate-50 border-slate-200';
        default: return 'text-slate-700 bg-slate-50 border-slate-200';
    }
}
