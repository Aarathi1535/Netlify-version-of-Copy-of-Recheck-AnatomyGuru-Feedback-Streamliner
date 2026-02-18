import { GoogleGenAI } from "@google/genai";

export const handler = async (event: any) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API_KEY is not configured in environment variables." }),
      };
    }

    // Initialize the correct GoogleGenAI instance
    const ai = new GoogleGenAI({ apiKey });

    // Parse incoming request body
    const body = JSON.parse(event.body || "{}");
    const { sourceDoc, dirtyFeedbackDoc, mode } = body;

    const systemInstruction = `
      You are the "Anatomy Guru Master Evaluator". Create a medical audit report.
      SOURCE DOC: Question Paper, Answer Key, and Student Answers.
      MODE: ${mode}.
      ${mode === 'with-manual' ? 'Prioritize Answer Key for facts, Faculty Notes for marks. Flag factual contradictions.' : 'Evaluate ALL questions in QP against Key.'}
      
      OUTPUT: Return strictly valid JSON.
      JSON Structure:
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
      if (data.isDocx && data.text) return [{ text: `${label} (Text): ${data.text}` }];
      if (data.base64 && data.mimeType) return [{ inlineData: { data: data.base64, mimeType: data.mimeType } }];
      return [{ text: `${label}: Missing data.` }];
    };

    const parts = [...createPart(sourceDoc, "Source Document")];
    if (mode === 'with-manual') {
      parts.push(...createPart(dirtyFeedbackDoc, "Faculty Notes"));
    }
    parts.push({ text: "Generate the structured JSON evaluation report." });

    // Correct API call as per @google/genai guidelines
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    // Extract text using the .text property
    let jsonString = response.text || "{}";

    // Clean up markdown wrappers if they appear
    if (jsonString.trim().startsWith('```')) {
      jsonString = jsonString.trim().replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: jsonString,
    };
  } catch (err: any) {
    console.error("Netlify Function Error:", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message || "Internal server error" }),
    };
  }
};