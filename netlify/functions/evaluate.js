import { GoogleGenAI } from "@google/genai";

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY environment variable is not configured.");

    const body = JSON.parse(event.body || "{}");
    const { prompt } = body;
    
    if (!prompt) throw new Error("Prompt is missing in the request body.");

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    if (!response || !response.text) {
      throw new Error("Gemini AI returned an empty response.");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, output: response.text }),
    };
  } catch (err) {
    console.error("Evaluation Function Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: err.message || "An internal error occurred while processing the medical audit." 
      }),
    };
  }
};