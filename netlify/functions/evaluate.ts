
import { GoogleGenAI, Type } from "@google/genai";

export const handler = async (event: any) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { sourceDoc, dirtyFeedbackDoc, mode } = JSON.parse(event.body);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const baseInstruction = `
      You are the "Anatomy Guru Master Evaluator", a professional medical academic auditor. 
      Your task is to generate a high-quality, clinical-grade evaluation report for medical students.
      
      THE SOURCE DOCUMENT (Student Answer Sheet) contains:
      1. The Question Paper (QP) with marking schemes.
      2. The Official Answer Key (The Absolute Truth).
      3. The Student's actual answers.
    `;

    const manualFeedbackContext = mode === 'with-manual' 
      ? `
        FACULTY NOTES (Manual Feedback): This document contains manual marks and shorthand notes.
        STRICT HIERARCHY OF TRUTH:
        1. OFFICIAL ANSWER KEY: Absolute truth for medical facts.
        2. FACULTY NOTES: Authority for MARKS assigned, but secondary to Key for facts.
        CONTRADICTION PROTOCOL: If Faculty Notes contradict Key, use Key and set "isFlagged": true.
      `
      : `
        EVALUATION MODE: AUTOMATED AUDIT (No Faculty Notes).
        STRICT COMPREHENSIVE PROTOCOL: Evaluate EVERY question. Provide feedback for both correct and incorrect answers against the Official Answer Key.
      `;

    const systemInstruction = `
      ${baseInstruction}
      ${manualFeedbackContext}
      OUTPUT: Valid JSON only. "questions" array MUST be exhaustive. 
    `;

    const createPart = (data: any, label: string) => {
      if (!data) return [{ text: `${label}: Not provided.` }];
      if (data.isDocx && data.text) {
        return [{ text: `${label}: (Extracted Text)\n${data.text}` }];
      } else if (data.base64 && data.mimeType) {
        return [
          { text: `${label}: (Binary File)` },
          { inlineData: { data: data.base64, mimeType: data.mimeType } }
        ];
      }
      return [{ text: `${label}: No data.` }];
    };

    const contentsParts = [...createPart(sourceDoc, "Source Document")];
    if (mode === 'with-manual' && dirtyFeedbackDoc) {
      contentsParts.push(...createPart(dirtyFeedbackDoc, "Faculty Notes"));
    }
    contentsParts.push({ text: "Generate the comprehensive medical evaluation report." });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: contentsParts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            studentName: { type: Type.STRING },
            testTitle: { type: Type.STRING },
            testTopics: { type: Type.STRING },
            testDate: { type: Type.STRING },
            totalScore: { type: Type.NUMBER },
            maxScore: { type: Type.NUMBER },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  qNo: { type: Type.STRING },
                  feedbackPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                  marks: { type: Type.NUMBER },
                  maxMarks: { type: Type.NUMBER },
                  isCorrect: { type: Type.BOOLEAN },
                  isFlagged: { type: Type.BOOLEAN }
                },
                required: ["qNo", "feedbackPoints", "marks", "maxMarks", "isCorrect"]
              }
            },
            generalFeedback: {
              type: Type.OBJECT,
              properties: {
                overallPerformance: { type: Type.ARRAY, items: { type: Type.STRING } },
                mcqs: { type: Type.ARRAY, items: { type: Type.STRING } },
                contentAccuracy: { type: Type.ARRAY, items: { type: Type.STRING } },
                completenessOfAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
                presentationDiagrams: { type: Type.ARRAY, items: { type: Type.STRING } },
                investigations: { type: Type.ARRAY, items: { type: Type.STRING } },
                attemptingQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                actionPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["overallPerformance", "mcqs", "contentAccuracy", "completenessOfAnswers", "presentationDiagrams", "investigations", "attemptingQuestions", "actionPoints"]
            }
          },
          required: ["studentName", "testTitle", "testTopics", "testDate", "totalScore", "maxScore", "questions", "generalFeedback"]
        }
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: response.text
    };
  } catch (error: any) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};
