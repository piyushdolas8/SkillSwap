import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Safely parses JSON from AI responses by stripping common markdown artifacts.
 */
export const safeJsonParse = (text: string) => {
  if (!text) return null;
  try {
    const cleaned = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn("Gemini JSON parse attempt failed. Raw output:", text.substring(0, 100));
    return null;
  }
};

export const generateSkillMatchExplanation = async (userSkills: string[], partnerSkills: string[]) => {
  const ai = getAI();
  const prompt = `User wants to learn: ${userSkills.join(', ')}. Partner can teach: ${partnerSkills.join(', ')}.
  Explain in 2 short sentences why this is a great skill exchange match for SkillSwap.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Perfect match for your learning journey!";
  } catch (error) {
    return "This looks like a great match for your current learning path.";
  }
};

export const generateLearningRoadmap = async (skills: string[]) => {
  const ai = getAI();
  const prompt = `Create a 4-step learning roadmap for someone wanting to master: ${skills.join(', ')}. 
  Return as a JSON array of objects with 'title' and 'description'. Keep descriptions under 20 words.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 500, // Prevent runaway token usage/truncation
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING }
            }
          }
        }
      }
    });
    
    const parsed = safeJsonParse(response.text || "[]");
    return parsed || [];
  } catch (error) {
    console.error("Roadmap Error:", error);
    return [];
  }
};

export const getCodeExplanation = async (code: string) => {
  const ai = getAI();
  const prompt = `Explain this code snippet briefly (max 2 sentences) as if you were a mentor: \n\n${code}`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "This snippet helps structure your logic efficiently.";
  } catch (error) {
    return "Keep up the great coding! This snippet looks solid.";
  }
};