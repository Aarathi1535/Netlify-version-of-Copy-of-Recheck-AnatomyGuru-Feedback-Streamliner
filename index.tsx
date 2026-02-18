import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } from 'docx';

// --- PDF.js Setup ---
const pdfjs: any = (pdfjsLib as any).GlobalWorkerOptions 
  ? pdfjsLib 
  : (pdfjsLib as any).default || pdfjsLib;

if (pdfjs && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

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

  promptParts.push({ text: "Generate the medical report JSON." });

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

  return (
    <div className="max-w-[850px] mx-auto my-6 sm:my-10 bg-white border border-slate-200 p-8 sm:p-14 text-slate-900 shadow-xl report-card animate-fade-in font-serif">
      <div className="flex flex-col items-center mb-10">
        <img src={logo} alt="Anatomy Guru Logo" className="w-56 sm:w-64 mb-6" />
        <h2 className="text-red-600 text-lg font-black uppercase tracking-[0.2em] border-b-2 border-red-100 pb-1 mb-4 text-center">
          {report.testTitle || 'Clinical Evaluation Transcript'}
        </h2>
        <div className="text-center">
          <p className="text-sm font-bold text-slate-600 mb-1">{report.testTopics}</p>
          <p className="text-xs font-black text-blue-700 uppercase tracking-widest">{report.testDate}</p>
        </div>
      </div>

      <div className="mb-8 pb-4 border-b border-slate-100 flex items-center gap-3">
        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Candidate:</span>
        <span className="text-base font-extrabold text-slate-900 underline">{report.studentName}</span>
      </div>

      <div className="border border-slate-300 rounded-lg overflow-hidden mb-12">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-300">
            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              <th className="p-4 border-r border-slate-300 text-center w-16">No.</th>
              <th className="p-4 border-r border-slate-300">Clinical Observations</th>
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
              <td className="p-4 text-center font-black text-base">{calculatedSum} / {report.maxScore}</td>
            </tr>
          </tbody>
        </table>
      </div>

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
                <ul className="list-disc ml-6 space-y-1.5 text-[13px] text-slate-800 leading-relaxed">
                  {(val as string[]).map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />)}
                </ul>
              </div>
            ))}
          </div>
        </div>
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
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'report'>('dashboard');
  const [evalMode, setEvalMode] = useState<EvaluationMode>('with-manual');

  useEffect(() => {
    if (report) setView('report');
  }, [report]);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    if (!pdfjs || !pdfjs.getDocument) throw new Error("PDF parser not ready.");
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `[P${i}] ${pageText}\n`;
    }
    return fullText;
  };

  const processFile = async (file: File): Promise<FileData> => {
    const fileName = file.name.toLowerCase();
    const isDocx = fileName.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isPdf = fileName.endsWith('.pdf') || file.type === 'application/pdf';
    
    if (isDocx) {
      setLoadingStep(`Parsing DOCX: ${file.name}`);
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return { text: result.value, name: file.name, isDocx: true };
    } 
    
    if (isPdf) {
      setLoadingStep(`Extracting PDF: ${file.name}`);
      try {
        const text = await extractTextFromPDF(file);
        if (text.trim().length > 150) return { text, name: file.name, isDocx: false };
      } catch (e) { console.warn("Fallback to Vision for PDF", e); }
    }

    setLoadingStep(`Encoding Visual Data: ${file.name}`);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });

    return { base64, mimeType: file.type, name: file.name, isDocx: false };
  };

  const handleAnalyze = async () => {
    if (!sourceDoc) { setError("Please upload the Student Paper."); return; }
    if (evalMode === 'with-manual' && !dirtyFeedbackDoc) { setError("Please upload Faculty Notes."); return; }
    setIsLoading(true);
    setError(null);
    try {
      const sourceData = await processFile(sourceDoc);
      const feedbackData = evalMode === 'with-manual' && dirtyFeedbackDoc ? await processFile(dirtyFeedbackDoc) : null;
      setLoadingStep("AI performing medical audit...");
      const result = await generateStructuredFeedback(sourceData, feedbackData, evalMode);
      setReport(result);
    } catch (err: any) { setError(err.message || "An error occurred."); } 
    finally { setIsLoading(false); setLoadingStep(''); }
  };

  const handleExportWord = async () => {
    if (!report) return;
    const sections: any[] = [];
    sections.push(
      new Paragraph({ children: [new TextRun({ text: report.testTitle || 'Medical Audit', bold: true, size: 32 })], heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: `Student: ${report.studentName}`, bold: true })] }),
      new Paragraph({ children: [new TextRun({ text: `Date: ${report.testDate}` })] }),
      new Paragraph({ children: [] })
    );

    const tableRows = [
      new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Q No", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Observations", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Marks", bold: true })] })] }),
      ]})
    ];

    report.questions.forEach((q) => {
      tableRows.push(new TableRow({ children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun(q.qNo)] })] }),
        new TableCell({ children: q.feedbackPoints.map(p => new Paragraph({ children: [new TextRun("• " + p)] })) }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun(`${q.marks}`)] })] }),
      ]}));
    });

    sections.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
    
    const doc = new Document({ sections: [{ children: sections }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.studentName}_Audit.docx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      <nav className="h-16 glass-nav border-b border-slate-200 flex items-center px-6 md:px-16 justify-between sticky top-0 z-50 no-print">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-black">A</div>
          <span className="font-extrabold text-lg text-slate-900">AnatomyGuru <span className="text-red-600">Audit</span></span>
        </div>
        {view === 'report' && (
          <div className="flex gap-2">
            <button onClick={() => { setReport(null); setView('dashboard'); }} className="text-xs font-bold bg-slate-100 px-4 py-2 rounded-lg">New Analysis</button>
            <button onClick={handleExportWord} className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg">Word Export</button>
            <button onClick={() => window.print()} className="text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-lg">PDF Export</button>
          </div>
        )}
      </nav>

      <main className="flex-1 p-6 md:p-12">
        {view === 'dashboard' ? (
          <div className="max-w-4xl mx-auto py-12 animate-fade-in">
            <div className="text-center mb-16">
              <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">Clinical <span className="text-red-600">Evaluation</span></h1>
              <p className="text-slate-500 font-medium text-lg">Professional medical audit engine. Extracts marks and identifies knowledge gaps.</p>
            </div>

            <div className="flex justify-center mb-10">
              <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200 shadow-inner">
                <button onClick={() => setEvalMode('with-manual')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${evalMode === 'with-manual' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'}`}>With Manual Notes</button>
                <button onClick={() => setEvalMode('without-manual')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${evalMode === 'without-manual' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'}`}>Automated (Key Only)</button>
              </div>
            </div>

            <div className={`grid gap-8 mb-12 ${evalMode === 'with-manual' ? 'md:grid-cols-2' : 'max-w-lg mx-auto'}`}>
              <FileUploader label="Student Paper" description="PDF, Image, or DOCX" onFileSelect={setSourceDoc} selectedFile={sourceDoc} icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>} />
              {evalMode === 'with-manual' && (
                <FileUploader label="Faculty Notes" description="Evaluator's handwritten notes" onFileSelect={setDirtyFeedbackDoc} selectedFile={dirtyFeedbackDoc} icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>} />
              )}
            </div>

            {error && <div className="p-5 bg-rose-50 text-rose-600 rounded-2xl mb-8 font-bold border border-rose-100 flex items-center gap-3 animate-shake"><span>⚠️</span> {error}</div>}

            <button onClick={handleAnalyze} disabled={isLoading || !sourceDoc} className={`w-full py-6 rounded-2xl font-black text-xl transition-all shadow-xl flex flex-col items-center justify-center gap-1 ${isLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed border' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
              {isLoading ? <><div className="loader mb-2"></div><span className="text-xs uppercase tracking-widest">{loadingStep}</span></> : 'Generate Professional Audit'}
            </button>
          </div>
        ) : <FeedbackReport report={report} />}
      </main>
      <footer className="py-10 text-center opacity-30 text-[10px] font-black uppercase tracking-[0.3em]">Official Audit Portal © 2025 AnatomyGuru</footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);