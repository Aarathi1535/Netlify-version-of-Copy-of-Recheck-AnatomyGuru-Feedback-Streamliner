import { GoogleGenAI } from "@google/genai";

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
      throw new Error("API_KEY environment variable is not set.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const { prompt } = JSON.parse(event.body || "{}");

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, output: response.text }),
    };
  } catch (err: any) {
    console.error("Gemini Endpoint Error:", err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};