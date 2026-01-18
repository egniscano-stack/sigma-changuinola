import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Transaction, TaxType } from '../types';
import { Download, FileText, TrendingUp, Calendar, Filter } from 'lucide-react';

interface ReportsProps {
  transactions: Transaction[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Reports: React.FC<ReportsProps> = ({ transactions }) => {
  
  // --- Data Processing ---
  const stats = useMemo(() => {
    const totalRevenue = transactions.reduce((acc, t) => acc + t.amount, 0);
    const avgTicket = totalRevenue / (transactions.length || 1);
    const paidTransactions = transactions.filter(t => t.status === 'PAGADO').length;
    
    // Group by Tax Type
    const byTypeMap = new Map<string, number>();
    transactions.forEach(t => {
      const current = byTypeMap.get(t.taxType) || 0;
      byTypeMap.set(t.taxType, current + t.amount);
    });
    
    const byTypeData = Array.from(byTypeMap.entries()).map(([name, value]) => ({ name, value }));

    // Group by Date (Last 7 entries simulation for demo)
    const byDateMap = new Map<string, number>();
    // Sort transactions by date first
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedTx.forEach(t => {
      const current = byDateMap.get(t.date) || 0;
      byDateMap.set(t.date, current + t.amount);
    });
    
    const byDateData = Array.from(byDateMap.entries()).map(([date, amount]) => ({ date, amount }));

    return { totalRevenue, avgTicket, paidTransactions, byTypeData, byDateData };
  }, [transactions]);

  // --- Handlers ---
  const handleExportCSV = () => {
    const headers = ['ID Transacción', 'Fecha', 'Hora', 'Tipo Impuesto', 'Contribuyente ID', 'Descripción', 'Estado', 'Monto', 'Cajero'];
    const rows = transactions.map(t => [
      t.id,
      t.date,
      t.time,
      t.taxType,
      t.taxpayerId,
      `"${t.description}"`, // Quote to handle commas
      t.status,
      t.amount.toFixed(2),
      t.tellerName
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_ingresos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes Financieros</h2>
          <p className="text-slate-500">Análisis detallado de recaudación y auditoría.</p>
        </div>
        <button 
          onClick={handleExportCSV}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm transition-all font-medium"
        >
          <Download size={18} />
          Exportar Excel (CSV)
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Ingresos Totales</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1">B/. {stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="text-xs text-slate-500">
            <span className="text-emerald-600 font-bold">▲ 12%</span> vs mes anterior
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Transacciones Pagadas</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1">{stats.paidTransactions}</h3>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
              <FileText size={24} />
            </div>
          </div>
           <div className="text-xs text-slate-500">
            Operaciones registradas en caja
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Ticket Promedio</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1">B/. {stats.avgTicket.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
              <Filter size={24} />
            </div>
          </div>
           <div className="text-xs text-slate-500">
            Promedio de recaudación por recibo
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Revenue over Time */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
            <Calendar size={18} className="mr-2 text-slate-400" />
            Tendencia de Recaudación (Diaria)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.byDateData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 12}}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit'})}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 12}}
                  tickFormatter={(val) => `B/.${val}`} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`B/. ${value.toFixed(2)}`, 'Monto']}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Revenue by Tax Type */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
            <PieChart size={18} className="mr-2 text-slate-400" /> {/* Just icon class, not component */}
            Distribución por Tipo de Impuesto
          </h3>
          <div className="h-72 w-full flex">
            <ResponsiveContainer width="60%" height="100%">
              <PieChart>
                <Pie
                  data={stats.byTypeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.byTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `B/. ${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-[40%] flex flex-col justify-center space-y-3">
               {stats.byTypeData.map((entry, index) => (
                 <div key={index} className="flex items-center text-sm">
                    <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    <div>
                      <p className="text-slate-600 font-medium">{entry.name}</p>
                      <p className="text-slate-900 font-bold">B/. {entry.value.toFixed(2)}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Transaction Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">Detalle de Transacciones</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3 font-semibold">ID Transacción</th>
                <th className="px-6 py-3 font-semibold">Fecha</th>
                <th className="px-6 py-3 font-semibold">Tipo</th>
                <th className="px-6 py-3 font-semibold">Descripción</th>
                <th className="px-6 py-3 font-semibold">Cajero</th>
                <th className="px-6 py-3 font-semibold text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {transactions.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-600">{t.id}</td>
                  <td className="px-6 py-4 text-slate-800">
                    <div className="font-medium">{t.date}</div>
                    <div className="text-xs text-slate-400">{t.time}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold">
                      {t.taxType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={t.description}>
                    {t.description}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{t.tellerName}</td>
                  <td className="px-6 py-4 text-right font-bold text-slate-800">
                    B/. {t.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && (
             <div className="p-8 text-center text-slate-400">
               No hay transacciones registradas en este periodo.
             </div>
          )}
        </div>
      </div>
    </div>
  );
};