import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Transaction, Taxpayer, TaxConfig, TaxType, CommercialCategory } from '../types';
import { DollarSign, TrendingUp, Users, AlertCircle, Calendar, Clock, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  taxpayers: Taxpayer[];
  config: TaxConfig;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Dashboard: React.FC<DashboardProps> = ({ transactions, taxpayers, config }) => {
  const [timeFilter, setTimeFilter] = useState<'DAY' | 'WEEK' | 'MONTH'>('MONTH');

  // 1. FILTER TRANSACTIONS
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    return transactions.filter(t => {
      const tDate = new Date(t.date + 'T' + t.time); // Combinar fecha y hora para precisión
      if (timeFilter === 'DAY') return tDate >= startOfDay;
      if (timeFilter === 'WEEK') return new Date(t.date) >= startOfWeek;
      if (timeFilter === 'MONTH') return new Date(t.date) >= startOfMonth;
      return true;
    });
  }, [transactions, timeFilter]);

  // 2. CALCULATE KPI METRICS
  const totalRevenue = filteredTransactions
    .filter(t => t.status === 'PAGADO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const transactionCount = filteredTransactions.length;

  // 3. DEBT & DELINQUENCY CALCULATION (Dinero por Cobrar & Contribuyentes Morosos)
  // 3. DEBT & DELINQUENCY CALCULATION (Dinero por Cobrar & Contribuyentes Morosos)
  const debtStats = useMemo(() => {
    let totalDebtAmount = 0;
    let delinquentCount = 0;

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    taxpayers.forEach(t => {
      let tpDebt = t.balance || 0;

      // Commercial Debt
      if (t.hasCommercialActivity && (t.status === 'ACTIVO' || t.status === 'MOROSO')) {
        const hasPaid = transactions.some(tx =>
          tx.taxpayerId === t.id &&
          tx.taxType === TaxType.COMERCIO &&
          new Date(tx.date).getMonth() + 1 === currentMonth &&
          new Date(tx.date).getFullYear() === currentYear
        );
        if (!hasPaid) {
          tpDebt += config.commercialBaseRate;
        }
      }

      // Garbage Debt
      if (t.hasGarbageService && (t.status === 'ACTIVO' || t.status === 'MOROSO')) {
        const hasPaid = transactions.some(tx =>
          tx.taxpayerId === t.id &&
          tx.taxType === TaxType.BASURA &&
          new Date(tx.date).getMonth() + 1 === currentMonth &&
          new Date(tx.date).getFullYear() === currentYear
        );
        if (!hasPaid) {
          tpDebt += config.garbageResidentialRate;
        }
      }

      // Count as delinquent
      if (tpDebt > 0) {
        totalDebtAmount += tpDebt;
        delinquentCount++;
      }
    });

    return { amount: totalDebtAmount, count: delinquentCount };
  }, [taxpayers, transactions, config]);


  // 4. CHART DATA PREPARATION
  const chartData = useMemo(() => {
    // Group by Date within filter
    const grouped: Record<string, number> = {};
    filteredTransactions.forEach(t => {
      const dateKey = t.date; // YYYY-MM-DD
      grouped[dateKey] = (grouped[dateKey] || 0) + t.amount;
    });

    // Fill missing days if needed or just show available data sorted
    return Object.keys(grouped).sort().map(date => ({
      name: new Date(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
      total: grouped[date]
    }));
  }, [filteredTransactions]);

  const pieData = [
    { name: 'Comercio', value: filteredTransactions.filter(t => t.taxType === TaxType.COMERCIO).reduce((a, b) => a + b.amount, 0) },
    { name: 'Vehículos', value: filteredTransactions.filter(t => t.taxType === TaxType.VEHICULO).reduce((a, b) => a + b.amount, 0) },
    { name: 'Basura', value: filteredTransactions.filter(t => t.taxType === TaxType.BASURA).reduce((a, b) => a + b.amount, 0) },
    { name: 'Obras', value: filteredTransactions.filter(t => t.taxType === TaxType.CONSTRUCCION).reduce((a, b) => a + b.amount, 0) },
  ].filter(i => i.value > 0);

  const StatCard = ({ title, value, subtext, icon: Icon, color, trend }: any) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all h-full">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 rounded-lg ${color} bg-opacity-10`}>
          <Icon size={24} className={color.replace('bg-', 'text-')} />
        </div>
        {trend && (
          <span className="text-xs font-bold text-emerald-600 flex items-center bg-emerald-50 px-2 py-1 rounded-full">
            <ArrowUpRight size={12} className="mr-1" /> {trend}
          </span>
        )}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        <p className="text-xs md:text-sm font-medium text-slate-500">{title}</p>
        <p className="text-[10px] text-slate-400 mt-1">{subtext}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 animate-fade-in">

      {/* Header & Filter */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
          <p className="text-slate-500 text-sm">Resumen financiero y operativo</p>
        </div>

        <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm flex">
          {['DAY', 'WEEK', 'MONTH'].map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter as any)}
              className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${timeFilter === filter
                ? 'bg-slate-900 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              {filter === 'DAY' ? 'Hoy' : filter === 'WEEK' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        {/* Helper for testing notifications */}
        <button
          onClick={() => {
            // Dispatch a fake storage event or just call alert? No, we need to trigger the TOAST state in App.tsx. 
            // Since this is a child component, we can't easily set App state unless passed.
            // BUT we can trigger a Notification API test directly.
            new Notification('Prueba de Sistema', { body: 'Las notificaciones funcionan correctamente.', icon: '/sigma-logo-final.png' });
            alert("Se ha enviado una notificación de prueba al navegador. Si no la ves, revisa los permisos del sitio.");
          }}
          className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded hover:bg-slate-300"
        >
          Test Notificación
        </button>
      </div >

      {/* KPI Cards */}
      < div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6" >
        <StatCard
          title="Recaudación Total"
          value={`B/. ${totalRevenue.toFixed(2)}`}
          subtext={`Ingresos del periodo (${timeFilter === 'DAY' ? 'Hoy' : timeFilter === 'WEEK' ? 'Semana' : 'Mes'})`}
          icon={DollarSign}
          color="bg-emerald-500 text-emerald-600"
          trend="+12% vs. ant."
        />
        <StatCard
          title="Transacciones"
          value={transactionCount}
          subtext="Operaciones procesadas"
          icon={FileText}
          color="bg-blue-500 text-blue-600"
        />
        <StatCard
          title="Contribuyentes Morosos"
          value={debtStats.count}
          subtext="Con pagos atrasados"
          icon={Users}
          color="bg-amber-500 text-amber-600"
        />
        <StatCard
          title="Dinero por Cobrar"
          value={`B/. ${debtStats.amount.toFixed(2)}`}
          subtext="Deuda total estimada"
          icon={AlertCircle}
          color="bg-red-500 text-red-600"
        />
      </div >

      {/* Charts Section */}
      < div className="grid grid-cols-1 lg:grid-cols-3 gap-6" >

        {/* Revenue Chart */}
        < div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2" >
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
            <TrendingUp size={20} className="mr-2 text-slate-400" />
            Tendencia de Recaudación
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              {chartData.length > 0 ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingresos" />
                </BarChart>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">No hay datos para este periodo</div>
              )}
            </ResponsiveContainer>
          </div>
        </div >

        {/* Tax Distribution */}
        < div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100" >
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
            <PieChart size={20} className="mr-2 text-slate-400" />
            Distribución
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {pieData.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-bold text-slate-800">B/. {item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div >
      </div >

      {/* Recent Transactions List */}
      < div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden" >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Últimas Transacciones</h3>
          <button className="text-sm text-emerald-600 font-bold hover:underline">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Contribuyente ID</th>
                <th className="px-6 py-3">Concepto</th>
                <th className="px-6 py-3">Fecha</th>
                <th className="px-6 py-3 text-right">Monto</th>
                <th className="px-6 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTransactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-slate-500">{tx.id.slice(-6)}...</td>
                  <td className="px-6 py-4 font-bold text-slate-700">{taxpayers.find(t => t.id === tx.taxpayerId)?.name || 'Desconocido'}</td>
                  <td className="px-6 py-4">{tx.description}</td>
                  <td className="px-6 py-4 text-slate-500">{tx.date}</td>
                  <td className="px-6 py-4 text-right font-bold">B/. {tx.amount.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${tx.status === 'PAGADO' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No hay transacciones en este periodo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div >

    </div >
  );
};