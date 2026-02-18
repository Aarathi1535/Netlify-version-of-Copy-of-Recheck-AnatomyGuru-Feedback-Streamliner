import { GoogleGenAI } from "@google/genai";

export const handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("Server configuration error: API_KEY is missing.");
    }

    const { prompt } = JSON.parse(event.body || "{}");
    if (!prompt) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: "No prompt provided." }) };
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1, // Keep medical audits consistent
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, output: response.text }),
    };
  } catch (err) {
    console.error("Audit Function Error:", err);
    return {
      statusCode: 200, // Return 200 with error payload for cleaner frontend handling
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};