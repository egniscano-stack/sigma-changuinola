import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { Transaction, TaxType, User, Taxpayer, Corregimiento, TaxConfig, CommercialCategory } from '../types';
import { Download, FileText, TrendingUp, Calendar, Filter, User as UserIcon, Printer, PieChart as PieChartIcon, Map as MapIcon } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportsProps {
  transactions: Transaction[];
  users: User[];
  currentUser: User;
  taxpayers: Taxpayer[];
  config: TaxConfig;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export const Reports: React.FC<ReportsProps> = ({ transactions, users, currentUser, taxpayers, config }) => {
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [selectedTeller, setSelectedTeller] = React.useState('ALL');

  // --- Data Processing ---
  const stats = useMemo(() => {
    // 1. Filter Data based on UI State
    const filtered = transactions.filter(t => {
      const matchDate = t.date >= startDate && t.date <= endDate;
      const matchTeller = selectedTeller === 'ALL' || t.tellerName === selectedTeller;
      return matchDate && matchTeller;
    });

    const workingSet = filtered;

    const totalRevenue = workingSet.reduce((acc, t) => acc + t.amount, 0); // Voids are negative, so they subtract automatically
    const avgTicket = totalRevenue / (workingSet.filter(t => t.status === 'PAGADO').length || 1);
    const paidTransactions = workingSet.filter(t => t.status === 'PAGADO').length;

    // Group by Tax Type
    const byTypeMap = new Map<string, number>();
    workingSet.forEach(t => {
      // Don't sum voided ones in the breakdown if we want clean charts?
      // Actually, standard is to show Net Revenue. 
      // If t is negative (void), it subtracts.
      const current = byTypeMap.get(t.taxType) || 0;
      byTypeMap.set(t.taxType, current + t.amount);
    });

    const byTypeData = Array.from(byTypeMap.entries()).map(([name, value]) => ({ name, value })).filter(v => v.value > 0); // Hide negative categories if any

    // Group by Date 
    const byDateMap = new Map<string, number>();
    const sortedTx = [...workingSet].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTx.forEach(t => {
      const current = byDateMap.get(t.date) || 0;
      byDateMap.set(t.date, current + t.amount);
    });

    const byDateData = Array.from(byDateMap.entries()).map(([date, amount]) => ({ date, amount }));

    // IMPORTANT: User wants them "removed from history" but "appear as annulled".
    // This implies visually distinct. We return all, but render carefully.
    return { totalRevenue, avgTicket, paidTransactions, byTypeData, byDateData, filteredTransactions: filtered };
  }, [transactions, startDate, endDate, selectedTeller]);

  // --- Handlers ---
  const handleExportCSV = () => {
    const headers = ['ID Transacción', 'Fecha', 'Hora', 'Tipo Impuesto', 'Contribuyente ID', 'Descripción', 'Estado', 'Monto', 'Cajero'];
    const rows = stats.filteredTransactions.map(t => [
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
    link.setAttribute("download", `reporte_ingresos_${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintClosing = () => {
    // Use the already filtered stats
    const filteredForReport = stats.filteredTransactions;
    const total = filteredForReport.reduce((acc, t) => acc + t.amount, 0);

    const pdf = new jsPDF();

    // Header
    pdf.setFontSize(20);
    pdf.text("Reporte de Cierre de Caja (Arqueo)", 105, 20, { align: 'center' });

    pdf.setFontSize(12);
    pdf.text(`Desde: ${startDate}  Hasta: ${endDate}`, 20, 35);
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
    autoTable(pdf, {
      startY: 65,
      head: [['Hora', 'ID', 'Descripción', 'Método', 'Monto']],
      body: filteredForReport.map(t => [
        t.time,
        t.id,
        t.description.length > 30 ? t.description.substring(0, 30) + '...' : t.description,
        t.paymentMethod,
        `B/. ${t.amount.toFixed(2)}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [66, 66, 66] },
      columnStyles: { 4: { halign: 'right' } }
    });

    const finalY = (pdf as any).lastAutoTable.finalY + 20;

    pdf.setFont("helvetica", "bold");
    pdf.text("Firma del Cajero: __________________________", 20, finalY);
    pdf.text("Firma del Supervisor: _______________________", 110, finalY);

    pdf.save(`Arqueo_${startDate}_${endDate}_${selectedTeller}.pdf`);
  };

  const handleGenerateGeneralReport = () => {
    // 1. Prepare Data
    // Corregimientos defined in enum
    const corregimientoStats = Object.values(Corregimiento).map(corregimiento => {
      // Find taxpayers in this corregimiento
      const taxpayersInZone = taxpayers.filter(t => t.corregimiento === corregimiento);
      const taxpayerIds = new Set(taxpayersInZone.map(t => t.id));

      // Calculate Income (from filtered transactions - e.g., today/selected period)
      // Note: We use 'stats.filteredTransactions' which respects the date filter chosen by user.
      const income = stats.filteredTransactions
        .filter(t => taxpayerIds.has(t.taxpayerId))
        .reduce((sum, t) => sum + t.amount, 0);

      // Calculate Debt & Delinquents in a single pass for consistency
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();

      let zoneTotalDebt = 0;
      let zoneDelinquentsCount = 0;

      taxpayersInZone.forEach(t => {
        let tpDebt = t.balance || 0; // Base historical debt

        // Commercial Debt
        if (t.hasCommercialActivity && t.status !== 'BLOQUEADO') {
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
        if (t.hasGarbageService && t.status !== 'BLOQUEADO') {
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

        zoneTotalDebt += tpDebt;

        // Count as delinquent if they have ANY debt calculated OR explicit bad status
        if (tpDebt > 0 || t.status === 'SUSPENDIDO' || t.status === 'BLOQUEADO' || t.status === 'MOROSO') {
          zoneDelinquentsCount++;
        }
      });

      return {
        name: corregimiento,
        count: taxpayersInZone.length,
        income,
        debt: zoneTotalDebt,
        delinquents: zoneDelinquentsCount
      };
    }).sort((a, b) => b.income - a.income); // Sort by highest income

    const totalIncome = corregimientoStats.reduce((sum, c) => sum + c.income, 0);
    const totalDebt = corregimientoStats.reduce((sum, c) => sum + c.debt, 0);

    // 2. Generate PDF
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.width;

    // Header
    pdf.setFillColor(44, 62, 80); // Dark Blue Header
    pdf.rect(0, 0, pageWidth, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.text("Informe General de Gestión", pageWidth / 2, 20, { align: 'center' });
    pdf.setFontSize(12);
    pdf.text(`Municipio de Changuinola | Periodo: ${startDate} - ${endDate}`, pageWidth / 2, 30, { align: 'center' });

    // Executive Summary Section
    pdf.setTextColor(44, 62, 80);
    pdf.setFontSize(16);
    pdf.text("Resumen Ejecutivo", 14, 55);

    // Summary Cards (drawn as rectangles)
    const cardY = 60;
    const cardWidth = 55;
    const cardHeight = 25;

    // Card 1: Income
    pdf.setFillColor(236, 253, 245); // Emerald 50
    pdf.setDrawColor(16, 185, 129); // Emerald 500
    pdf.rect(14, cardY, cardWidth, cardHeight, 'FD');
    pdf.setFontSize(10);
    pdf.setTextColor(16, 185, 129);
    pdf.text("Ingresos (Periodo)", 19, cardY + 8);
    pdf.setFontSize(14);
    pdf.setTextColor(6, 78, 59); // Emerald 900
    pdf.setFont("helvetica", "bold");
    pdf.text(`B/. ${totalIncome.toFixed(2)}`, 19, cardY + 18);

    // Card 2: Debt
    pdf.setFillColor(254, 242, 242); // Red 50
    pdf.setDrawColor(239, 68, 68); // Red 500
    pdf.rect(14 + cardWidth + 10, cardY, cardWidth, cardHeight, 'FD');
    pdf.setFontSize(10);
    pdf.setTextColor(239, 68, 68);
    pdf.text("Monto por Cobrar (Global)", 19 + cardWidth + 10, cardY + 8);
    pdf.setFontSize(14);
    pdf.setTextColor(127, 29, 29); // Red 900
    pdf.text(`B/. ${totalDebt.toFixed(2)}`, 19 + cardWidth + 10, cardY + 18);

    // Card 3: Transactions
    pdf.setFillColor(239, 246, 255); // Blue 50
    pdf.setDrawColor(59, 130, 246); // Blue 500
    pdf.rect(14 + (cardWidth + 10) * 2, cardY, cardWidth, cardHeight, 'FD');
    pdf.setFontSize(10);
    pdf.setTextColor(59, 130, 246);
    pdf.text("Transacciones", 19 + (cardWidth + 10) * 2, cardY + 8);
    pdf.setFontSize(14);
    pdf.setTextColor(30, 58, 138); // Blue 900
    pdf.text(`${stats.paidTransactions}`, 19 + (cardWidth + 10) * 2, cardY + 18);


    // CHART: Income by Tax Type (Simple Bar Chart representation)
    let yPos = 100;
    pdf.setFontSize(14);
    pdf.setTextColor(44, 62, 80);
    pdf.text("Distribución de Ingresos por Tipo", 14, yPos);
    yPos += 10;

    const maxVal = Math.max(...stats.byTypeData.map(d => d.value), 1);
    const barHeight = 8;
    stats.byTypeData.forEach((item, index) => {
      const barWidth = (item.value / maxVal) * 100;
      pdf.setFontSize(10);
      pdf.setTextColor(60, 60, 60);
      pdf.text(item.name, 14, yPos + 6);

      pdf.setFillColor(59, 130, 246);
      pdf.rect(50, yPos, barWidth, barHeight, 'F');

      pdf.text(`B/. ${item.value.toFixed(2)}`, 55 + barWidth, yPos + 6);
      yPos += 12;
    });

    yPos += 10;

    // SECTION: Details by Corregimiento
    pdf.setFontSize(14);
    pdf.setTextColor(44, 62, 80);
    pdf.text("Análisis por Corregimiento (Ranking)", 14, yPos);

    // AutoTable for Corregimientos
    autoTable(pdf, {
      startY: yPos + 5,
      head: [['Corregimiento', 'Contrib.', 'Ingresos (Periodo)', 'Monto Deuda', '# Morosos']],
      body: corregimientoStats.map(c => [
        c.name,
        c.count,
        `B/. ${c.income.toFixed(2)}`,
        `B/. ${c.debt.toFixed(2)}`,
        c.delinquents
      ]),
      theme: 'striped',
      headStyles: { fillColor: [44, 62, 80] },
      columnStyles: {
        2: { halign: 'right', fontStyle: 'bold', textColor: [16, 185, 129] }, // Income Green
        3: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },  // Debt Red
        4: { halign: 'center', fontStyle: 'bold', textColor: [234, 88, 12] }  // Morosos Orange/Red
      },
    });

    // Footer
    const totalPages = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`Página ${i} de ${totalPages} - Generado el ${new Date().toLocaleString()}`, pageWidth / 2, pdf.internal.pageSize.height - 10, { align: 'center' });
    }

    pdf.save(`Informe_Gestion_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Reportes Financieros</h2>
          <p className="text-slate-500">Análisis detallado de recaudación y auditoría.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateGeneralReport}
            className="flex items-center gap-2 bg-indigo-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-800 shadow-md transition-all font-bold animate-pulse"
            title="Incluye análisis por corregimiento y métricas de deuda"
          >
            <FileText size={18} />
            Informe General PDF
          </button>
        </div>
      </div>

      {/* Control Bar for Closing Report */}
      <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-end justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-end w-full md:w-auto">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
            className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 shadow-sm transition-all font-medium"
          >
            <Printer size={18} />
            Arqueo PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 shadow-sm transition-all font-medium"
          >
            <Download size={18} />
            CSV
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
            <PieChartIcon size={18} className="mr-2 text-slate-400" />
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