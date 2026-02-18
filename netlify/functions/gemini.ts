import { GoogleGenAI } from "@google/genai";

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
      
      OUTPUT: You MUST return strictly valid JSON. DO NOT include markdown formatting like \`\`\`json.
      
      The JSON structure MUST be:
      {
        "studentName": string,
        "testTitle": string,
        "testTopics": string,
        "testDate": string,
        "totalScore": number,
        "maxScore": number,
        "questions": [
          {
            "qNo": string,
            "feedbackPoints": string[],
            "marks": number,
            "maxMarks": number,
            "isCorrect": boolean,
            "isFlagged": boolean
          }
        ],
        "generalFeedback": {
          "overallPerformance": string[],
          "mcqs": string[],
          "contentAccuracy": string[],
          "completenessOfAnswers": string[],
          "presentationDiagrams": string[],
          "investigations": string[],
          "attemptingQuestions": string[],
          "actionPoints": string[]
        }
      }
    `;

    const createPart = (data: any, label: string) => {
      if (!data) return [{ text: `${label}: Not provided.` }];
      if (data.isDocx && data.text) return [{ text: `${label}: ${data.text}` }];
      if (data.base64 && data.mimeType) return [{ inlineData: { data: data.base64, mimeType: data.mimeType } }];
      return [{ text: `${label}: Unavailable.` }];
    };

    const parts = [...createPart(sourceDoc, "Source Document")];
    if (mode === 'with-manual') parts.push(...createPart(dirtyFeedbackDoc, "Faculty Notes"));
    parts.push({ text: "Based on the provided documents, generate the comprehensive evaluation report JSON." });

    const result = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      }
    });

    // Strip markdown code blocks if the model accidentally includes them despite instructions
    let jsonString = result.text.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: jsonString
    };
  } catch (error: any) {
    console.error("Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal error during AI processing" })
    };
  }
};