/**
 * SIGMA Changuinola - Security Module
 * Gobierno de Panamá - Municipio de Changuinola
 * 
 * Este módulo implementa medidas de seguridad críticas para proteger
 * información financiera y datos sensibles de contribuyentes.
 */

// ============================================================
// CONSTANTS
// ============================================================
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos de inactividad
const MAX_LOGIN_ATTEMPTS = 5;              // Máximo intentos antes de bloqueo
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutos de bloqueo
const SESSION_KEY = 'sigma_session_v2';
const AUDIT_KEY = 'sigma_audit_log';
const MAX_AUDIT_ENTRIES = 500;

// ============================================================
// TYPES
// ============================================================
export interface SessionData {
    userId: string;
    username: string;
    role: string;
    name: string;
    loginTime: number;
    lastActivity: number;
    sessionId: string; // Unique session token
}

export interface AuditEntry {
    timestamp: string;
    username: string;
    role: string;
    action: string;
    details: string;
    ip?: string;
    sessionId: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

export interface LoginAttemptData {
    count: number;
    lastAttempt: number;
    lockedUntil?: number;
}

// ============================================================
// SESSION MANAGEMENT
// ============================================================

/**
 * Generates a cryptographically secure session ID
 */
function generateSessionId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates and stores a new session after successful login
 */
export function createSession(user: { username: string; role: string; name: string }): SessionData {
    const session: SessionData = {
        userId: user.username,
        username: user.username,
        role: user.role,
        name: user.name,
        loginTime: Date.now(),
        lastActivity: Date.now(),
        sessionId: generateSessionId(),
    };

    // Store session securely (sessionStorage is cleared on tab close, more secure than localStorage)
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
        console.error('[SIGMA Security] Failed to create session:', e);
    }

    logAuditEvent({
        username: user.username,
        role: user.role,
        action: 'LOGIN_SUCCESS',
        details: `Inicio de sesión exitoso para ${user.name}`,
        severity: 'INFO',
        sessionId: session.sessionId,
    });

    return session;
}

/**
 * Retrieves and validates the current session.
 * Returns null if session is expired or invalid.
 */
export function getSession(): SessionData | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;

        const session: SessionData = JSON.parse(raw);
        const now = Date.now();

        // Check session timeout
        if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
            logAuditEvent({
                username: session.username,
                role: session.role,
                action: 'SESSION_EXPIRED',
                details: `Sesión expirada por inactividad después de ${Math.round(SESSION_TIMEOUT_MS / 60000)} minutos`,
                severity: 'WARNING',
                sessionId: session.sessionId,
            });
            destroySession();
            return null;
        }

        // Update last activity
        session.lastActivity = now;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

        return session;
    } catch (e) {
        console.error('[SIGMA Security] Failed to read session:', e);
        destroySession();
        return null;
    }
}

/**
 * Updates the last activity timestamp (call on any user interaction)
 */
export function refreshSessionActivity(): void {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const session: SessionData = JSON.parse(raw);
        session.lastActivity = Date.now();
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {
        // Fail silently
    }
}

/**
 * Destroys the current session (logout)
 */
export function destroySession(): void {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) {
            const session: SessionData = JSON.parse(raw);
            logAuditEvent({
                username: session.username,
                role: session.role,
                action: 'LOGOUT',
                details: `Cierre de sesión de ${session.name}`,
                severity: 'INFO',
                sessionId: session.sessionId,
            });
        }
    } catch (e) { /* ignore */ }

    sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Returns remaining session time in milliseconds
 */
export function getSessionTimeRemaining(): number {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return 0;
        const session: SessionData = JSON.parse(raw);
        const elapsed = Date.now() - session.lastActivity;
        return Math.max(0, SESSION_TIMEOUT_MS - elapsed);
    } catch (e) {
        return 0;
    }
}

// ============================================================
// BRUTE FORCE PROTECTION
// ============================================================

/**
 * Records a failed login attempt and returns whether the account is now locked
 */
export function recordFailedLogin(username: string): { isLocked: boolean; attemptsRemaining: number; lockoutMinutes?: number } {
    const key = `sigma_attempts_${btoa(username)}`;

    try {
        let data: LoginAttemptData = { count: 0, lastAttempt: 0 };

        const raw = localStorage.getItem(key);
        if (raw) {
            data = JSON.parse(raw);
        }

        // Reset if lockout has expired
        if (data.lockedUntil && Date.now() > data.lockedUntil) {
            data = { count: 0, lastAttempt: 0 };
        }

        data.count++;
        data.lastAttempt = Date.now();

        if (data.count >= MAX_LOGIN_ATTEMPTS) {
            data.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;

            logAuditEvent({
                username,
                role: 'UNKNOWN',
                action: 'ACCOUNT_LOCKED',
                details: `Cuenta bloqueada por ${MAX_LOGIN_ATTEMPTS} intentos fallidos. Bloqueo por ${LOCKOUT_DURATION_MS / 60000} minutos.`,
                severity: 'CRITICAL',
                sessionId: 'N/A',
            });

            localStorage.setItem(key, JSON.stringify(data));
            return { isLocked: true, attemptsRemaining: 0, lockoutMinutes: LOCKOUT_DURATION_MS / 60000 };
        }

        localStorage.setItem(key, JSON.stringify(data));

        logAuditEvent({
            username,
            role: 'UNKNOWN',
            action: 'LOGIN_FAILED',
            details: `Intento fallido #${data.count} de ${MAX_LOGIN_ATTEMPTS}`,
            severity: 'WARNING',
            sessionId: 'N/A',
        });

        return { isLocked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS - data.count };
    } catch (e) {
        return { isLocked: false, attemptsRemaining: MAX_LOGIN_ATTEMPTS };
    }
}

