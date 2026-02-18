export const handler = async (event) => {
  const TIMEOUT_MS = 15000; // Increased timeout for medical processing

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Medical Audit timed out after 15 seconds")), TIMEOUT_MS)
  );

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
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: "Method Not Allowed" }) };
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: "API_KEY missing on server." }) };
    }

    const body = JSON.parse(event.body || "{}");
    const { prompt } = body;

    if (!prompt) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: false, error: "No prompt data provided." }) };
    }

    const { GoogleGenAI } = await import("@google/genai");

    const aiTask = (async () => {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });
      return response.text;
    })();

    const result = await Promise.race([aiTask, timeoutPromise]);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, output: result }),
    };

  } catch (err) {
    console.error("Evaluation Function Error:", err);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: err.message || "An error occurred during AI processing." 
      }),
    };
  }
};