
import { EvaluationReport, FileData } from "../types";

export type EvaluationMode = 'with-manual' | 'without-manual';

export const generateStructuredFeedback = async (
  sourceDoc: FileData,
  dirtyFeedbackDoc: FileData | null,
  mode: EvaluationMode = 'with-manual'
): Promise<EvaluationReport> => {
  try {
    const response = await fetch("/.netlify/functions/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceDoc,
        dirtyFeedbackDoc,
        mode
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate report");
    }

    const data = await response.json();
    return data as EvaluationReport;
  } catch (error: any) {
    console.error("Service Error:", error);
    throw new Error(error.message || "An unexpected error occurred during evaluation.");
  }
};
