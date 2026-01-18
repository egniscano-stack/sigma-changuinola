import React from 'react';
import { ShieldCheck, Users, ArrowRight, LayoutDashboard, Globe } from 'lucide-react';

interface LandingProps {
    onNavigate: (mode: 'ADMIN' | 'PORTAL') => void;
}

export const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
    return (
        <div className="min-h-[100dvh] bg-slate-50 flex flex-col justify-center items-center relative overflow-hidden font-sans p-4 sm:p-6 lg:p-8 support-ios-safe-area">

            {/* Background Decor - Subtle Light Theme */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50/50 via-slate-50 to-slate-100 z-0"></div>
            <div className="absolute top-10 right-10 opacity-5 rotate-12 z-0 pointer-events-none">
                <ShieldCheck size={300} className="text-emerald-900" />
            </div>

            <div className="z-10 w-full max-w-6xl px-2 sm:px-4 text-center mb-8 md:mb-12 mt-4 md:mt-0 flex flex-col items-center">

                {/* Municipality Badge - Light Theme */}
                <div className="inline-flex items-center gap-2 bg-white px-4 py-1.5 md:px-5 md:py-2 rounded-full border border-slate-200 shadow-sm mb-6 md:mb-8 animate-fade-in hover:border-emerald-200 transition-colors cursor-default select-none">
                    <ShieldCheck size={16} className="text-emerald-600 md:w-[18px] md:h-[18px]" />
                    <span className="text-slate-700 font-medium tracking-wide text-xs md:text-sm uppercase">Municipio de Changuinola</span>
                </div>

                {/* Main Logo */}
                <div className="flex justify-center mb-6">
                    <div className="relative group">
                        {/* Subtle glow for light bg */}
                        <div className="absolute -inset-4 bg-emerald-500/10 rounded-full blur-xl transition duration-1000 group-hover:bg-emerald-500/20"></div>
                        <img
                            src={`${import.meta.env.BASE_URL}sigma-logo-final.png`}
                            alt="SIGMA Logo"
                            className="relative h-28 sm:h-32 md:h-48 w-auto object-contain drop-shadow-xl hover:scale-105 transition-transform duration-300 pointer-events-none select-none"
                        />
                    </div>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-slate-900 mb-4 md:mb-6 tracking-tight leading-tight">
                    SIGMA <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600">Digital</span>
                </h1>
                <p className="text-slate-600 text-base sm:text-lg md:text-2xl max-w-3xl mx-auto font-medium leading-relaxed px-4">
                    Plataforma integral de gestión municipal y servicios.
                    <span className="hidden sm:inline"> <br /></span>
                    <span className="text-emerald-700 font-bold block sm:inline mt-1 sm:mt-0">Eficiencia, transparencia y rapidez.</span>
                </p>
            </div>

            <div className="z-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-4xl px-2 sm:px-6 mb-8">

                {/* Card 1: Portal Contribuyente */}
                <button
                    onClick={() => onNavigate('PORTAL')}
                    className="group relative bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-left border border-slate-100 flex flex-col h-full active:scale-[0.98] md:active:scale-[1.02]"
                >
                    <div className="absolute top-5 right-5 md:top-6 md:right-6 bg-blue-50 text-blue-600 p-2 md:p-3 rounded-xl md:rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors shadow-sm">
                        <Globe className="w-6 h-6 md:w-8 md:h-8" />
                    </div>

                    <div className="mt-2 md:mt-4 mb-4 md:mb-6 pr-8">
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">Portal de Contribuyente</h2>
                        <p className="text-slate-500 leading-relaxed text-xs md:text-sm">
                            Consulta tu estado de cuenta, realiza pagos en línea y descarga tus paz y salvos digitales.
                        </p>
                    </div>

                    <div className="mt-auto flex items-center text-blue-600 font-bold text-xs md:text-sm bg-blue-50 w-fit px-3 py-1.5 md:px-4 md:py-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                        Acceder al Portal <ArrowRight className="ml-2 w-4 h-4" />
                    </div>
                </button>

                {/* Card 2: Sistema Administrativo */}
                <button
                    onClick={() => onNavigate('ADMIN')}
                    className="group relative bg-white/95 backdrop-blur-sm rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 text-left border border-slate-100 flex flex-col h-full active:scale-[0.98] md:active:scale-[1.02]"
                >
                    <div className="absolute top-5 right-5 md:top-6 md:right-6 bg-emerald-50 text-emerald-600 p-2 md:p-3 rounded-xl md:rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors shadow-sm">
                        <LayoutDashboard className="w-6 h-6 md:w-8 md:h-8" />
                    </div>

                    <div className="mt-2 md:mt-4 mb-4 md:mb-6 pr-8">
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2 group-hover:text-emerald-700 transition-colors">Sistema Administrativo</h2>
                        <p className="text-slate-500 leading-relaxed text-xs md:text-sm">
                            Acceso exclusivo para funcionarios. Gestión de contribuyentes, caja y administración.
                        </p>
                    </div>

                    <div className="mt-auto flex items-center text-emerald-600 font-bold text-xs md:text-sm bg-emerald-50 w-fit px-3 py-1.5 md:px-4 md:py-2 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-all">
                        Ingreso Funcionarios <ArrowRight className="ml-2 w-4 h-4" />
                    </div>
                </button>

            </div>

            <div className="text-slate-400 text-[10px] md:text-xs text-center w-full z-10 py-4 mt-auto">
                © {new Date().getFullYear()} Alcaldía de Changuinola • Tecnología al servicio del ciudadano
            </div>
        </div>
    );
};
