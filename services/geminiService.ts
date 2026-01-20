import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ExtractedInvoiceData } from "../types";

// Initialize the API client using the stable Web SDK
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// List of models to try in order of preference
const MODEL_FALLBACKS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash-exp', // Latest experimental
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
  'gemini-pro-vision', // Legacy 1.0 (fall back if 1.5 fails)
  'gemini-1.0-pro-vision-latest'
];

export const analyzeInvoiceImage = async (base64Data: string, originalMimeType: string = 'image/jpeg'): Promise<ExtractedInvoiceData> => {
  let lastError: any = null;
  const errors: string[] = [];

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
      console.log(`Attempting analysis with model: ${modelName}`);

      const generationConfig: any = {
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
      };

      // Legacy models like gemini-pro-vision do not support responseSchema or responseMimeType in the same way,
      // or at all. We should adapt the config if we fallback to legacy models.
      if (modelName.includes('vision') || modelName.includes('gemini-1.0')) {
        delete generationConfig.responseMimeType;
        delete generationConfig.responseSchema;
      }

      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: generationConfig
      });

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      let text = response.text();

      if (!text) throw new Error("No response text generated");

      // For legacy models, we might need to manually parse JSON if they return Markdown block
      if (text.includes("```json")) {
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
      } else if (text.includes("JSON:")) {
        text = text.substring(text.indexOf('{'));
      }

      console.log(`Success with model: ${modelName}`);
      const data = JSON.parse(text) as ExtractedInvoiceData;
      return data; // Success! Return immediately.

    } catch (error: any) {
      console.warn(`Model ${modelName} failed:`, error.message);
      errors.push(`${modelName}: ${error.message}`);
      lastError = error;
    }
  }

  // If we get here, all models must have failed
  console.error("All Gemini models failed. Errors:", errors);
  throw new Error(`Error con IA: Ningún modelo disponible. Detalle: ${errors.join(' | ')}`);
};