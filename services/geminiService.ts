import { EvaluationReport, FileData } from "../types";

export type EvaluationMode = 'with-manual' | 'without-manual';

export const generateStructuredFeedback = async (
  sourceDoc: FileData,
  dirtyFeedbackDoc: FileData | null,
  mode: EvaluationMode = 'with-manual'
): Promise<EvaluationReport> => {
  try {
    const systemInstructions = `
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

    const promptParts: any[] = [{ text: systemInstructions }];

    // Add source document
    if (sourceDoc.text) {
      promptParts.push({ text: `Student Paper Text: ${sourceDoc.text}` });
    } else if (sourceDoc.base64 && sourceDoc.mimeType) {
      promptParts.push({ inlineData: { data: sourceDoc.base64, mimeType: sourceDoc.mimeType } });
    }

    // Add faculty notes
    if (mode === 'with-manual' && dirtyFeedbackDoc) {
      if (dirtyFeedbackDoc.text) {
        promptParts.push({ text: `Faculty Notes Text: ${dirtyFeedbackDoc.text}` });
      } else if (dirtyFeedbackDoc.base64 && dirtyFeedbackDoc.mimeType) {
        promptParts.push({ inlineData: { data: dirtyFeedbackDoc.base64, mimeType: dirtyFeedbackDoc.mimeType } });
      }
    }

    promptParts.push({ text: "Based on the provided medical evaluation documents, generate the comprehensive evaluation report JSON." });

    // Use absolute-style path for fetch to ensure it hits the Netlify function endpoint correctly
    const response = await fetch("/.netlify/functions/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: promptParts
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Analysis failed on server.");
    }

    let reportData: EvaluationReport;
    try {
      let cleanOutput = data.output.trim();
      if (cleanOutput.startsWith('```')) {
        cleanOutput = cleanOutput.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
      }
      reportData = JSON.parse(cleanOutput);
    } catch (parseError) {
      console.error("Failed to parse AI output as JSON:", data.output);
      throw new Error("AI returned an invalid report format. Please try again.");
    }

    return reportData;
  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    throw new Error(error.message || "An unexpected error occurred during processing.");
  }
};