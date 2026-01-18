import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedInvoiceData } from "../types";

// Initialize the API client
// Note: In a real production app, this call would likely go through a backend proxy 
// to secure the API key, but for this frontend demo, we use the env var directly.
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

const MODEL_NAME = 'gemini-3-flash-preview';

export const analyzeInvoiceImage = async (base64Data: string, originalMimeType: string = 'image/jpeg'): Promise<ExtractedInvoiceData> => {
  try {
    // Schema for structured JSON output
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: "Fecha de la factura en formato YYYY-MM-DD" },
        amount: { type: Type.NUMBER, description: "Monto total de la factura" },
        taxpayerName: { type: Type.STRING, description: "Nombre del contribuyente o empresa" },
        docId: { type: Type.STRING, description: "RUC o Cédula encontrada" },
        concept: { type: Type.STRING, description: "Descripción breve del pago (Placa, Basura, etc)" },
        confidence: { type: Type.NUMBER, description: "Nivel de confianza de 0 a 1" },
      },
      required: ["amount", "confidence"],
    };

    const prompt = `
      Actúa como un auditor experto del Municipio de Changuinola. 
      Analiza este documento (factura o recibo antiguo). 
      Extrae la información clave. 
      Si el documento no parece una factura, devuelve un nivel de confianza bajo.
      Intenta inferir la fecha si está borrosa.
    `;

    // Remove header if present to get pure base64. 
    // Adapting regex to support different image types and pdf application/pdf
    const cleanBase64 = base64Data.replace(/^data:(image\/(png|jpeg|jpg|webp)|application\/pdf);base64,/, "");

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: originalMimeType,
              data: cleanBase64
            }
          },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1, // Low temperature for factual extraction
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text generated");

    const data = JSON.parse(text) as ExtractedInvoiceData;
    return data;

  } catch (error) {
    console.error("Error analyzing invoice:", error);
    throw new Error("Error al procesar la imagen con IA.");
  }
};