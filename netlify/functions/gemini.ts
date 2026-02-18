import { GoogleGenAI } from "@google/genai";

export const handler = async (event: any) => {
  // CORS Handling (optional but good for debugging)
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

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("Missing API_KEY on Netlify environment");
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "API_KEY environment variable is not configured." }) 
      };
    }

    const { sourceDoc, dirtyFeedbackDoc, mode } = JSON.parse(event.body);
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
      You are the "Anatomy Guru Master Evaluator", a clinical audit professional.
      Your task is to convert raw medical student answer sheets and faculty notes into a professional, structured evaluation report.
      
      DOCUMENTS PROVIDED:
      1. SOURCE DOC: The student's answer sheet (often contains the Question Paper and official Answer Key).
      2. FACULTY NOTES: Handwritten/rough evaluator remarks and marks (provided only in 'with-manual' mode).

      EVALUATION LOGIC:
      - MODE: ${mode}.
      - If 'with-manual': Combine Faculty Notes with official Answer Key. If there is a contradiction in facts, prioritize the Answer Key. If there is a contradiction in marks, prioritize Faculty Notes but flag it.
      - If 'without-manual': Evaluate the student's answers strictly against the official Answer Key provided in the source doc.
      
      OUTPUT FORMAT:
      Return ONLY a valid JSON object. DO NOT include markdown code blocks (e.g., \`\`\`json).
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
            "feedbackPoints": string[] (Professional, bullet-point style feedback),
            "marks": number,
            "maxMarks": number,
            "isCorrect": boolean,
            "isFlagged": boolean (true if Key and Notes contradicted)
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
      if (data.isDocx && data.text) return [{ text: `${label} (Text Data): ${data.text}` }];
      if (data.base64 && data.mimeType) return [{ inlineData: { data: data.base64, mimeType: data.mimeType } }];
      return [{ text: `${label}: Data missing or unreadable.` }];
    };

    const parts = [...createPart(sourceDoc, "Source Document")];
    if (mode === 'with-manual') {
      parts.push(...createPart(dirtyFeedbackDoc, "Faculty Notes"));
    }
    parts.push({ text: "Please analyze the provided medical evaluation documents and generate the structured JSON report." });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-lite-latest",
      contents: [{ parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      }
    });

    let jsonString = response.text.trim();
    
    // Safety check for accidental markdown wrappers
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
    }

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
      body: jsonString
    };
  } catch (error: any) {
    console.error("Function execution failed:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ 
        error: "AI Processing Error", 
        details: error.message || "Unknown error occurred on server." 
      })
    };
  }
};