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

  const processFile = async (file: File): Promise<FileData> => {
    const isDocx = file.name.endsWith('.docx');
    if (isDocx) {
      setLoadingStep("Parsing Word document...");
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return { text: result.value, name: file.name, isDocx: true };
    }
    
    // Fallback to base64 for Vision/PDF
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return { base64, mimeType: file.type, name: file.name, isDocx: false };
  };

  const handleAnalyze = async () => {
    if (!sourceDoc) return setError("Student Answer Sheet is required.");
    if (evalMode === 'with-manual' && !dirtyFeedbackDoc) return setError("Faculty Notes are required for manual mode.");

    setIsLoading(true);
    setError(null);
    try {
      const sData = await processFile(sourceDoc);
      const fData = dirtyFeedbackDoc ? await processFile(dirtyFeedbackDoc) : null;
      setLoadingStep("AI performing medical audit...");
      const res = await generateStructuredFeedback(sData, fData, evalMode);
      setReport(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="h-16 border-b bg-white flex items-center px-8 justify-between sticky top-0 z-50 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-600 rounded flex items-center justify-center text-white font-black">A</div>
          <span className="font-black text-xl tracking-tighter">AnatomyGuru</span>
        </div>
        {view === 'report' && (
          <button 
            onClick={() => { setView('dashboard'); setReport(null); }}
            className="text-sm font-bold bg-slate-100 px-4 py-2 rounded-lg hover:bg-slate-200"
          >
            New Analysis
          </button>
        )}
      </nav>

      <main className="flex-1 bg-slate-50">
        {view === 'dashboard' ? (
          <div className="max-w-4xl mx-auto py-12 px-6 animate-fade-in">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-black mb-4">Clinical <span className="text-red-600">Audit Engine</span></h1>
              <p className="text-slate-500 font-medium">Extracting medical knowledge gaps with professional precision.</p>
            </div>

            <div className="flex justify-center mb-8">
              <div className="bg-white p-1 rounded-xl shadow-sm border flex">
                <button onClick={() => setEvalMode('with-manual')} className={`px-4 py-2 rounded-lg text-sm font-bold ${evalMode === 'with-manual' ? 'bg-red-600 text-white' : 'text-slate-500'}`}>With Manual Notes</button>
                <button onClick={() => setEvalMode('without-manual')} className={`px-4 py-2 rounded-lg text-sm font-bold ${evalMode === 'without-manual' ? 'bg-red-600 text-white' : 'text-slate-500'}`}>Automated (Key Only)</button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <FileUploader 
                label="Student Paper" 
                description="QP + Answer Key + Answers" 
                onFileSelect={setSourceDoc} 
                selectedFile={sourceDoc} 
                icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              />
              {evalMode === 'with-manual' && (
                <FileUploader 
                  label="Faculty Notes" 
                  description="Handwritten marks/feedback" 
                  onFileSelect={setDirtyFeedbackDoc} 
                  selectedFile={dirtyFeedbackDoc} 
                  icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                />
              )}
            </div>

            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-bold text-sm border border-red-100">{error}</div>}

            <button 
              onClick={handleAnalyze} 
              disabled={isLoading}
              className={`w-full py-5 rounded-2xl font-black text-lg shadow-xl transition-all ${isLoading ? 'bg-slate-200 text-slate-400' : 'bg-slate-900 text-white hover:-translate-y-1'}`}
            >
              {isLoading ? loadingStep || 'Processing...' : 'Generate Medical Feedback'}
            </button>
          </div>
        ) : (
          <FeedbackReport report={report} />
        )}
      </main>
    </div>
  );
};

export default App;