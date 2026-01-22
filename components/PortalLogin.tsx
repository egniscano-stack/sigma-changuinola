import React, { useState } from 'react';
import { Taxpayer, User } from '../types';
import { User as UserIcon, ShieldCheck, ArrowRight } from 'lucide-react';

interface PortalLoginProps {
    onLogin: (user: User) => void;
    taxpayers: Taxpayer[];
}

export const PortalLogin: React.FC<PortalLoginProps> = ({ onLogin, taxpayers }) => {
    const [docId, setDocId] = useState('');
    const [taxpayerNum, setTaxpayerNum] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const foundTp = taxpayers.find(t => t.docId === docId && t.taxpayerNumber === taxpayerNum);

        if (foundTp) {
            console.log("Login Success:", foundTp);
            // Create a session user for the taxpayer
            const sessionUser: User = {
                username: foundTp.docId,
                name: foundTp.name,
                role: 'CONTRIBUYENTE',
            };
            onLogin(sessionUser);
        } else {
            setError('Datos no encontrados. Verifique su Cédula y N° de Contribuyente.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border-t-8 border-emerald-600">
                <div className="bg-emerald-600 p-8 text-center text-white">
                    <div className="w-auto inline-block mb-6">
                        <img src={`${import.meta.env.BASE_URL}municipio-logo-new.png`} className="h-64 w-auto object-contain mix-blend-multiply filter" alt="Escudo Municipio de Changuinola" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight uppercase">Sistema de Cobro Digital</h1>
                    <p className="text-emerald-100 text-lg mt-1 font-medium">Municipio de Changuinola</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="text-center mb-6">
                        <p className="text-slate-600">Ingrese sus datos para consultar su estado de cuenta y realizar pagos en línea.</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Identificación (Cédula o RUC)</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-3.5 text-slate-400" size={20} />
                            <input
                                type="text"
                                value={docId}
                                onChange={(e) => setDocId(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="Ej. 8-888-888"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">N° de Contribuyente</label>
                        <div className="relative">
                            <ShieldCheck className="absolute left-3 top-3.5 text-slate-400" size={20} />
                            <input
                                type="text"
                                value={taxpayerNum}
                                onChange={(e) => setTaxpayerNum(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="Ej. 2024-5823"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex justify-center items-center group"
                    >
                        CONSULTAR CUENTA <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </button>
                </form>


            </div>
            <p className="mt-8 text-slate-400 text-xs">© 2024 Plataforma Digital Municipal</p>
        </div>
    );
};
