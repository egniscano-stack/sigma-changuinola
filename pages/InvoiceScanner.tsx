import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js'; // Local OCR V5+
import { Transaction, ExtractedInvoiceData, TaxType, PaymentMethod, TaxpayerType, TaxpayerStatus } from '../types';
import { Camera, Upload, CheckCircle, AlertTriangle, Loader2, FileText, X, Save } from 'lucide-react';
import { db } from '../services/db';

interface InvoiceScannerProps {
  onScanComplete?: (tx: Transaction) => void;
}

export const InvoiceScanner: React.FC<InvoiceScannerProps> = ({ onScanComplete }) => {
  const [image, setImage] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<ExtractedInvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State for editing
  // Form State for editing
  const [formData, setFormData] = useState({
    date: '',
    taxpayerName: '',
    docId: '',
    receiptNumber: '', // New
    paymentMethod: '', // New
    concept: '',
    amount: 0
  });

  useEffect(() => {
    if (data) {
      setFormData({
        date: data.date || '',
        taxpayerName: data.taxpayerName || '',
        docId: data.docId || '',
        receiptNumber: data.receiptNumber || '',
        paymentMethod: data.paymentMethod || 'EFECTIVO',
        concept: data.concept || '',
        amount: data.amount || 0
      });
    }
  }, [data]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // BLOCK HTML/PDF if Tesseract local
      if (file.type === 'application/pdf') {
        alert("El scanner local solo soporta IMÁGENES (JPG, PNG).\nPor favor convierta su PDF a imagen o tome una foto directa.");
        e.target.value = ''; // Reset input
        return;
      }

      setFileType(file.type);
      setFileName(file.name);

      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setData(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImage(null);
    setFileName('');
    setData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* --- HEURISTIC PARSERS (UPDATED FOR CHANGUINOLA) --- */
  const extractDataFromText = (text: string): ExtractedInvoiceData => {
    console.log("OCR Text:", text);
    const result: ExtractedInvoiceData = {
      date: '',
      amount: 0,
      taxpayerName: '',
      docId: '',
      taxpayerNumber: '',
      concept: '',
      confidence: 0.8
    };

    const lines = text.split('\n');

    // 1. DATE: Look for YYYY-MM-DD (Typical in this system e.g. 2026-01-18)
    const isoDateRegex = /(\d{4})-(\d{2})-(\d{2})/;
    const isoMatch = text.match(isoDateRegex);
    if (isoMatch) {
      result.date = isoMatch[0]; // 2026-01-18
    } else {
      // Fallback to DD-MM-YYYY
      const dateRegex = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/;
      const dateMatch = text.match(dateRegex);
      if (dateMatch) {
        let [_, d, m, y] = dateMatch;
        if (y.length === 2) y = `20${y}`;
        const pad = (n: string) => n.length === 1 ? `0${n}` : n;
        result.date = `${y}-${pad(m)}-${pad(d)}`;
      }
    }

    // 2. NAME: Look for 'RECIBIMOS DE:'
    // Method: Iterating lines to find the label, then taking the next part
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.match(/RECIBIMOS DE:/i)) {
        // Check if name is on SAME line
        const parts = line.split(/RECIBIMOS DE:/i);
        if (parts[1] && parts[1].trim().length > 2) {
          result.taxpayerName = parts[1].trim();
        } else if (lines[i + 1]) {
          // Next line
          result.taxpayerName = lines[i + 1].trim();
        }
        break;
      }
    }

    // 3. ID / RUC / TAXPAYER NUMBER
    // Changuinola format: ID: 1-789-456
    const idRegex = /(?:ID|RUC|CEDULA)[:.]?\s*([\d-]{5,20})/; // e.g. ID: 1-789-456
    const idMatch = text.match(idRegex);
    if (idMatch) result.docId = idMatch[1];

    // Look for "Contribuyente No" separately or assume it's same as ID if not found
    // If there is "Contribuyente:" pattern
    const taxNumRegex = /Contribuyente\s*(?:No\.?|N°)?[:.]?\s*(\w+)/i;
    const taxNumMatch = text.match(taxNumRegex);
    if (taxNumMatch) {
      result.taxpayerNumber = taxNumMatch[1];
    } else {
      result.taxpayerNumber = result.docId; // Fallback
    }

    // 4. AMOUNT: Look for 'TOTAL PAGADO B/.'
    // Pattern from image: "TOTAL PAGADO B/. 25.00" or just "B/. 25.00" combined with Total
    const totalRegex = /TOTAL\s*PAGADO\s*B\/\.?\s*([\d,]+\.?\d{2})/i;
    const totalMatch = text.match(totalRegex);
    if (totalMatch) {
      result.amount = parseFloat(totalMatch[1].replace(/,/g, ''));
    } else {
      // Fallback: Find any large number preceded by B/.
      const moneyMatches = [...text.matchAll(/B\/\.?\s*([\d,]+\.?\d{2})/g)];
      if (moneyMatches.length > 0) {
        // Usually the last one or the largest one is the total. Let's take the last one.
        const amt = parseFloat(moneyMatches[moneyMatches.length - 1][1].replace(/,/g, ''));
        result.amount = amt;
      }
    }

    // 5. CONCEPT: Look for 'CONCEPTO' header and what's below it
    // Or specific row detection
    const conceptIndex = lines.findIndex(l => l.match(/CONCEPTO/i));
    if (conceptIndex !== -1 && lines[conceptIndex + 1]) {
      // Usually content is below header
      let possibleConcept = lines[conceptIndex + 1];
      // Clean overlapping "Valor" or prices
      possibleConcept = possibleConcept.replace(/B\/\.?\s*[\d,.]+/g, '').trim();
      result.concept = possibleConcept;
    } else {
      // Fallback Heuristics
      const lower = text.toLowerCase();
      if (lower.includes('placa')) result.concept = 'Impuesto de Circulación Vehicular';
      else if (lower.includes('basura')) result.concept = 'Tasa de Aseo';
      else if (lower.includes('const') || lower.includes('obra') || lower.includes('permiso')) result.concept = 'Permiso de Construcción';
      else result.concept = 'Pago General (Detectado)';
    }

    // 6. RECEIPT NUMBER (#TX-...)
    // Pattern: #TX-17687...
    const rxRegex = /#TX-\d+/;
    const rxMatch = text.match(rxRegex);
    if (rxMatch) result.receiptNumber = rxMatch[0];

    // 7. PAYMENT METHOD
    // Pattern: Método: EFECTIVO
    const methodRegex = /M(?:e|é)todo:\s*(\w+)/i;
    const methodMatch = text.match(methodRegex);
    if (methodMatch) result.paymentMethod = methodMatch[1].toUpperCase();

    return result;
  };

  const handleAnalyze = async () => {
    if (!image) return;

    setLoading(true);
    setError(null);
    setData(null);

    let worker: any = null;

    try {
      console.log("Initializing Worker...");
      // Initialize Worker for English (faster, good for numbers)
      worker = await createWorker('eng');

      console.log("Worker Ready. Recognizing...");
      const ret = await worker.recognize(image);
      console.log("OCR Result:", ret);

      const extracted = extractDataFromText(ret.data.text);
      setData(extracted);

      await worker.terminate();

    } catch (err: any) {
      console.error("OCR Error Details:", err);
      // Construct a helpful message
      let msg = err.message || JSON.stringify(err);
      if (!msg || msg === '{}') msg = "Incompatible con el navegador o falta Worker";

      setError(`Fallo OCR: ${msg}. Intente recargar la página.`);

      if (worker) {
        try { await worker.terminate(); } catch (e) { }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // 1. Check if Taxpayer exists
      const taxpayers = await db.getTaxpayers();
      let taxpayer = taxpayers.find(t => t.docId === formData.docId || t.taxpayerNumber === formData.docId);

      // 2. If not, create minimal taxpayer
      if (!taxpayer) {
        const newTaxpayer = {
          id: '', // Generated by DB
          taxpayerNumber: formData.taxpayerNumber || `AUTO-${Math.floor(Math.random() * 99999)}`,
          type: formData.docId.includes('-') ? TaxpayerType.NATURAL : TaxpayerType.JURIDICA,
          status: TaxpayerStatus.ACTIVO,
          docId: formData.docId || `UNKNOWN-${Date.now()}`,
          name: formData.taxpayerName || 'Contribuyente Desconocido',
          address: 'Dirección no registrada (Importado IA)',
          phone: '',
          email: '',
          hasCommercialActivity: false,
          hasConstruction: false,
          hasGarbageService: false,
          createdAt: new Date().toISOString()
        };
        try {
          taxpayer = await db.createTaxpayer(newTaxpayer);
        } catch (e) {
          throw new Error("Error al registrar el contribuyente nuevo. Verifique que el ID no exista ya.");
        }
      }

      // 3. Create Transaction
      // Guess TaxType from concept
      let taxType = TaxType.COMERCIO; // Default
      const conceptLower = formData.concept.toLowerCase();
      if (conceptLower.includes('placa') || conceptLower.includes('vehic')) taxType = TaxType.VEHICULO;
      if (conceptLower.includes('basura') || conceptLower.includes('aseo')) taxType = TaxType.BASURA;
      if (conceptLower.includes('cons') || conceptLower.includes('obra')) taxType = TaxType.CONSTRUCCION;

      const newTx = await db.createTransaction({
        id: `HIST-${Date.now()}`,
        taxpayerId: taxpayer!.id,
        taxType: taxType,
        amount: formData.amount,
        date: formData.date || new Date().toISOString().split('T')[0],
        time: '12:00',
        description: `IMPORTADO IA: ${formData.concept}`,
        status: 'PAGADO',
        paymentMethod: PaymentMethod.EFECTIVO, // Assumption for historical
        tellerName: 'SISTEMA IA',
        metadata: { originalFileName: fileName }
      });

      if (onScanComplete) {
        onScanComplete(newTx);
      }

      alert("¡Documento guardado y digitalizado correctamente!");
      handleClear({ stopPropagation: () => { } } as any);

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Error al guardar en la base de datos");
    } finally {
      setSaving(false);
    }
  };

  const triggerInput = () => fileInputRef.current?.click();

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
          <Camera className="mr-2 text-indigo-600" />
          Digitalizador Local (OCR)
        </h2>
        <p className="text-slate-500 mt-2">
          Sistema de reconocimiento óptico local (Tesseract). No requiere internet ni claves, pero puede requerir corrección manual.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-4">
          <div
            onClick={triggerInput}
            className={`relative border-2 border-dashed rounded-xl h-80 flex flex-col items-center justify-center cursor-pointer transition-colors ${image ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
          >
            {image ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                {fileType === 'application/pdf' ? (
                  <div className="text-center">
                    <FileText size={64} className="mx-auto text-red-500 mb-2" />
                    <p className="font-bold text-slate-700">{fileName}</p>
                    <p className="text-xs text-slate-500">Documento PDF listo para procesar</p>
                  </div>
                ) : (
                  <img src={image} alt="Preview" className="h-full w-full object-contain rounded-lg shadow-sm" />
                )}
                <button
                  onClick={handleClear}
                  className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md hover:bg-red-50 text-slate-500 hover:text-red-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            ) : (
              <div className="text-center p-6">
                <Upload size={48} className="mx-auto text-slate-400 mb-4" />
                <p className="text-slate-600 font-medium">Click para subir factura</p>
                <p className="text-xs text-slate-400 mt-2">Soporta JPG, PNG (No PDF)</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!image || loading}
            className={`w-full py-3 rounded-lg font-bold flex items-center justify-center text-white transition-all ${loading || !image
              ? 'bg-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
              }`}
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Camera className="mr-2" />}
            {loading ? 'Analizando Documento...' : 'Analizar Documento'}
          </button>
        </div>

        {/* Results Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Datos Extraídos</h3>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-start mb-4">
              <AlertTriangle className="mr-2 flex-shrink-0" size={20} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {!data && !loading && !error && (
            <div className="text-center py-12 text-slate-400">
              <p>Sube una imagen y presiona "Analizar" para ver los resultados.</p>
            </div>
          )}

          {loading && (
            <div className="space-y-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2"></div>
              <div className="h-10 bg-slate-200 rounded w-full"></div>
            </div>
          )}

          {data && (
            <form className="space-y-4">

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Fecha</label>
                  <input
                    type="text"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded text-black font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Recibo de Caja #</label>
                  <input
                    type="text"
                    value={formData.receiptNumber}
                    onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded text-black font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Recibimos de</label>
                <input
                  type="text"
                  value={formData.taxpayerName}
                  onChange={(e) => setFormData({ ...formData, taxpayerName: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-300 rounded text-black font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">ID (Cédula/RUC)</label>
                <input
                  type="text"
                  value={formData.docId}
                  onChange={(e) => setFormData({ ...formData, docId: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-300 rounded text-black font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Concepto</label>
                <input
                  type="text"
                  value={formData.concept}
                  onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-300 rounded text-black font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Monto Total (B/.)</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                    className="w-full mt-1 p-2 border border-emerald-300 bg-emerald-50 rounded font-bold text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase">Método de Pago</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full mt-1 p-2 border border-slate-300 rounded text-black font-medium"
                  >
                    <option value="EFECTIVO">EFECTIVO</option>
                    <option value="ACH">ACH</option>
                    <option value="CHEQUE">CHEQUE</option>
                    <option value="TARJETA">TARJETA</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex-1 bg-white border border-slate-300 text-slate-600 py-2 rounded-lg hover:bg-slate-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-200"
                >
                  {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={18} />}
                  {saving ? 'Guardando...' : 'Guardar en Base de Datos'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};