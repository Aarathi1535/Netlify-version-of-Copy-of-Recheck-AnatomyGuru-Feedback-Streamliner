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
    You are the "Anatomy Guru Master Evaluator". Create a medical audit report.
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

  promptParts.push({ text: "Based on these medical documents, generate a comprehensive evaluation report in the requested JSON format." });

  const response = await fetch("/.netlify/functions/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: promptParts }),
  });

  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || "Audit failed.");

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
    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-white hover:border-red-500 hover:bg-red-50/30 transition-all cursor-pointer group relative">
      <input
        type="file"
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        accept="application/pdf,image/*,.docx"
      />
      <div className="text-slate-400 group-hover:text-red-600 mb-4 transition-colors">
        {icon}
      </div>
      <h3 className="text-base font-bold text-slate-900">{label}</h3>
      <p className="text-xs text-slate-500 text-center mt-1">{description}</p>
      {selectedFile && (
        <div className="mt-4 px-3 py-1 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold border border-red-200 uppercase tracking-wider">
          {selectedFile.name}
        </div>
      )}
    </div>
  );
};

const FeedbackReport: React.FC<{ report: EvaluationReport | null }> = ({ report }) => {
  if (!report) return null;

  const calculatedSum = report.questions?.reduce((acc, q) => acc + (Number(q.marks) || 0), 0) || 0;
  const logo = 'https://www.anatomyguru.in/assets/img/logo.jpg';

  const renderBulletList = (items?: string[]) => {
    if (!items || items.length === 0) return <p className="ml-6 text-slate-400 italic text-sm">No specific feedback provided.</p>;
    return (
      <ul className="list-disc list-outside ml-10 space-y-1.5 mb-2 text-[13px] text-slate-800 leading-relaxed">
        {items.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
        ))}
      </ul>
    );
  };

  return (
    <div className="max-w-[850px] mx-auto my-6 sm:my-10 bg-white border border-slate-200 p-8 sm:p-14 text-slate-900 shadow-xl report-card animate-fade-in">
      {/* Header */}
      <div className="flex flex-col items-center mb-10">
        <img src={logo} alt="Anatomy Guru Logo" className="w-56 sm:w-64 mb-6 grayscale hover:grayscale-0 transition-all duration-700" />
        <h2 className="text-red-600 text-lg font-black uppercase tracking-[0.2em] border-b-2 border-red-100 pb-1 mb-4 text-center">
          {report.testTitle || 'Clinical Evaluation Transcript'}
        </h2>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-600 mb-1">{report.testTopics}</p>
          <p className="text-xs font-black text-blue-700 uppercase tracking-widest">{report.testDate}</p>
        </div>
      </div>

      {/* Student Meta */}
      <div className="mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Candidate:</span>
        <span className="text-base font-extrabold text-slate-900 underline underline-offset-4 decoration-red-200 decoration-2">
          {report.studentName}
        </span>
      </div>

      {/* Results Table */}
      <div className="border border-slate-300 rounded-lg overflow-hidden mb-12">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-300">
            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              <th className="p-4 border-r border-slate-300 text-center w-16">No.</th>
              <th className="p-4 border-r border-slate-300">Clinical Observations & Feedback</th>
              <th className="p-4 text-center w-24 text-red-600">Marks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {report.questions?.map((q, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="p-4 border-r border-slate-300 text-center font-bold text-slate-400 text-sm">{q.qNo}</td>
                <td className="p-4 border-r border-slate-300">
                  <ul className="list-disc ml-4 space-y-1">
                    {q.feedbackPoints.map((p, pi) => (
                      <li key={pi} className="text-[13px] leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    ))}
                  </ul>
                </td>
                <td className="p-4 text-center font-black text-slate-900 text-sm">{q.marks}</td>
              </tr>
            ))}
            <tr className="bg-slate-900 text-white">
              <td colSpan={2} className="p-4 text-right text-[10px] font-black uppercase tracking-[0.2em]">Final Cumulative Score</td>
              <td className="p-4 text-center font-black text-base">{calculatedSum} <span className="text-white/40 text-xs">/ {report.maxScore}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Detailed Sections */}
      <div className="space-y-10">
        <div className="relative">
          <div className="absolute -left-6 top-1 bottom-1 w-1 bg-red-600 rounded-full"></div>
          <h3 className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mb-4">Audit Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {Object.entries(report.generalFeedback).filter(([_, v]) => (v as string[]).length > 0).map(([key, val]) => (
              <div key={key} className="space-y-3">
                <h4 className="text-xs font-black uppercase text-slate-900 border-b border-slate-100 pb-1">
                  {key.replace(/([A-Z])/g, ' $1')}
                </h4>
                {renderBulletList(val as string[])}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Signature Footer */}
      <div className="mt-20 pt-10 border-t-2 border-slate-900 flex justify-between items-end">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Audit ID</p>
          <p className="text-[12px] font-mono text-slate-900 font-bold">AG-2025-EVAL-{Math.random().toString(36).substring(7).toUpperCase()}</p>
        </div>
        <div className="text-right">
          <div className="w-48 border-b-2 border-slate-900 mb-2"></div>
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Authorized Signature</p>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">AnatomyGuru Clinical Audit Unit</p>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

const App: React.FC = () => {
  const [sourceDoc, setSourceDoc] = useState<File | null>(null);
  const [dirtyFeedbackDoc, setDirtyFeedbackDoc] = useState<File | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<string>('');
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
      setError("Please ensure both student paper and notes are uploaded.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setStep('Parsing documents...');
    try {
      const sData = await processFile(sourceDoc);
      const fData = dirtyFeedbackDoc ? await processFile(dirtyFeedbackDoc) : null;
      setStep('AI medical audit in progress...');
      const res = await generateStructuredFeedback(sData, fData, evalMode);
      setReport(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || "Something went wrong during the audit.");
    } finally {
      setIsLoading(false);
      setStep('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="h-20 glass-nav border-b border-slate-100 flex items-center px-6 md:px-16 justify-between sticky top-0 z-50 no-print">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-red-200 rotate-2">A</div>
          <div className="flex flex-col -space-y-1">
            <span className="font-extrabold text-lg tracking-tight text-slate-900">AnatomyGuru</span>
            <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em]">Audit Engine</span>
          </div>
        </div>
        {report && (
          <div className="flex items-center gap-3">
            <button onClick={() => window.print()} className="hidden sm:flex text-[10px] font-black bg-white border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50 transition-all items-center gap-2 uppercase tracking-widest shadow-sm">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 012-2H5a2 2 0 012 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
            <button onClick={() => setReport(null)} className="text-[10px] font-black bg-slate-900 text-white px-5 py-2 rounded-lg hover:bg-red-600 transition-all uppercase tracking-widest shadow-lg shadow-slate-200">New Audit</button>
          </div>
        )}
      </nav>

      <main className="flex-1 p-6 md:p-12">
        {!report ? (
          <div className="max-w-4xl mx-auto py-12 animate-fade-in">
            <div className="text-center mb-16 space-y-4">
              <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">Clinical <span className="text-red-600">Audit Streamlined</span></h1>
              <p className="text-slate-500 font-medium text-lg max-w-2xl mx-auto">Upload medical answer sheets and faculty notes to generate structured, professional feedback reports instantly.</p>
            </div>

            <div className="flex justify-center mb-12">
              <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 border border-slate-200">
                <button onClick={() => setEvalMode('with-manual')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${evalMode === 'with-manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>WITH NOTES</button>
                <button onClick={() => setEvalMode('without-manual')} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${evalMode === 'without-manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>AI ONLY</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <FileUploader 
                label="Student Answer Paper" 
                description="PDF, Images, or DOCX" 
                onFileSelect={setSourceDoc} 
                selectedFile={sourceDoc} 
                icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} 
              />
              {evalMode === 'with-manual' && (
                <FileUploader 
                  label="Faculty Rough Notes" 
                  description="Evaluator's manual feedback" 
                  onFileSelect={setDirtyFeedbackDoc} 
                  selectedFile={dirtyFeedbackDoc} 
                  icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} 
                />
              )}
            </div>

            {error && <div className="p-5 bg-red-50 text-red-700 rounded-2xl mb-8 text-sm font-bold border border-red-100 flex items-center gap-3 animate-fade-in"><span className="text-lg">⚠️</span> {error}</div>}

            <button 
              onClick={handleAnalyze} 
              disabled={isLoading || !sourceDoc}
              className={`w-full py-7 rounded-2xl font-black text-xl tracking-tight transition-all shadow-2xl flex items-center justify-center gap-4 ${isLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-red-600 hover:-translate-y-1 active:scale-95'}`}
            >
              {isLoading ? (
                <>
                  <div className="loader"></div>
                  <span className="uppercase tracking-widest text-xs font-black">{step}</span>
                </>
              ) : 'Generate Professional Audit'}
            </button>
            <p className="mt-10 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Secure Medical Processing • Powered by AnatomyGuru</p>
          </div>
        ) : (
          <div className="animate-fade-in py-6">
            <FeedbackReport report={report} />
          </div>
        )}
      </main>

      <footer className="py-12 text-center text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] no-print">
        Official Clinical Evaluation Portal • &copy; 2025 • AnatomyGuru
      </footer>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
