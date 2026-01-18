import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Transaction, TaxType } from '../types';
import { DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  taxpayerCount: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

export const Dashboard: React.FC<DashboardProps> = ({ transactions, taxpayerCount }) => {
  // Calculate Summary Stats
  const totalRevenue = transactions
    .filter(t => t.status === 'PAGADO')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const pendingCount = transactions.filter(t => t.status === 'PENDIENTE').length;

  // Data for Charts
  const revenueByType = [
    { name: 'Vehicular', value: 0, key: TaxType.VEHICULO },
    { name: 'Const.', value: 0, key: TaxType.CONSTRUCCION },
    { name: 'Basura', value: 0, key: TaxType.BASURA },
    { name: 'Comercio', value: 0, key: TaxType.COMERCIO },
  ];

  transactions.forEach(t => {
    if (t.status === 'PAGADO') {
      const idx = revenueByType.findIndex(item => item.key === t.taxType);
      if (idx !== -1) revenueByType[idx].value += t.amount;
    }
  });

  const dailyData = [
    { name: 'Lun', total: 400 },
    { name: 'Mar', total: 300 },
    { name: 'Mie', total: 550 },
    { name: 'Jue', total: 450 },
    { name: 'Vie', total: 800 },
  ];

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-xl md:text-2xl font-bold text-slate-800">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Panel de Control</h2>
        <span className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
          Periodo: Octubre 2023
        </span>
      </div>

      {/* KPI Cards - Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          title="Recaudación Total"
          value={`B/. ${totalRevenue.toFixed(2)}`}
          icon={DollarSign}
          color="bg-emerald-500"
        />
        <StatCard
          title="Transacciones"
          value={transactions.length}
          icon={TrendingUp}
          color="bg-blue-500"
        />
        <StatCard
          title="Contribuyentes Activos"
          value={taxpayerCount}
          icon={Users}
          color="bg-indigo-500"
        />
        <StatCard
          title="Pagos Pendientes"
          value={pendingCount}
          icon={AlertCircle}
          color="bg-amber-500"
        />
      </div>

      {/* Charts Section - Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
          <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-6">Recaudación Semanal</h3>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `B/.${value}`} tick={{ fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="text-base md:text-lg font-semibold text-slate-800 mb-6">Distribución por Impuesto</h3>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={revenueByType}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {revenueByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 mt-4">
            {revenueByType.map((item, index) => (
              <div key={item.name} className="flex justify-between items-center text-xs md:text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index] }}></div>
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-semibold text-slate-800">B/. {item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};