import React, { useMemo } from 'react';
import { Taxpayer, Transaction, TaxType } from '../types';
import { AlertCircle, Calendar, CheckCircle, Car, Store, Trash2, ArrowRight } from 'lucide-react';

interface DebtsProps {
  taxpayers: Taxpayer[];
  transactions: Transaction[];
  onGoToPay: (taxpayer: Taxpayer) => void;
}

interface PendingItem {
  taxpayer: Taxpayer;
  type: TaxType;
  description: string;
  dueDate: string;
  isOverdue: boolean;
}

export const Debts: React.FC<DebtsProps> = ({ taxpayers, transactions, onGoToPay }) => {
  
  // Logic to calculate pending debts
  const pendingDebts = useMemo(() => {
    const debts: PendingItem[] = [];
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // 1-12

    taxpayers.forEach(tp => {
      // 1. Check Commercial Tax (Monthly)
      if (tp.hasCommercialActivity) {
        // Check if there is a transaction for COMERCIO in the current month & year
        const hasPaidCurrentMonth = transactions.some(t => {
            const tDate = new Date(t.date);
            return t.taxpayerId === tp.id && 
                   t.taxType === TaxType.COMERCIO && 
                   t.status === 'PAGADO' &&
                   tDate.getMonth() + 1 === currentMonth &&
                   tDate.getFullYear() === currentYear;
        });

        if (!hasPaidCurrentMonth) {
            debts.push({
                taxpayer: tp,
                type: TaxType.COMERCIO,
                description: `Impuesto Comercial (${tp.commercialCategory})`,
                dueDate: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-30`, // End of month approx
                isOverdue: currentDate.getDate() > 15 // Assuming due date is 15th
            });
        }
      }

      // 2. Check Garbage Tax (Monthly)
      if (tp.hasGarbageService) {
         const hasPaidGarbage = transactions.some(t => {
            const tDate = new Date(t.date);
            return t.taxpayerId === tp.id && 
                   t.taxType === TaxType.BASURA && 
                   t.status === 'PAGADO' &&
                   tDate.getMonth() + 1 === currentMonth &&
                   tDate.getFullYear() === currentYear;
        });

        if (!hasPaidGarbage) {
            debts.push({
                taxpayer: tp,
                type: TaxType.BASURA,
                description: 'Tasa de Aseo / Basura',
                dueDate: `${currentYear}-${currentMonth.toString().padStart(2, '0')}-30`,
                isOverdue: currentDate.getDate() > 15
            });
        }
      }

      // 3. Check Vehicle Plates (Annual, based on Plate Number last digit)
      // Logic: Plate ending in 1 -> Pay in Jan. Ending in 2 -> Pay in Feb... Ending in 0 -> Pay in Oct.
      if (tp.vehicles && tp.vehicles.length > 0) {
          tp.vehicles.forEach(v => {
              const lastDigitChar = v.plate.trim().slice(-1);
              const lastDigit = parseInt(lastDigitChar);
              
              // Determine renewal month (1-9 = Jan-Sep, 0 = Oct)
              // If last digit is NaN (special plates), assume January for safety.
              let renewalMonth = isNaN(lastDigit) ? 1 : (lastDigit === 0 ? 10 : lastDigit);
              
              // Logic: Show debt if:
              // a) Current month is the renewal month OR
              // b) Current month is AFTER the renewal month (Overdue)
              // AND
              // c) Has not paid for this YEAR.
              
              if (currentMonth >= renewalMonth) {
                  const hasPaidPlate = transactions.some(t => {
                      const tDate = new Date(t.date);
                      return t.taxpayerId === tp.id &&
                             t.taxType === TaxType.VEHICULO &&
                             t.metadata?.plateNumber === v.plate &&
                             tDate.getFullYear() === currentYear;
                  });

                  if (!hasPaidPlate) {
                      const monthName = new Date(currentYear, renewalMonth - 1).toLocaleString('es-ES', { month: 'long' });
                      debts.push({
                          taxpayer: tp,
                          type: TaxType.VEHICULO,
                          description: `Placa ${v.plate} (${v.brand}) - Mes: ${monthName}`,
                          dueDate: `${currentYear}-${renewalMonth.toString().padStart(2, '0')}-30`,
                          isOverdue: currentMonth > renewalMonth
                      });
                  }
              }
          });
      }
    });

    return debts;
  }, [taxpayers, transactions]);

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-slate-800">Gestión de Cobros</h2>
        <p className="text-slate-500 text-sm">Listado de obligaciones pendientes para el periodo actual.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {pendingDebts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-4 font-semibold">Contribuyente</th>
                  <th className="px-6 py-4 font-semibold">Concepto / Deuda</th>
                  <th className="px-6 py-4 font-semibold text-center">Estado</th>
                  <th className="px-6 py-4 font-semibold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {pendingDebts.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{item.taxpayer.name}</div>
                      <div className="text-xs text-slate-500 font-mono">ID: {item.taxpayer.docId}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center">
                            {item.type === TaxType.VEHICULO && <Car size={16} className="text-blue-500 mr-2" />}
                            {item.type === TaxType.COMERCIO && <Store size={16} className="text-indigo-500 mr-2" />}
                            {item.type === TaxType.BASURA && <Trash2 size={16} className="text-emerald-500 mr-2" />}
                            <span className="text-slate-700 font-medium">{item.description}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                        {item.isOverdue ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <AlertCircle size={12} className="mr-1" /> Moroso
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                <Calendar size={12} className="mr-1" /> Por Vencer
                            </span>
                        )}
                        <div className="text-[10px] text-slate-400 mt-1">Vence: {item.dueDate}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <button 
                            onClick={() => onGoToPay(item.taxpayer)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center transition-all active:scale-95 shadow-sm"
                        >
                            Ir a Caja <ArrowRight size={14} className="ml-1" />
                        </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400">
              <div className="bg-emerald-50 p-4 rounded-full mb-4">
                <CheckCircle size={48} className="text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">¡Al día!</h3>
              <p className="max-w-md mt-2">No se encontraron deudas pendientes para el periodo actual según los criterios de facturación (Placas por mes/dígito, mensualidades comerciales y basura).</p>
          </div>
        )}
      </div>
    </div>
  );
};