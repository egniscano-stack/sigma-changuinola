import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ExtractedInvoiceData } from "../types";

// Initialize the API client using the stable Web SDK
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// List of models to try in order of preference (Fastest/Cheapest -> Most Capable -> Legacy)
const MODEL_FALLBACKS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-002',
  'gemini-1.5-flash-001',
  'gemini-1.5-pro',
  'gemini-1.5-pro-002'
];

export const analyzeInvoiceImage = async (base64Data: string, originalMimeType: string = 'image/jpeg'): Promise<ExtractedInvoiceData> => {
  let lastError: any = null;

  // Prompt Definition
  const prompt = `
      Actúa como un auditor experto del Municipio de Changuinola. 
      Analiza este documento (factura o recibo antiguo). 
      Extrae la información clave. 
      Si el documento no parece una factura, devuelve un nivel de confianza bajo.
      Intenta inferir la fecha (YYYY-MM-DD) si está borrosa.
    `;

  // Prepare Image Part
  const cleanBase64 = base64Data.replace(/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,/, "");
  const imagePart = {
    inlineData: {
      data: cleanBase64,
      mimeType: originalMimeType
    }
  };

  // Iterate through models until one succeeds
  for (const modelName of MODEL_FALLBACKS) {
    try {
      // console.log(`Attempting analysis with model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: SchemaType.OBJECT,
            properties: {
              date: { type: SchemaType.STRING, description: "Fecha de la factura en formato YYYY-MM-DD" },
              amount: { type: SchemaType.NUMBER, description: "Monto total de la factura" },
              taxpayerName: { type: SchemaType.STRING, description: "Nombre del contribuyente o empresa" },
              docId: { type: SchemaType.STRING, description: "RUC o Cédula encontrada" },
              concept: { type: SchemaType.STRING, description: "Descripción breve del pago (Placa, Basura, etc)" },
              confidence: { type: SchemaType.NUMBER, description: "Nivel de confianza de 0 a 1" },
            },
            required: ["amount", "confidence", "date"],
          },
        },
      });

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      if (!text) throw new Error("No response text generated");

      const data = JSON.parse(text) as ExtractedInvoiceData;
      return data; // Success! Return immediately.

    } catch (error: any) {
      console.warn(`Model ${modelName} failed:`, error.message);
      lastError = error;

      // If safety settings blocked it, moving to another model might not help, but we continue anyway just in case.
      // If 404 (not found), definitely try next.
    }
  }

  // If we get here, all models must have failed
  console.error("All Gemini models failed. Last error:", lastError);
  throw new Error(lastError?.message || "Error al procesar la imagen con IA (Todos los modelos fallaron).");
};