import React, { useState, useEffect } from 'react';
import { generateStructuredFeedback, EvaluationMode } from './services/geminiService.ts';
import { EvaluationReport, FileData } from './types.ts';
import FileUploader from './components/FileUploader.tsx';
import FeedbackReport from './components/FeedbackReport.tsx';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } from 'docx';

// Safe resolution of PDF.js object
const pdfjs: any = (pdfjsLib as any).GlobalWorkerOptions 
  ? pdfjsLib 
  : (pdfjsLib as any).default || pdfjsLib;

// Set up PDF.js worker using a version-matched CDN
if (pdfjs && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;
}

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
    if (!pdfjs || !pdfjs.getDocument) {
      throw new Error("PDF.js library not properly initialized.");
    }
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
        if (text.trim().length > 150) {
          return { text, name: file.name, isDocx: false };
        }
      } catch (e) {
        console.warn("PDF extraction fallback to Vision", e);
      }
    }

    setLoadingStep(`Encoding Visual Data: ${file.name}`);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
    });

    return {
      base64,
      mimeType: file.type,
      name: file.name,
      isDocx: false
    };
  };

  const handleAnalyze = async () => {
    if (!sourceDoc) {
      setError("Please upload the Student Answer Sheet.");
      return;
    }
    if (evalMode === 'with-manual' && !dirtyFeedbackDoc) {
      setError("Please upload Faculty Notes for manual feedback mode.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const sourceData = await processFile(sourceDoc);
      const feedbackData = evalMode === 'with-manual' && dirtyFeedbackDoc 
        ? await processFile(dirtyFeedbackDoc) 
        : null;

      setLoadingStep("AI performing medical audit...");
      const result = await generateStructuredFeedback(sourceData, feedbackData, evalMode);
      setReport(result);
    } catch (err: any) {
      console.error("Analysis Failure:", err);
      setError(err.message || "An error occurred during evaluation.");
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleExportWord = async () => {
    if (!report) return;

    const sections = [];
    sections.push(
      new Paragraph({
        children: [new TextRun(report.testTitle || 'Evaluation Report')],
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Student Name: `, bold: true }),
          new TextRun({ text: report.studentName || 'N/A' }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Date: `, bold: true }),
          new TextRun({ text: report.testDate || 'N/A' }),
        ],
      }),
      new Paragraph({ children: [] }) 
    );

    const tableRows = [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Q No", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Feedback", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Marks", bold: true })] })] }),
        ],
      }),
    ];

    report.questions.forEach((q) => {
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun(q.qNo)] })] }),
            new TableCell({
              children: q.feedbackPoints.map(p => new Paragraph({ 
                children: [new TextRun("• " + p)], 
                spacing: { before: 100 } 
              })),
            }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun(`${q.marks}`)] })] }),
          ],
        })
      );
    });

    const doc = new Document({
      sections: [{
        children: [
          ...sections,
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.studentName || 'Evaluation'}_Report.docx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderDashboard = () => (
    <div className="max-w-5xl mx-auto px-4 mt-12 animate-fade-in pb-20">
      <header className="text-center mb-10">
        <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">
          Medical <span className="text-red-600">Evaluation</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
          Professional medical audit engine. Extracts marks and identifies knowledge gaps with clinical precision.
        </p>
      </header>

      <div className="flex justify-center mb-10">
        <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center shadow-inner border border-slate-200">
          <button 
            onClick={() => setEvalMode('with-manual')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${evalMode === 'with-manual' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            With Manual Feedback
          </button>
          <button 
            onClick={() => setEvalMode('without-manual')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${evalMode === 'without-manual' ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Automated (Key Only)
          </button>
        </div>
      </div>

      <div className={`grid gap-8 mb-12 h-full ${evalMode === 'with-manual' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-lg mx-auto'}`}>
        <FileUploader
          label="Student Answer Sheet"
          description="Source PDF or DOCX file (Must contain Key)"
          onFileSelect={setSourceDoc}
          selectedFile={sourceDoc}
          icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>}
        />
        {evalMode === 'with-manual' && (
          <FileUploader
            label="Faculty Notes"
            description="Evaluator marks and handwritten comments"
            onFileSelect={setDirtyFeedbackDoc}
            selectedFile={dirtyFeedbackDoc}
            icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>}
          />
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-600 p-6 rounded-2xl mb-8 flex items-start gap-4">
          <p className="font-semibold">{error}</p>
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={isLoading || !sourceDoc || (evalMode === 'with-manual' && !dirtyFeedbackDoc)}
        className={`w-full py-6 rounded-2xl font-black text-xl shadow-2xl transition-all flex flex-col items-center justify-center gap-1 ${
          isLoading ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 text-white hover:-translate-y-1'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-4">
            <svg className="animate-spin h-6 w-6 text-red-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <span className="animate-pulse tracking-widest uppercase text-sm font-black">{loadingStep || 'Analyzing...'}</span>
          </div>
        ) : (
          'Generate Professional Feedback'
        )}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <nav className="bg-white/95 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50 no-print h-16 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          
          
          {view === 'report' && report && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setView('dashboard')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all border border-slate-300"
              >
                New Analysis
              </button>
              <button 
                onClick={handleExportWord}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-lg"
              >
                Word
              </button>
              <button 
                onClick={handleExportPDF}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-lg"
              >
                PDF
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4">
        {view === 'dashboard' ? renderDashboard() : <FeedbackReport report={report} />}
      </main>
    </div>
  );
};

export default App;