/**
 * Checks if a username is currently locked out
 */
export function isAccountLocked(username: string): { locked: boolean; minutesRemaining?: number } {
    const key = `sigma_attempts_${btoa(username)}`;

    try {
        const raw = localStorage.getItem(key);
        if (!raw) return { locked: false };

        const data: LoginAttemptData = JSON.parse(raw);

        if (data.lockedUntil && Date.now() < data.lockedUntil) {
            const minutesRemaining = Math.ceil((data.lockedUntil - Date.now()) / 60000);
            return { locked: true, minutesRemaining };
        }

        return { locked: false };
    } catch (e) {
        return { locked: false };
    }
}

/**
 * Clears failed login attempts after successful login
 */
export function clearLoginAttempts(username: string): void {
    const key = `sigma_attempts_${btoa(username)}`;
    localStorage.removeItem(key);
}

// ============================================================
// AUDIT LOG SYSTEM
// ============================================================

/**
 * Logs a security/audit event
 */
export function logAuditEvent(event: Omit<AuditEntry, 'timestamp'>): void {
    try {
        const entry: AuditEntry = {
            ...event,
            timestamp: new Date().toISOString(),
        };

        const raw = localStorage.getItem(AUDIT_KEY);
        let logs: AuditEntry[] = raw ? JSON.parse(raw) : [];

        // Add new entry
        logs.push(entry);

        // Rotate logs if exceeding max entries (keep most recent)
        if (logs.length > MAX_AUDIT_ENTRIES) {
            logs = logs.slice(logs.length - MAX_AUDIT_ENTRIES);
        }

        localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));

        // Also log to console in a controlled format
        const severity_emoji = { INFO: 'ℹ️', WARNING: '⚠️', CRITICAL: '🚨' }[entry.severity];
        console.log(`${severity_emoji} [SIGMA Audit] ${entry.timestamp} | ${entry.username} (${entry.role}) | ${entry.action}: ${entry.details}`);
    } catch (e) {
        // Fail silently to not disrupt user experience
    }
}

/**
 * Retrieves the audit log
 */
