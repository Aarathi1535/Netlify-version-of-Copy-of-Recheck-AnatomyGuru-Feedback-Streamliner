import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-ignore
import mammoth from 'mammoth';

// --- TYPES ---
interface QuestionFeedback {
  qNo: string;
  feedbackPoints: string[];
  marks: number;
  maxMarks: number;
  isCorrect: boolean;
  isFlagged?: boolean;
}

interface GeneralFeedbackSection {
  overallPerformance: string[];
  mcqs: string[];
  contentAccuracy: string[];
  completenessOfAnswers: string[];
  presentationDiagrams: string[];
  investigations: string[];
  attemptingQuestions: string[];
  actionPoints: string[];
}

interface EvaluationReport {
  studentName: string;
  testTitle: string;
  testTopics: string;
  testDate: string;
  totalScore: number;
  maxScore: number;
  questions: QuestionFeedback[];
  generalFeedback: GeneralFeedbackSection;
}

interface FileData {
  base64?: string;
  mimeType?: string;
  text?: string;
  name: string;
  isDocx: boolean;
}

type EvaluationMode = 'with-manual' | 'without-manual';

// --- SERVICE ---
const generateStructuredFeedback = async (
  sourceDoc: FileData,
  dirtyFeedbackDoc: FileData | null,
  mode: EvaluationMode = 'with-manual'
): Promise<EvaluationReport> => {
  const systemInstructions = `
    You are the "Anatomy Guru Master Evaluator". Create a professional medical audit report.
    SOURCE DOC: Question Paper, Answer Key, and Student Answers.
    MODE: ${mode}.
    ${mode === 'with-manual' ? 'Prioritize Answer Key for facts, Faculty Notes for marks. Flag factual contradictions.' : 'Evaluate ALL questions in QP against Key.'}
    
    OUTPUT: Return strictly valid JSON.
  `;

  const promptParts: any[] = [{ text: systemInstructions }];

  if (sourceDoc.text) {
    promptParts.push({ text: `Student Paper Text: ${sourceDoc.text}` });
  } else if (sourceDoc.base64 && sourceDoc.mimeType) {
    promptParts.push({ inlineData: { data: sourceDoc.base64, mimeType: sourceDoc.mimeType } });
  }

  if (mode === 'with-manual' && dirtyFeedbackDoc) {
    if (dirtyFeedbackDoc.text) {
      promptParts.push({ text: `Faculty Notes Text: ${dirtyFeedbackDoc.text}` });
    } else if (dirtyFeedbackDoc.base64 && dirtyFeedbackDoc.mimeType) {
      promptParts.push({ inlineData: { data: dirtyFeedbackDoc.base64, mimeType: dirtyFeedbackDoc.mimeType } });
    }
  }

  promptParts.push({ text: "Generate the comprehensive evaluation report JSON based on the provided documents." });

  const response = await fetch("/.netlify/functions/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: promptParts }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Analysis failed.");
  }

  let cleanOutput = data.output.trim();
  if (cleanOutput.startsWith('```')) {
    cleanOutput = cleanOutput.replace(/^```(json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(cleanOutput);
};

// --- COMPONENTS ---

const FileUploader: React.FC<{
  label: string;
  description: string;
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  icon: React.ReactNode;
}> = ({ label, description, onFileSelect, selectedFile, icon }) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:border-red-500 transition-colors cursor-pointer group relative">
      <input
        type="file"
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        accept="application/pdf,image/*,.docx"
      />
      <div className="text-red-500 mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-800">{label}</h3>
      <p className="text-sm text-slate-500 text-center mt-1">{description}</p>
      {selectedFile && (
        <div className="mt-4 px-4 py-2 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-100">
          Selected: {selectedFile.name}
        </div>
      )}
    </div>
  );
};

const FeedbackReport: React.FC<{ report: EvaluationReport | null }> = ({ report }) => {
  if (!report) return <div className="p-20 text-center text-slate-400 font-bold uppercase">No data available.</div>;

  const calculatedSum = report.questions?.reduce((acc, q) => acc + (Number(q.marks) || 0), 0) || 0;
  const logo = 'https://www.anatomyguru.in/assets/img/logo.jpg';

  const renderBulletList = (items?: string[]) => {
    if (!items || items.length === 0) return <p className="ml-6 text-slate-400 italic">No specific feedback provided.</p>;
    return (
      <ul className="list-disc list-outside ml-10 space-y-1 mb-2 text-sm text-slate-800">
        {items.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />)}
      </ul>
    );
  };

  return (
    <div className="max-w-[850px] mx-auto my-10 bg-white border border-slate-300 p-8 sm:p-12 text-[#1e1e1e] shadow-lg animate-fade-in font-serif">
      <div className="flex flex-col items-center mb-6">
        <img src={logo} alt="Anatomy Guru Logo" className="w-64 mb-4" />
        <h2 className="text-red-600 text-xl font-black uppercase tracking-widest border-b border-red-100 pb-1 mb-2">
          {report.testTitle || 'Clinical Evaluation'}
        </h2>
        <div className="text-center text-sm">
          <p className="font-bold">Topics: {report.testTopics}</p>
          <p className="font-bold text-blue-800 uppercase">Date: {report.testDate}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2 border-t pt-4 border-slate-100 text-sm">
        <span className="text-red-600 font-black uppercase">Student Name:</span>
        <span className="font-black underline">{report.studentName}</span>
      </div>

      <div className="border border-slate-400 mb-8 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-400">
            <tr>
              <th className="p-2 border-r border-slate-400 w-16">Q No</th>
              <th className="p-2 border-r border-slate-400 text-left">Feedback</th>
              <th className="p-2 w-20">Marks</th>
            </tr>
          </thead>
          <tbody>
            {report.questions?.map((q, i) => (
              <tr key={i} className="border-b border-slate-300">
                <td className="p-2 border-r border-slate-400 text-center font-bold">{q.qNo}</td>
                <td className="p-2 border-r border-slate-400">
                  <ul className="list-disc ml-4">
                    {q.feedbackPoints.map((p, pi) => (
                      <li key={pi} dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    ))}
                  </ul>
                </td>
                <td className="p-2 text-center font-bold">{q.marks}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-black">
              <td colSpan={2} className="p-2 text-right uppercase border-r border-slate-400">Total Summation</td>
              <td className="p-2 text-center text-red-600">{calculatedSum} / {report.maxScore}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8 border border-slate-900 p-6 space-y-4">
        <h3 className="text-red-600 font-bold underline">General Feedback:</h3>
        {Object.entries(report.generalFeedback).map(([key, val]) => (
          <div key={key}>
            <h4 className="font-bold capitalize text-sm">{key.replace(/([A-Z])/g, ' $1')}</h4>
            {renderBulletList(val as string[])}
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t-2 border-slate-900 flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest">
        <span>Digital Transcript</span>
        <span className="text-slate-900">VERIFIED © 2025</span>
      </div>
    </div>
  );
};

// --- APP ---

const App: React.FC = () => {
  const [sourceDoc, setSourceDoc] = useState<File | null>(null);
  const [dirtyFeedbackDoc, setDirtyFeedbackDoc] = useState<File | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evalMode, setEvalMode] = useState<EvaluationMode>('with-manual');

  const processFile = async (file: File): Promise<FileData> => {
    const isDocx = file.name.toLowerCase().endsWith('.docx');
    if (isDocx) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return { text: result.value, name: file.name, isDocx: true };
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { base64, mimeType: file.type, name: file.name, isDocx: false };
  };

  const handleAnalyze = async () => {
    if (!sourceDoc || (evalMode === 'with-manual' && !dirtyFeedbackDoc)) {
      setError("Please upload all required documents.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const sData = await processFile(sourceDoc);
      const fData = dirtyFeedbackDoc ? await processFile(dirtyFeedbackDoc) : null;
      const res = await generateStructuredFeedback(sData, fData, evalMode);
      setReport(res);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <nav className="h-16 border-b bg-white flex items-center px-6 md:px-12 justify-between sticky top-0 z-50 no-print">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-black">A</div>
          <span className="font-black text-xl tracking-tighter">AnatomyGuru <span className="text-red-600">Audit</span></span>
        </div>
        {report && (
          <button onClick={() => setReport(null)} className="text-xs font-black bg-slate-900 text-white px-4 py-2 rounded uppercase">New Audit</button>
        )}
      </nav>

      <main className="flex-1 p-6">
        {!report ? (
          <div className="max-w-2xl mx-auto py-12 animate-fade-in">
            <h1 className="text-4xl font-black text-center mb-8">Medical <span className="text-red-600">Audit Engine</span></h1>
            
            <div className="flex justify-center mb-10 gap-2">
              <button onClick={() => setEvalMode('with-manual')} className={`px-4 py-2 rounded-lg text-xs font-black ${evalMode === 'with-manual' ? 'bg-red-600 text-white' : 'bg-slate-200'}`}>WITH NOTES</button>
              <button onClick={() => setEvalMode('without-manual')} className={`px-4 py-2 rounded-lg text-xs font-black ${evalMode === 'without-manual' ? 'bg-red-600 text-white' : 'bg-slate-200'}`}>AI ONLY</button>
            </div>

            <div className="grid gap-6 mb-8">
              <FileUploader label="Student Paper" description="Upload Answer Sheet" onFileSelect={setSourceDoc} selectedFile={sourceDoc} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
              {evalMode === 'with-manual' && (
                <FileUploader label="Faculty Notes" description="Upload Handwritten Feedback" onFileSelect={setDirtyFeedbackDoc} selectedFile={dirtyFeedbackDoc} icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} />
              )}
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl mb-4 text-sm font-bold border border-red-100">{error}</div>}

            <button 
              onClick={handleAnalyze} 
              disabled={isLoading || !sourceDoc}
              className={`w-full py-5 rounded-xl font-black text-lg transition-all ${isLoading ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-red-600'}`}
            >
              {isLoading ? 'Processing Audit...' : 'Generate Feedback Report'}
            </button>
          </div>
        ) : (
          <div className="animate-fade-in"><FeedbackReport report={report} /></div>
        )}
      </main>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
