import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Transaction, TaxType, User } from '../types';
import { Download, FileText, TrendingUp, Calendar, Filter, User as UserIcon, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface ReportsProps {
  transactions: Transaction[];
  users: User[];
  currentUser: User;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Reports: React.FC<ReportsProps> = ({ transactions, users, currentUser }) => {
  const [selectedDate, setSelectedDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [selectedTeller, setSelectedTeller] = React.useState('ALL');

  // --- Data Processing ---
  const stats = useMemo(() => {
    // 1. Filter Data based on UI State
    const filtered = transactions.filter(t => {
      const matchDate = t.date === selectedDate;
      const matchTeller = selectedTeller === 'ALL' || t.tellerName === selectedTeller;
      return matchDate && matchTeller;
    });

    const workingSet = filtered;

    const totalRevenue = workingSet.reduce((acc, t) => acc + t.amount, 0);
    const avgTicket = totalRevenue / (workingSet.length || 1);
    const paidTransactions = workingSet.filter(t => t.status === 'PAGADO').length;

    // Group by Tax Type
    const byTypeMap = new Map<string, number>();
    workingSet.forEach(t => {
      const current = byTypeMap.get(t.taxType) || 0;
      byTypeMap.set(t.taxType, current + t.amount);
    });

    const byTypeData = Array.from(byTypeMap.entries()).map(([name, value]) => ({ name, value }));

    // Group by Date 
    const byDateMap = new Map<string, number>();
    const sortedTx = [...workingSet].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTx.forEach(t => {
      const current = byDateMap.get(t.date) || 0;
      byDateMap.set(t.date, current + t.amount);
    });

    const byDateData = Array.from(byDateMap.entries()).map(([date, amount]) => ({ date, amount }));

    return { totalRevenue, avgTicket, paidTransactions, byTypeData, byDateData, filteredTransactions: filtered };
  }, [transactions, selectedDate, selectedTeller]);

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

  const handlePrintClosing = () => {
    const filteredForReport = transactions.filter(t => {
      const matchDate = t.date === selectedDate;
      const matchTeller = selectedTeller === 'ALL' || t.tellerName === selectedTeller;
      return matchDate && matchTeller;
    });

    const total = filteredForReport.reduce((acc, t) => acc + t.amount, 0);

    const pdf = new jsPDF();

    // Header
    pdf.setFontSize(20);
    pdf.text("Reporte de Cierre de Caja (Arqueo)", 105, 20, { align: 'center' });

    pdf.setFontSize(12);
    pdf.text(`Fecha: ${selectedDate}`, 20, 35);
    pdf.text(`Cajero: ${selectedTeller === 'ALL' ? 'TODOS' : selectedTeller}`, 20, 42);
    pdf.text(`Generado por: ${currentUser.name}`, 20, 49);

    // Summary
    pdf.setDrawColor(0);
    pdf.setFillColor(240, 240, 240);
    pdf.rect(140, 30, 50, 20, 'F');
    pdf.setFontSize(10);
    pdf.text("Total Recaudado:", 145, 38);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(`B/. ${total.toFixed(2)}`, 145, 45);

    // Table
    let y = 65;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.text("Hora", 20, y);
    pdf.text("Transacción", 40, y);
    pdf.text("Descripción", 80, y);
    pdf.text("Método", 150, y);
    pdf.text("Monto", 180, y);

    pdf.line(20, y + 2, 190, y + 2);
    y += 8;

    pdf.setFont("helvetica", "normal");
    filteredForReport.forEach(t => {
      if (y > 280) { pdf.addPage(); y = 20; }
      pdf.text(t.time, 20, y);
      pdf.text(t.id, 40, y);
      const desc = t.description.length > 30 ? t.description.substring(0, 30) + '...' : t.description;
      pdf.text(desc, 80, y);
      pdf.text(t.paymentMethod, 150, y);
      pdf.text(t.amount.toFixed(2), 190, y, { align: 'right' });
      y += 7;
    });

    pdf.line(20, y, 190, y);
    y += 10;

    pdf.setFont("helvetica", "bold");
    pdf.text("Firma del Cajero: __________________________", 20, y + 20);
    pdf.text("Firma del Supervisor: _______________________", 110, y + 20);

    pdf.save(`Arqueo_${selectedDate}_${selectedTeller}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes Financieros</h2>
          <p className="text-slate-500">Análisis detallado de recaudación y auditoría.</p>
        </div>
      </div>

      {/* Control Bar for Closing Report */}
      <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="flex gap-4 items-end w-full md:w-auto">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fecha de Arqueo</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cajero</label>
            <select
              value={selectedTeller}
              onChange={(e) => setSelectedTeller(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
            >
              <option value="ALL">Todos los Cajeros</option>
              {users.filter(u => u.role === 'CAJERO' || u.role === 'ADMIN').map(u => (
                <option key={u.username} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrintClosing}
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 shadow-sm transition-all font-bold"
          >
            <Printer size={18} />
            Generar Arqueo PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 shadow-sm transition-all font-medium"
          >
            <Download size={18} />
            Exportar General CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Ingresos Totales (Filtrado)</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1">B/. {stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Transacciones (Filtrado)</p>
              <h3 className="text-3xl font-bold text-slate-800 mt-1">{stats.paidTransactions}</h3>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
              <FileText size={24} />
            </div>
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
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
            <Calendar size={18} className="mr-2 text-slate-400" />
            Tendencia de Recaudación (Filtrado)
          </h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.byDateData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center">
            <PieChart size={18} className="mr-2 text-slate-400" />
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
          <h3 className="text-lg font-bold text-slate-800">Detalle de Transacciones (Filtrado)</h3>
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
              {stats.filteredTransactions.map((t) => (
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
          {stats.filteredTransactions.length === 0 && (
            <div className="p-8 text-center text-slate-400">
              No hay transacciones que coincidan con los filtros.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};