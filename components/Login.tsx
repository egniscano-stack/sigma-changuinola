import React, { useState } from 'react';
import { User } from '../types';
import { Lock, User as UserIcon } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  validUsers: User[]; // Receive list of valid users
}

export const Login: React.FC<LoginProps> = ({ onLogin, validUsers }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Find user in the list
    const foundUser = validUsers.find(u => u.username === username && u.password === password);

    if (foundUser) {
      onLogin(foundUser);
    } else {
      setError('Usuario o contraseña incorrectos.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="bg-white p-4 rounded-full mb-6 shadow-2xl ring-4 ring-emerald-500/30">
          <img
            src="/sigma-new-logo.jpg"
            alt="SIGMA Changuinola Logo"
            className="h-56 w-56 object-contain rounded-full"
          />
        </div>
        <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">SIGMA <span className="text-emerald-400">Changuinola</span></h1>
        <p className="text-emerald-200 text-lg font-medium tracking-wide">Precisión fiscal, gestión inteligente</p>
      </div>

      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border-t-4 border-emerald-500">
        <div className="bg-slate-900/50 p-6 text-center border-b border-slate-700">
          <h2 className="text-white text-xl font-bold">Acceso Administrativo</h2>
          <p className="text-slate-400 text-sm">Zona exclusiva para funcionarios municipales</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-500/20 text-white p-3 rounded-lg text-sm text-center border border-red-500/50 flex items-center justify-center">
              <span className="mr-2">⚠️</span> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Usuario</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 text-slate-500" size={20} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-slate-900 text-white font-medium placeholder-slate-600"
                placeholder="Ej. admin"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-500" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-slate-900 text-white font-medium placeholder-slate-600"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
          >
            INGRESAR AL SISTEMA
          </button>

          <div className="text-center mt-4 p-3 bg-slate-900/50 rounded border border-slate-700">
            <p className="text-xs text-emerald-400 font-semibold mb-1">
              Credenciales de Acceso (Demo):
            </p>
            <p className="text-xs text-slate-400">
              Director: <span className="font-mono font-bold text-white">director</span> / <span className="font-mono font-bold text-white">admin</span>
            </p>
            <p className="text-xs text-slate-400">
              Recaudación: <span className="font-mono font-bold text-white">recaudador</span> / <span className="font-mono font-bold text-white">cajero</span>
            </p>
          </div>
        </form>
      </div>

      <p className="text-slate-500 text-xs mt-8">© 2024 Municipio de Changuinola, Bocas del Toro.</p>
    </div>
  );
};