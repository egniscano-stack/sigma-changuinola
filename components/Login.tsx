import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Lock, User as UserIcon, Shield, AlertTriangle, Eye, EyeOff, Clock } from 'lucide-react';
import {
  createSession,
  recordFailedLogin,
  clearLoginAttempts,
  isAccountLocked,
  setupCSPViolationReporter,
  logAuditEvent,
} from '../services/security';

interface LoginProps {
  onLogin: (user: User) => void;
  validUsers: User[]; // Receive list of valid users
}

export const Login: React.FC<LoginProps> = ({ onLogin, validUsers }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutInfo, setLockoutInfo] = useState<{ locked: boolean; minutesRemaining?: number }>({ locked: false });
  const [attemptWarning, setAttemptWarning] = useState('');

  useEffect(() => {
    // Setup CSP violation reporter on mount
    setupCSPViolationReporter();
  }, []);

  // Re-check lockout status every 30 seconds
  useEffect(() => {
    if (!username) return;
    const checkLockout = () => {
      const status = isAccountLocked(username);
      setLockoutInfo(status);
    };
    checkLockout();
    const interval = setInterval(checkLockout, 30000);
    return () => clearInterval(interval);
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate a small delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));

    try {
      // 1. Check if account is locked BEFORE trying
      const lockStatus = isAccountLocked(username.trim());
      if (lockStatus.locked) {
        setLockoutInfo(lockStatus);
        setError(`Cuenta temporalmente bloqueada. Intente de nuevo en ${lockStatus.minutesRemaining} minuto(s).`);
        setIsLoading(false);
        return;
      }

      // 2. Find user - case-insensitive username, EXACT password
      const foundUser = validUsers.find(
        u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
      );

      if (foundUser) {
        // SUCCESS: Clear any failed attempts
        clearLoginAttempts(username.trim());
        setLockoutInfo({ locked: false });
        setAttemptWarning('');

        // Create secure session
        const session = createSession({
          username: foundUser.username,
          role: foundUser.role,
          name: foundUser.name,
        });

        // Pass user to app with session ID attached
        onLogin({ ...foundUser, password: undefined }); // Strip password from memory
      } else {
        // FAILURE: Record attempt
        const result = recordFailedLogin(username.trim());

        if (result.isLocked) {
          setLockoutInfo({ locked: true, minutesRemaining: result.lockoutMinutes });
          setError(`Demasiados intentos fallidos. Cuenta bloqueada por ${result.lockoutMinutes} minutos por seguridad.`);
        } else {
          setError('Usuario o contraseña incorrectos.');
          if (result.attemptsRemaining <= 2) {
            setAttemptWarning(
              `⚠️ Advertencia: ${result.attemptsRemaining} intento(s) restante(s) antes del bloqueo temporal.`
            );
          }
        }
      }
    } catch (err) {
      setError('Error de sistema. Contacte al administrador.');
      logAuditEvent({
        username: username || 'UNKNOWN',
        role: 'UNKNOWN',
        action: 'LOGIN_ERROR',
        details: `Error durante autenticación: ${String(err)}`,
        severity: 'CRITICAL',
        sessionId: 'N/A',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4" style={{
      backgroundImage: 'radial-gradient(ellipse at top, #0f2027 0%, #203a43 50%, #2c5364 100%)',
    }}>
      {/* Security Badge */}
      <div className="mb-4 flex items-center gap-2 bg-emerald-900/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold px-4 py-2 rounded-full backdrop-blur">
        <Shield size={14} />
        <span>Sistema Seguro — Gobierno de Panamá</span>
      </div>

      <div className="mb-8 text-center flex flex-col items-center">
        <div className="bg-white p-4 rounded-full mb-6 shadow-2xl ring-4 ring-emerald-500/30">
          <img
            src={`${import.meta.env.BASE_URL}sigma-logo-final.png`}
            alt="SIGMA Changuinola Logo"
            className="h-56 w-56 object-contain rounded-full"
          />
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">SIGMA <span className="text-emerald-400">Changuinola</span></h1>
        <p className="text-emerald-200 text-lg font-medium tracking-wide">Precisión fiscal, gestión inteligente</p>
      </div>

      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-t-4 border-emerald-500">
        <div className="bg-slate-900/50 p-6 text-center border-b border-slate-700">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Lock size={16} className="text-emerald-400" />
            <h2 className="text-white text-xl font-bold">Acceso Administrativo</h2>
          </div>
          <p className="text-slate-400 text-sm">Zona exclusiva para funcionarios municipales</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5" autoComplete="off">
          {/* Lockout Warning */}
          {lockoutInfo.locked && (
            <div className="bg-red-900/40 text-red-200 p-4 rounded-lg text-sm border border-red-500/50 flex items-start gap-3">
              <Clock size={18} className="mt-0.5 flex-shrink-0 text-red-400" />
              <div>
                <p className="font-bold text-red-300">Cuenta Temporalmente Bloqueada</p>
                <p>Múltiples intentos fallidos detectados. Por seguridad, esta cuenta está bloqueada por {lockoutInfo.minutesRemaining} minuto(s). Contacte al administrador si necesita acceso inmediato.</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !lockoutInfo.locked && (
            <div className="bg-red-500/20 text-white p-3 rounded-lg text-sm text-center border border-red-500/50 flex items-center justify-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* Attempt Warning */}
          {attemptWarning && (
            <div className="bg-amber-900/30 text-amber-300 p-3 rounded-lg text-xs border border-amber-500/30 text-center">
              {attemptWarning}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Usuario</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 text-slate-500" size={20} />
              <input
                type="text"
                id="sigma-username"
                name="sigma-username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError('');
                  setAttemptWarning('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-slate-900 text-white font-medium placeholder-slate-600"
                placeholder="Ej. admin"
                required
                disabled={lockoutInfo.locked || isLoading}
                autoComplete="off"
                maxLength={50}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-500" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="sigma-password"
                name="sigma-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-12 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-slate-900 text-white font-medium placeholder-slate-600"
                placeholder="••••••••"
                required
                disabled={lockoutInfo.locked || isLoading}
                autoComplete="current-password"
                maxLength={100}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={lockoutInfo.locked || isLoading || !username || !password}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verificando...
              </>
            ) : lockoutInfo.locked ? (
              <>
                <Clock size={18} />
                BLOQUEADO TEMPORALMENTE
              </>
            ) : (
              <>
                <Shield size={18} />
                INGRESAR AL SISTEMA
              </>
            )}
          </button>

          {/* Security Notice */}
          <div className="border-t border-slate-700 pt-4">
            <p className="text-slate-500 text-xs text-center leading-relaxed">
              🔒 Este sistema registra todos los accesos y operaciones realizadas.<br />
              El uso no autorizado está prohibido y será reportado.
            </p>
          </div>
        </form>
      </div>

      <p className="text-slate-500 text-xs mt-8">© {new Date().getFullYear()} Municipio de Changuinola, Bocas del Toro. Sistema SIGMA v2.0</p>
    </div>
  );
};