export const handler = async (event: any) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "API_KEY not configured." }),
      };
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const body = JSON.parse(event.body || "{}");
    const { sourceDoc, dirtyFeedbackDoc, mode } = body;

    const systemInstruction = `
      You are the "Anatomy Guru Master Evaluator". Create a medical audit report.
      SOURCE DOC: Question Paper, Answer Key, and Student Answers.
      MODE: ${mode}.
      ${mode === 'with-manual' ? 'Prioritize Answer Key for facts, Faculty Notes for marks. Flag factual contradictions.' : 'Evaluate ALL questions in QP against Key.'}
      
      OUTPUT: Return strictly valid JSON.
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

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts }],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    return {
      statusCode: 200,
      headers,
      body: response.text || "{}",
    };
  } catch (err: any) {
    console.error("Netlify Function Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || "Internal server error" }),
    };
  }
};