import { GoogleGenAI } from "@google/genai";

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Method Not Allowed" }),
      };
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "GEMINI_API_KEY (API_KEY) is not configured in the environment." }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { prompt } = body;

    if (!prompt) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Missing 'prompt' in request body." }),
      };
    }

    // Initialize Gemini inside the handler as requested
    const ai = new GoogleGenAI({ apiKey });

    // 8-second hard timeout promise
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI evaluation timed out after 8 seconds")), 8000)
    );

    // AI Generation promise
    const generationPromise = (async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      return response.text;
    })();

    // Race the generation against the timeout
    const output = await Promise.race([generationPromise, timeoutPromise]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, output }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err.message || "Internal Server Error" }),
    };
  }
};