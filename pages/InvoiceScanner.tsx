import React, { useState, useRef } from 'react';
import { analyzeInvoiceImage } from '../services/geminiService';
import { ExtractedInvoiceData } from '../types';
import { Camera, Upload, CheckCircle, AlertTriangle, Loader2, FileText, X } from 'lucide-react';

export const InvoiceScanner: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExtractedInvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeInvoiceImage(image, fileType);
      setData(result);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con la IA');
    } finally {
      setLoading(false);
    }
  };

  const triggerInput = () => fileInputRef.current?.click();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center">
          <Camera className="mr-2 text-indigo-600" />
          Digitalizador de Facturas Antiguas (IA)
        </h2>
        <p className="text-slate-500 mt-2">
          Utiliza Inteligencia Artificial para extraer datos de recibos físicos o PDFs y registrarlos en la base de datos histórica.
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
                <input type="text" defaultValue={data.date} className="w-full mt-1 p-2 border border-slate-300 rounded text-black" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Contribuyente</label>
                <input type="text" defaultValue={data.taxpayerName} className="w-full mt-1 p-2 border border-slate-300 rounded text-black" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Documento ID</label>
                <input type="text" defaultValue={data.docId} className="w-full mt-1 p-2 border border-slate-300 rounded text-black" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Concepto</label>
                <input type="text" defaultValue={data.concept} className="w-full mt-1 p-2 border border-slate-300 rounded text-black" />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Monto Total (B/.)</label>
                <input type="number" defaultValue={data.amount} className="w-full mt-1 p-2 border border-emerald-300 bg-emerald-50 rounded font-bold text-emerald-800" />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" className="flex-1 bg-white border border-slate-300 text-slate-600 py-2 rounded-lg hover:bg-slate-50">
                  Descartar
                </button>
                <button type="button" className="flex-1 bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 flex items-center justify-center">
                  <CheckCircle size={18} className="mr-2" />
                  Confirmar y Guardar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};