export function getAuditLog(): AuditEntry[] {
    try {
        const raw = localStorage.getItem(AUDIT_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Logs a sensitive data access event
 */
export function logDataAccess(username: string, role: string, sessionId: string, resource: string, action: string): void {
    logAuditEvent({
        username,
        role,
        action: `DATA_${action}`,
        details: `Acceso a: ${resource}`,
        severity: 'INFO',
        sessionId,
    });
}

/**
 * Logs a sensitive financial operation
 */
export function logFinancialOperation(
    username: string,
    role: string,
    sessionId: string,
    operation: string,
    amount: number,
    taxpayerName: string
): void {
    logAuditEvent({
        username,
        role,
        action: `FINANCIAL_OP`,
        details: `Operación: ${operation} | Monto: $${amount.toFixed(2)} | Contribuyente: ${taxpayerName}`,
        severity: amount > 1000 ? 'WARNING' : 'INFO',
        sessionId,
    });
}

// ============================================================
// INPUT SANITIZATION
// ============================================================

/**
 * Sanitizes string input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
    if (typeof input !== 'string') return '';

    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        .trim();
}

/**
 * Validates a Panama cédula format (e.g., 8-123-4567 or 8-AV-123)
 */
export function validateCedula(cedula: string): boolean {
    if (!cedula) return false;
    // Standard cédula: #-###-#### or special formats
    const cedulaRegex = /^\d{1,2}-\d{1,4}-\d{1,6}$|^\d{1,2}-[A-Z]{1,2}-\d{1,6}$|^\d{1,2}-NT-\d{1,6}$|^\d{1,2}-PE-\d{1,6}$|^\d{1,2}-N-\d{1,6}$/i;
    return cedulaRegex.test(cedula.trim());
}

/**
 * Validates RUC (Registro Único del Contribuyente) format for Panama
 */
export function validateRUC(ruc: string): boolean {
    if (!ruc) return false;
    // RUC format: typically numeric or alphanumeric
    return ruc.trim().length >= 4 && ruc.trim().length <= 20;
}

/**
 * Validates that an amount is a valid, positive financial value
 */
export function validateAmount(amount: any): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0 && num < 10_000_000 && isFinite(num);
}

// ============================================================
// PASSWORD STRENGTH VALIDATOR
// ============================================================

export interface PasswordStrength {
    score: number; // 0-4
    label: 'Muy Débil' | 'Débil' | 'Regular' | 'Fuerte' | 'Muy Fuerte';
    color: string;
    suggestions: string[];
}

export function checkPasswordStrength(password: string): PasswordStrength {
    const suggestions: string[] = [];
    let score = 0;

    if (password.length >= 8) score++;
    else suggestions.push('Usar al menos 8 caracteres');

    if (password.length >= 12) score++;
    else suggestions.push('Recomendado: 12 o más caracteres');

    if (/[A-Z]/.test(password)) score++;
    else suggestions.push('Incluir letras mayúsculas');

    if (/[0-9]/.test(password)) score++;
    else suggestions.push('Incluir números');

    if (/[^A-Za-z0-9]/.test(password)) score++;
    else suggestions.push('Incluir caracteres especiales (!@#$%...)');

    // Check for common weak passwords
    const weakPasswords = ['admin123', '123456', 'password', 'qwerty', 'abc123', '123', 'mnc', 'admin', '1234'];
    if (weakPasswords.includes(password.toLowerCase())) {
        score = 0;
        suggestions.unshift('¡Esta contraseña es demasiado común y no es segura!');
    }

    const levels: PasswordStrength['label'][] = ['Muy Débil', 'Débil', 'Regular', 'Fuerte', 'Muy Fuerte'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

    return {
        score,
        label: levels[Math.min(score, 4)],
        color: colors[Math.min(score, 4)],
        suggestions,
    };
}

// ============================================================
// CONTENT SECURITY POLICY VIOLATION REPORTER
// ============================================================

/**
 * Sets up a CSP violation reporter in the browser
 */
export function setupCSPViolationReporter(): void {
    document.addEventListener('securitypolicyviolation', (e) => {
        logAuditEvent({
            username: 'SYSTEM',
            role: 'SYSTEM',
            action: 'CSP_VIOLATION',
            details: `Bloqueado: ${e.blockedURI} | Directiva: ${e.violatedDirective} | Documento: ${e.documentURI}`,
            severity: 'CRITICAL',
            sessionId: 'SYSTEM',
        });
    });
}

// ============================================================
// AUTO-LOGOUT ON INACTIVITY
// ============================================================

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
let sessionTimeoutCallback: (() => void) | null = null;

/**
 * Resets the inactivity timer. Call on any user interaction.
 */
export function resetInactivityTimer(): void {
    refreshSessionActivity();

    if (inactivityTimer) clearTimeout(inactivityTimer);

    if (sessionTimeoutCallback) {
        inactivityTimer = setTimeout(() => {
            logAuditEvent({
                username: 'SYSTEM',
                role: 'SYSTEM',
                action: 'AUTO_LOGOUT',
                details: `Cierre de sesión automático por ${SESSION_TIMEOUT_MS / 60000} minutos de inactividad`,
                severity: 'WARNING',
                sessionId: 'SYSTEM',
            });
            destroySession();
            sessionTimeoutCallback?.();
        }, SESSION_TIMEOUT_MS);
    }
}

/**
 * Initializes the inactivity auto-logout system.
 * Pass a callback to be called when session expires.
 */
export function initInactivityGuard(onExpire: () => void): () => void {
    sessionTimeoutCallback = onExpire;

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => resetInactivityTimer();

    events.forEach(event => {
        window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the timer
    resetInactivityTimer();

    // Return cleanup function
    return () => {
        events.forEach(event => window.removeEventListener(event, handleActivity));
        if (inactivityTimer) clearTimeout(inactivityTimer);
        sessionTimeoutCallback = null;
    };
}

// ============================================================
// SECURE DATA HELPERS
// ============================================================

/**
 * Masks a sensitive ID/cédula showing only last 4 chars (for display)
 */
export function maskSensitiveId(id: string): string {
    if (!id) return '****';
    if (id.length <= 4) return '****';
    return `${'*'.repeat(id.length - 4)}${id.slice(-4)}`;
}

/**
 * Formats currency safely for display
 */
export function formatCurrency(amount: number): string {
    if (!validateAmount(amount) && amount !== 0) return 'B/. --';
    return new Intl.NumberFormat('es-PA', {
        style: 'currency',
        currency: 'PAB',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount).replace('PAB', 'B/.');
}

export const SECURITY_CONFIG = {
    SESSION_TIMEOUT_MINUTES: SESSION_TIMEOUT_MS / 60000,
    MAX_LOGIN_ATTEMPTS,
    LOCKOUT_MINUTES: LOCKOUT_DURATION_MS / 60000,
};
