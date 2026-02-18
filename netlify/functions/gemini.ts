import { GoogleGenAI, Type } from "@google/genai";

export const handler = async (event: any) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "API_KEY is not configured on Netlify." }) 
      };
    }

    const { sourceDoc, dirtyFeedbackDoc, mode } = JSON.parse(event.body);
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
      You are the "Anatomy Guru Master Evaluator". Create a medical audit report.
      SOURCE DOC: Question Paper, Answer Key, and Student Answers.
      MODE: ${mode}.
      ${mode === 'with-manual' ? 'Prioritize Answer Key for facts, Faculty Notes for marks. Flag factual contradictions.' : 'Evaluate ALL questions in QP against Key.'}
      OUTPUT: Valid JSON only. Include exhaustive "questions" array.
    `;

    const createPart = (data: any, label: string) => {
      if (!data) return [{ text: `${label}: Not provided.` }];
      if (data.isDocx && data.text) return [{ text: `${label}: ${data.text}` }];
      if (data.base64 && data.mimeType) return [{ inlineData: { data: data.base64, mimeType: data.mimeType } }];
      return [{ text: `${label}: Unavailable.` }];
    };

    const parts = [...createPart(sourceDoc, "Source Document")];
    if (mode === 'with-manual') parts.push(...createPart(dirtyFeedbackDoc, "Faculty Notes"));
    parts.push({ text: "Generate the JSON evaluation report." });

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts }],
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
              }
            }
          },
          required: ["studentName", "testTitle", "questions"]
        }
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: result.text
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal error" })
    };
  }
};
