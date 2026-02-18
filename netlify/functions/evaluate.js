export const handler = async (event) => {
  const TIMEOUT_MS = 8000;

  // Create a timeout promise to prevent function hanging
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("AI evaluation timed out after 8 seconds")), TIMEOUT_MS)
  );

  try {
    // Only allow POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Method Not Allowed" }),
      };
    }

    // Check for API Key
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "API_KEY is not configured on the server." }),
      };
    }

    // Parse input
    const body = JSON.parse(event.body || "{}");
    const { prompt } = body;

    if (!prompt) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Missing prompt data." }),
      };
    }

    // Dynamic import for the Gemini SDK inside the handler
    const { GoogleGenAI } = await import("@google/genai");

    // Define the AI processing task
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

    // Race the AI task against our hard timeout
    const result = await Promise.race([aiTask, timeoutPromise]);

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ success: true, output: result }),
    };

  } catch (err) {
    console.error("Evaluation Function Error:", err);
    return {
      statusCode: 200, // Return 200 with success:false to let frontend handle it gracefully
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({ 
        success: false, 
        error: err.message || "An unexpected error occurred during AI audit." 
      }),
    };
  }
};