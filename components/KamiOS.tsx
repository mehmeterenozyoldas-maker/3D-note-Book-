
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PenTool, Plus, Search, Bookmark, ChevronLeft, ChevronRight, Calendar, Highlighter, Eraser, PenLine, Type, CalendarCheck, Cloud, Loader2, Mic, MicOff, AlertCircle } from 'lucide-react';
import { Note, Stroke, ThemeConfig } from '../types';
import { SketchLayer } from './SketchLayer';
import { VFXLayer } from './VFXLayer';

interface KamiOSProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onUpdateNote: (id: string, updates: Partial<Note>) => void;
  onCreateNote: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export const KamiOS: React.FC<KamiOSProps> = ({ 
  notes, 
  activeNoteId, 
  onSelectNote, 
  onUpdateNote,
  onCreateNote,
  onNext,
  onPrev
}) => {
  
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [isSketching, setIsSketching] = useState(false);
  const [toolType, setToolType] = useState<'pen' | 'pencil' | 'highlighter' | 'sketch'>('pen');
  const [toolColor, setToolColor] = useState('#2c1b18'); 
  const [toolWidth, setToolWidth] = useState(2);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Dictation State
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Refs to avoid useEffect dependency cycles / stale closures
  const activeNoteRef = useRef<Note | null>(null);
  const onUpdateNoteRef = useRef(onUpdateNote);
  const isListeningRef = useRef(false); // Track intended state for restarts

  const activeNote = useMemo(() => 
    notes.find(n => n.id === activeNoteId) || null
  , [notes, activeNoteId]);

  const filteredNotes = useMemo(() => {
    if (categoryFilter === 'All') return notes;
    return notes.filter(note => note.category === categoryFilter);
  }, [notes, categoryFilter]);

  // Keep refs in sync
  useEffect(() => {
      activeNoteRef.current = activeNote;
  }, [activeNote]);

  useEffect(() => {
      onUpdateNoteRef.current = onUpdateNote;
  }, [onUpdateNote]);

  // Derived styling from CSS Vars
  useEffect(() => {
      const style = getComputedStyle(document.body);
  }, [activeNoteId]);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        
        recognition.onstart = () => {
            setIsListening(true);
            setMicError(false);
        };

        recognition.onresult = (event: any) => {
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            
            const currentNote = activeNoteRef.current;
            if (finalTranscript && currentNote) {
                // Check if we need a leading space
                const text = currentNote.content;
                const separator = (text.length > 0 && !/\s$/.test(text)) ? ' ' : '';
                
                onUpdateNoteRef.current(currentNote.id, { 
                    content: text + separator + finalTranscript 
                });
            }
        };

        recognition.onerror = (event: any) => {
            console.warn('Speech recognition error', event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                setMicError(true);
                setIsListening(false);
                isListeningRef.current = false;
            } else if (event.error === 'aborted') {
                // Aborted typically happens on stop()
                setIsListening(false);
            }
        };
        
        recognition.onend = () => {
             // Restart if we intend to keep listening (handle silence timeout)
             if (isListeningRef.current && !micError) {
                 try { 
                     recognition.start(); 
                 } catch(e) {
                     setIsListening(false);
                     isListeningRef.current = false;
                 }
             } else {
                 setIsListening(false);
             }
        };
    }
    
    return () => {
        if (recognitionRef.current) recognitionRef.current.abort();
    };
  }, []);

  const toggleDictation = () => {
    if (!recognitionRef.current) {
        console.warn("Speech Recognition API not available.");
        return;
    }
    
    setMicError(false);
    
    if (isListening) {
        isListeningRef.current = false; // Update intention to stop
        recognitionRef.current.stop();
    } else {
        isListeningRef.current = true; // Update intention to start
        try {
            recognitionRef.current.start();
        } catch (e) {
            console.error(e);
            setMicError(true);
            isListeningRef.current = false;
        }
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(d) + ", 2026";
  };

  const formatShortDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(ts));
  };
  
  const getInputValue = (ts: number) => {
    return new Date(ts).toISOString().split('T')[0];
  };

  const handleDateChange = (id: string, dateStr: string) => {
    if (!dateStr) return;
    const newDate = new Date(dateStr);
    newDate.setHours(12, 0, 0, 0); 
    onUpdateNote(id, { entryDate: newDate.getTime() });
  };

  const handleUpdateSketches = (strokes: Stroke[]) => {
      if (activeNote) {
          onUpdateNote(activeNote.id, { sketches: strokes });
      }
  };

  const handleConnectCalendar = () => {
    setIsSyncing(true);
    setTimeout(() => {
        setIsCalendarConnected(true);
        setIsSyncing(false);
    }, 1500);
  };

  const handleImportAgenda = () => {
    if (!activeNote) return;
    const events = [
        "09:00 AM — Product Sync w/ Design Team",
        "11:30 AM — Coffee with Sarah",
        "02:00 PM — Deep Work Block",
        "04:30 PM — Quarterly Review"
    ];

    const agendaBlock = `\n\n## Daily Agenda\n${events.map(e => `• ${e}`).join('\n')}\n`;
    
    onUpdateNote(activeNote.id, {
        content: activeNote.content + agendaBlock
    });
  };

  const tools = [
      { id: 'pen', icon: PenTool, color: 'var(--ink-color)', width: 2, label: 'Ink' },
      { id: 'pencil', icon: PenLine, color: '#546e7a', width: 1.5, label: 'Graphite' },
      { id: 'highlighter', icon: Highlighter, color: '#ffeb3b', width: 12, label: 'Marker' },
      { id: 'sketch', icon: PenTool, color: 'var(--ink-color)', width: 2, label: 'Sketch' },
  ];

  const handleToolSelect = (id: string, color: string, width: number) => {
      setToolType(id as any);
      setToolColor(color);
      setToolWidth(width);
      setIsSketching(true);
  };

  return (
    <div 
        className="flex w-full h-full select-none"
        style={{ color: 'var(--ink-color)', fontFamily: 'var(--font-body)' }}
    >
      
      {/* --- LEFT PAGE: TABLE OF CONTENTS (INDEX) --- */}
      <div className="w-1/2 h-full flex flex-col border-r border-[#e0e0e0]/20 relative px-10 py-12 pl-12">
        
        {/* Dynamic Header */}
        <div className="mb-8 text-center relative z-10">
            <h1 className="text-3xl tracking-widest uppercase border-b-2 border-double border-current pb-4 inline-block px-8 opacity-80"
                style={{ fontFamily: 'var(--font-header)' }}>
                Index
            </h1>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col gap-4 mb-8 relative z-10">
            <div className="relative group">
                <input 
                    type="text" 
                    placeholder="Search entries..." 
                    className="w-full bg-transparent border-b border-current py-1 pl-0 pr-6 text-base placeholder-current/40 focus:outline-none opacity-80 hover:opacity-100 transition-opacity"
                    style={{ fontFamily: 'var(--font-body)' }}
                />
                <Search className="absolute right-0 top-1.5 opacity-40 group-hover:opacity-80 transition-opacity" size={16} />
            </div>
            
            <div className="flex gap-4 text-xs uppercase tracking-widest opacity-60 justify-center" style={{ fontFamily: 'var(--font-header)' }}>
                {['All', 'Journal', 'Sketches'].map(cat => (
                    <button 
                        key={cat} 
                        onClick={() => setCategoryFilter(cat)}
                        className={`transition-all hover:opacity-100 active:scale-95 ${categoryFilter === cat ? 'opacity-100 font-bold underline decoration-1 underline-offset-4' : 'opacity-60'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>

        {/* Table of Contents List */}
        <div className="flex-1 overflow-y-auto os-scroll pr-2 relative z-10">
            <ul className="space-y-4">
                {filteredNotes.length > 0 ? (
                    filteredNotes.map(note => (
                        <li 
                            key={note.id}
                            onClick={() => onSelectNote(note.id)}
                            className="group cursor-pointer active:scale-[0.98] transition-transform origin-left"
                        >
                            <div className="flex items-baseline relative">
                                {activeNoteId === note.id && (
                                    <div className="absolute -left-6 top-1 opacity-80 text-amber-700">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></svg>
                                    </div>
                                )}
                                
                                <span className={`text-lg leading-none transition-colors ${activeNoteId === note.id ? 'font-bold opacity-100' : 'opacity-70 group-hover:opacity-100'}`} style={{ fontFamily: 'var(--font-body)' }}>
                                    {note.title || 'Untitled'}
                                </span>
                                
                                <div className="flex-1 mx-2 border-b border-dotted border-current opacity-30 h-1"></div>
                                
                                <span className="italic text-sm opacity-60 whitespace-nowrap">
                                    {formatShortDate(note.entryDate || note.lastModified)}
                                </span>
                            </div>
                        </li>
                    ))
                ) : (
                    <li className="text-center opacity-40 italic mt-10">Empty page...</li>
                )}
            </ul>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-col gap-3 justify-center items-center relative z-10">
            <button 
                onClick={onCreateNote}
                className="group relative px-6 py-2 text-sm opacity-80 hover:opacity-100 transition-all hover:scale-105 active:scale-95 w-full max-w-[200px]"
                style={{ fontFamily: 'var(--font-header)' }}
            >
                <svg className="absolute inset-0 w-full h-full opacity-40 group-hover:opacity-60 transition-opacity" fill="none" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <path d="M2,2 L98,2 L98,38 L2,38 Z" stroke="currentColor" strokeWidth="1" strokeDasharray="4 2" vectorEffect="non-scaling-stroke"/>
                </svg>
                <span className="relative flex items-center justify-center gap-2">
                    <Plus size={14} /> New Entry
                </span>
            </button>

            {!isCalendarConnected ? (
                 <button 
                    onClick={handleConnectCalendar}
                    disabled={isSyncing}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-wider opacity-50 hover:opacity-80 transition-all active:scale-95"
                 >
                    {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
                    Connect Google Calendar
                 </button>
            ) : (
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[#689f38]">
                    <CalendarCheck size={12} />
                    Calendar Sync Active
                </div>
            )}
        </div>
        
        <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] opacity-30 tracking-[0.2em]">
            PAGE I
        </div>
      </div>


      {/* --- RIGHT PAGE: JOURNAL ENTRY --- */}
      <div className="w-1/2 h-full flex flex-col relative group px-12 pt-8 pb-12 overflow-hidden pl-14">
        
        {/* Dynamic Backgrounds (Paper Texture & Grid) */}
        <div className="absolute inset-0 pointer-events-none z-0 mix-blend-multiply opacity-50" style={{ backgroundImage: 'var(--paper-pattern)' }}></div>
        <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundImage: 'var(--page-line)', backgroundSize: '100% 28px', backgroundPosition: '0 24px' }}></div>
        
        {/* VFX Layer (Particles) */}
        <VFXLayer type={(window.getComputedStyle(document.body).getPropertyValue('--vfx-type') as any) || 'none'} />

        {activeNote ? (
            <>
                 {/* HEADER AREA */}
                 <div className="h-[112px] flex flex-col justify-end pb-2 relative z-20 flex-shrink-0">
                    
                    <div className="flex justify-between items-end mb-2">
                         <div 
                             className="relative group cursor-pointer"
                             onClick={() => dateInputRef.current?.showPicker()}
                         >
                            <h2 className="text-2xl flex items-center gap-2 opacity-90 transition-opacity hover:opacity-100" style={{ fontFamily: 'var(--font-display)' }}>
                                {formatDate(activeNote.entryDate)}
                                <Calendar size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />
                            </h2>
                             <input 
                                ref={dateInputRef}
                                type="date"
                                value={getInputValue(activeNote.entryDate)}
                                onChange={(e) => handleDateChange(activeNote.id, e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/50 backdrop-blur-[1px] px-2 rounded-lg shadow-sm border border-current/10 transform translate-y-2 group-hover:translate-y-0">
                            <button
                                onClick={toggleDictation}
                                className={`p-1.5 transition-all rounded-full hover:scale-110 active:scale-90 ${isListening ? 'text-red-600 bg-red-50 animate-pulse' : 'hover:bg-black/5 opacity-60 hover:opacity-100'} ${micError ? 'text-amber-500' : ''}`}
                                title={micError ? "Microphone Access Denied" : "Dictate"}
                            >
                                {micError ? <AlertCircle size={14} /> : (isListening ? <Mic size={14} /> : <MicOff size={14} />)}
                            </button>
                            <div className="w-px h-3 bg-current opacity-20 mx-1"></div>

                            {isCalendarConnected && (
                                <>
                                    <button 
                                        onClick={handleImportAgenda}
                                        className="p-1.5 transition-all hover:bg-black/5 rounded-full opacity-60 hover:opacity-100 hover:scale-110 active:scale-90"
                                        title="Import Today's Agenda"
                                    >
                                        <CalendarCheck size={14} />
                                    </button>
                                    <div className="w-px h-3 bg-current opacity-20 mx-1"></div>
                                </>
                            )}

                            <button 
                                 onClick={() => setIsSketching(false)}
                                 className={`p-1.5 transition-all hover:opacity-100 hover:scale-110 active:scale-90 ${!isSketching ? 'opacity-100 scale-110 font-bold' : 'opacity-40'}`}
                                 title="Write"
                            >
                                <Type size={14} />
                            </button>
                            <span className="opacity-20">|</span>
                            {tools.map((t) => (
                                 <button
                                    key={t.id}
                                    onClick={() => handleToolSelect(t.id, t.color, t.width)}
                                    className={`p-1.5 transition-all hover:opacity-100 hover:scale-110 active:scale-90 ${isSketching && toolType === t.id ? 'opacity-100 scale-110' : 'opacity-40'}`}
                                    title={t.label}
                                 >
                                     <t.icon size={14} />
                                 </button>
                            ))}
                            <button onClick={() => handleUpdateSketches([])} className="p-1.5 opacity-40 hover:opacity-100 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors hover:scale-110 active:scale-90">
                                <Eraser size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="relative border-b border-current mb-1 opacity-90">
                        <input 
                            type="text" 
                            value={activeNote.title}
                            onChange={(e) => onUpdateNote(activeNote.id, { title: e.target.value })}
                            placeholder="Title..."
                            className="aged-placeholder w-full bg-transparent border-none focus:outline-none text-3xl font-bold placeholder-current/40 leading-none pb-1"
                            style={{ fontFamily: 'var(--font-header)' }}
                        />
                    </div>
                 </div>

                 {/* CONTENT AREA */}
                 <div className="relative flex-1 min-h-0 z-20">
                     <textarea 
                        value={activeNote.content}
                        onChange={(e) => onUpdateNote(activeNote.id, { content: e.target.value })}
                        placeholder="Write your thoughts..."
                        className="aged-placeholder w-full h-full resize-none border-none focus:outline-none bg-transparent text-lg os-scroll z-10 relative"
                        spellCheck={false}
                        style={{ 
                            lineHeight: '28px', 
                            paddingTop: '6px', 
                            pointerEvents: isSketching ? 'none' : 'auto',
                            backgroundImage: 'none',
                            fontFamily: 'var(--font-body)',
                            textShadow: 'var(--ink-glow, none)' 
                        }}
                     />

                     <SketchLayer 
                        strokes={activeNote.sketches || []}
                        onChange={handleUpdateSketches}
                        isActive={isSketching}
                        toolType={toolType}
                        color={toolColor === 'var(--ink-color)' ? '#2c1b18' : toolColor}
                        strokeWidth={toolWidth}
                     />
                 </div>
                 
                 <div className="absolute bottom-4 left-0 right-0 flex justify-between px-10 items-center pointer-events-none z-30">
                     <button onClick={onPrev} className="p-2 opacity-40 hover:opacity-80 transition-all hover:scale-110 active:scale-90 pointer-events-auto">
                         <ChevronLeft size={16} />
                     </button>
                     <div className="text-[10px] uppercase tracking-[0.2em] opacity-30">
                         PAGE II
                     </div>
                     <button onClick={onNext} className="p-2 opacity-40 hover:opacity-80 transition-all hover:scale-110 active:scale-90 pointer-events-auto">
                         <ChevronRight size={16} />
                     </button>
                 </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                <Bookmark size={32} strokeWidth={1} />
                <p className="mt-4 italic text-lg" style={{ fontFamily: 'var(--font-header)' }}>Select an entry from the index.</p>
            </div>
        )}
      </div>

    </div>
  );
};
