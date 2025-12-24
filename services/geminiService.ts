
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const suggestQuestions = async (topic: string) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Berikan 3 saran pertanyaan survei untuk topik "${topic}" bagi siswa. Satu pertanyaan harus berupa rating (skala 1-5) dan dua lainnya teks terbuka. Berikan dalam JSON array object dengan field "text" dan "type" ('text' atau 'rating').`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            type: { type: Type.STRING, description: "Hanya 'text' atau 'rating'" }
          }
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    return [];
  }
};

export const analyzeSentiment = async (submissions: any[]) => {
  if (submissions.length === 0) return "Belum ada data untuk dianalisis.";
  
  const dataForAi = submissions.map(s => `[Kelas: ${s.className}] ${JSON.stringify(s.answers)}`).join("\n");
  
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Lakukan analisis mendalam pada data jawaban siswa ini.
    1. Berikan skor rata-rata untuk pertanyaan bertipe rating.
    2. Identifikasi 3 masalah utama yang paling sering muncul di jawaban teks.
    3. Berikan rekomendasi kebijakan sekolah yang konkret.
    
    Data:\n${dataForAi}`,
    config: {
        systemInstruction: "Anda adalah analis data pendidikan profesional. Berikan output dalam Bahasa Indonesia yang sangat terstruktur dengan poin-poin yang tajam.",
        thinkingConfig: { thinkingBudget: 0 }
    }
  });

  return response.text || "Analisis gagal.";
};
