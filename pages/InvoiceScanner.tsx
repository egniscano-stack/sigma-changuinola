import React, { useState, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js'; // Local OCR
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
  const [formData, setFormData] = useState({
    date: '',
    taxpayerName: '',
    docId: '',
    concept: '',
    amount: 0
  });

  useEffect(() => {
    if (data) {
      setFormData({
        date: data.date || '',
        taxpayerName: data.taxpayerName || '',
        docId: data.docId || '',
        concept: data.concept || '',
        amount: data.amount || 0
      });
    }
  }, [data]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
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

  // --- HEURISTIC PARSERS ---
  const extractDataFromText = (text: string): ExtractedInvoiceData => {
    console.log("OCR Text:", text);
    const result: ExtractedInvoiceData = {
      date: '',
      amount: 0,
      taxpayerName: '',
      docId: '',
      concept: '',
      confidence: 0.8
    };

    const lines = text.split('\n');

    // 1. Find Amount (Look for Total, B/., $)
    // Matches: B/. 123.45, $123.45, 123.45
    const amountRegex = /(?:Total|Pagar|Monto|Importe).{0,15}(?:B\/\.?\s*|\$\s*)?([\d,]+\.?\d{2})/i;
    const moneyRegex = /(?:B\/\.?\s*|\$\s*)([\d,]+\.?\d{2})/;

    for (const line of lines) {
      let match = line.match(amountRegex);
      if (!match) match = line.match(moneyRegex);

      if (match) {
        // Clean number (remove commas)
        let numStr = match[1].replace(/,/g, '');
        const num = parseFloat(numStr);
        if (!isNaN(num) && num > result.amount) {
          result.amount = num; // Assume largest amount found is Total
        }
      }
    }

    // 2. Find Date (DD/MM/YYYY or YYYY-MM-DD)
    const dateRegex = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
      // Normalize to YYYY-MM-DD
      let [_, d, m, y] = dateMatch;
      if (y.length === 2) y = `20${y}`;
      // Pad
      const pad = (n: string) => n.length === 1 ? `0${n}` : n;
      result.date = `${y}-${pad(m)}-${pad(d)}`;
    }

    // 3. Find RUC/CIP
    // RUC format often: 123-123-123 or 8-NT-123
    const rucRegex = /\b(\d{1,4}-[A-Z\d]+-\d+(?:-\d+)?)\b/i;
    const rucMatch = text.match(rucRegex);
    if (rucMatch) {
      result.docId = rucMatch[1];
    } else {
      // Try strict CIP
      const cipRegex = /\b(\d{1,2}-\d{1,4}-\d{1,5})\b/;
      const cipMatch = text.match(cipRegex);
      if (cipMatch) result.docId = cipMatch[1];
    }

    // 4. Concept (Simple heuristics based on keywords)
    const lowerText = text.toLowerCase();
    if (lowerText.includes('placa') || lowerText.includes('vehic')) result.concept = 'Impuesto de Circulación (Placa)';
    else if (lowerText.includes('basura') || lowerText.includes('aseo') || lowerText.includes('recolec')) result.concept = 'Tasa de Aseo';
    else if (lowerText.includes('const') || lowerText.includes('obra') || lowerText.includes('permiso')) result.concept = 'Permiso de Construcción';
    else result.concept = 'Pago General (Detectado)';

    return result;
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      // Use Tesseract.js directly
      const result = await Tesseract.recognize(
        image,
        'eng', // English checks seem to work ok for numbers, 'spa' is better but requires download. 
        // I'll stick to 'eng' default or 'spa' if user environment allows. 
        // For safety in offline/restricted envs, we start with minimal. 
        // Actually, let's try 'spa' if possible, but 'eng' is safer for chars.
        {
          logger: m => console.log(m)
        }
      );

      const extracted = extractDataFromText(result.data.text);
      setData(extracted);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al procesar la imagen con OCR local.');
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
          taxpayerNumber: `AUTO-${Math.floor(Math.random() * 99999)}`,
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
                <p className="text-xs text-slate-400 mt-2">Soporta JPG, PNG, PDF</p>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,application/pdf"
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
              <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-4">
                <span className="text-sm font-medium text-indigo-800">Confianza del Análisis</span>
                <span className="text-lg font-bold text-indigo-600">{(data.confidence * 100).toFixed(0)}%</span>
              </div>

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
                <label className="block text-xs font-bold text-slate-500 uppercase">Contribuyente</label>
                <input
                  type="text"
                  value={formData.taxpayerName}
                  onChange={(e) => setFormData({ ...formData, taxpayerName: e.target.value })}
                  className="w-full mt-1 p-2 border border-slate-300 rounded text-black font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Documento ID (RUC/Cédula)</label>
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

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Monto Total (B/.)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                  className="w-full mt-1 p-2 border border-emerald-300 bg-emerald-50 rounded font-bold text-emerald-800"
                />
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