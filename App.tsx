import React, { useState, useEffect } from 'react';
import { generateStructuredFeedback, EvaluationMode } from './services/geminiService.ts';
import { EvaluationReport, FileData } from './types.ts';
import FileUploader from './components/FileUploader.tsx';
import FeedbackReport from './components/FeedbackReport.tsx';
// @ts-ignore
import mammoth from 'mammoth';

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
    if (report) {
      setView('report');
      window.scrollTo(0, 0);
    }
  }, [report]);

  const processFile = async (file: File): Promise<FileData> => {
    const isDocx = file.name.toLowerCase().endsWith('.docx');
    if (isDocx) {
      setLoadingStep(`Parsing ${file.name}...`);
      try {
        const arrayBuffer = await file.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("File is empty.");
        const result = await mammoth.extractRawText({ arrayBuffer });
        return { text: result.value, name: file.name, isDocx: true };
      } catch (e: any) {
        console.error("Mammoth error:", e);
        throw new Error(`Failed to parse DOCX: ${e.message || 'Unknown error'}`);
      }
    }
    
    setLoadingStep(`Processing ${file.name}...`);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1]);
          } else {
            reject(new Error("File conversion failed."));
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
      });
      return { base64, mimeType: file.type, name: file.name, isDocx: false };
    } catch (e: any) {
      throw new Error(`File Error: ${e.message}`);
    }
  };

  const handleAnalyze = async () => {
    if (!sourceDoc) {
      setError("Please upload the Student Answer Sheet.");
      return;
    }
    if (evalMode === 'with-manual' && !dirtyFeedbackDoc) {
      setError("Please upload the Faculty Notes.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingStep("Reading files...");
    
    try {
      const sData = await processFile(sourceDoc);
      const fData = dirtyFeedbackDoc ? await processFile(dirtyFeedbackDoc) : null;
      
      setLoadingStep("AI performing medical audit...");
      const res = await generateStructuredFeedback(sData, fData, evalMode);
      
      if (!res || !res.questions) {
        throw new Error("Received invalid response format from AI.");
      }
      
      setReport(res);
    } catch (err: any) {
      console.error("Analysis sequence failure:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
      setLoadingStep("");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-red-100 selection:text-red-900">
      <nav className="h-16 border-b bg-white/80 backdrop-blur-md flex items-center px-6 md:px-12 justify-between sticky top-0 z-50 no-print shadow-sm">
        <div className="flex items-center gap-3">
       
        </div>
        {view === 'report' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="text-[10px] font-black bg-white text-slate-900 border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 transition-all shadow-sm active:scale-95 uppercase tracking-wider flex items-center gap-2"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 012-2H5a2 2 0 012 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
            <button 
              onClick={() => { setView('dashboard'); setReport(null); }}
              className="text-[10px] font-black bg-slate-900 text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-all shadow-md active:scale-95 uppercase tracking-wider"
            >
              New Audit
            </button>
          </div>
        )}
      </nav>

      <main className="flex-1 flex flex-col">
        {view === 'dashboard' ? (
          <div className="max-w-4xl mx-auto py-12 px-6 animate-fade-in w-full">
            <div className="text-center mb-10">
              <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-full uppercase tracking-widest border border-red-100 mb-4 inline-block">Medical Education SaaS</span>
              <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight text-slate-900">Medical <span className="text-red-600">Evaluation</span></h1>
              <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto">Professional medical audit engine. Extracts marks and identifies knowledge gaps with clinical precision.</p>
            </div>

            <div className="flex justify-center mb-10">
              <div className="bg-slate-200/50 p-1 rounded-2xl border border-slate-200 flex shadow-inner">
                <button 
                  onClick={() => setEvalMode('with-manual')} 
                  className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${evalMode === 'with-manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  With manual feedback
                </button>
                <button 
                  onClick={() => setEvalMode('without-manual')} 
                  className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${evalMode === 'without-manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Without manual feedback
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-10">
              <FileUploader 
                label="Student Paper" 
                description="Upload Answer Sheet (PDF/Image/DOCX)" 
                onFileSelect={setSourceDoc} 
                selectedFile={sourceDoc} 
                icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
              />
              {evalMode === 'with-manual' && (
                <FileUploader 
                  label="Faculty Notes" 
                  description="Upload Handwritten Marks (Image/PDF)" 
                  onFileSelect={setDirtyFeedbackDoc} 
                  selectedFile={dirtyFeedbackDoc} 
                  icon={<svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                />
              )}
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl mb-8 font-bold text-sm border border-rose-100 flex items-center gap-4 animate-fade-in shadow-sm">
                <svg className="w-6 h-6 shrink-0 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}

            <button 
              onClick={handleAnalyze} 
              disabled={isLoading || !sourceDoc || (evalMode === 'with-manual' && !dirtyFeedbackDoc)}
              className={`w-full py-6 rounded-2xl font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-4 ${isLoading ? 'bg-slate-100 text-slate-400 cursor-wait' : 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-1 active:scale-[0.98]'}`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-6 w-6 text-red-500" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="uppercase tracking-widest text-sm">{loadingStep || 'Processing...'}</span>
                </>
              ) : (
                'Generate Feedback Report'
              )}
            </button>
            <p className="mt-8 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">Supports PDF • Image • DOCX</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-slate-100 py-8 px-4 sm:px-8">
             <FeedbackReport report={report} />
          </div>
        )}
      </main>

      <footer className="py-8 text-center text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] no-print">
        AnatomyGuru Medical Audit Tool • © 2026 
      </footer>
    </div>
  );
};

export default App;
