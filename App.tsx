
import React, { useState, useEffect, useRef } from 'react';
import { Device3D } from './components/Device3D';
import { KamiOS } from './components/KamiOS';
import { Note, Notebook, INITIAL_LIBRARY } from './types';
import { MousePointer2, Library, Move3d, Scan, Hand, Sparkles, Keyboard, Hexagon, Snowflake } from 'lucide-react';
import { HandController } from './components/HandController';

export default function App() {
  // --- View State ---
  const [viewMode, setViewMode] = useState<'shelf' | 'desk'>('shelf');
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  
  // --- Hand Tracking State ---
  const [isMagicMode, setIsMagicMode] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const [pinchGap, setPinchGap] = useState(0.5); // 0 = touching, 1 = far
  const [cursorPos, setCursorPos] = useState({ x: 0.5, y: 0.5 });
  const prevPinchRef = useRef(false);

  // --- Interaction Guards ---
  const isTypingRef = useRef(false);
  // Using generic 'number' type for timeout to avoid NodeJS/Browser type conflicts in strict environments
  const typingTimeoutRef = useRef<number | null>(null);
  const [showTypingGuard, setShowTypingGuard] = useState(false);

  // --- Device Physics State ---
  const [angle, setAngle] = useState(175); 
  const [deviceRotation, setDeviceRotation] = useState({ x: 25, y: 0 });
  const [devicePosition, setDevicePosition] = useState({ x: 0, y: 0 });
  const [turning, setTurning] = useState<'next' | 'prev' | null>(null);
  
  // Interaction Refs
  const isDragging = useRef(false);
  const dragMode = useRef<'orbit' | 'pan' | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // --- Data State (Library Tree) ---
  const [library, setLibrary] = useState<Notebook[]>(() => {
    try {
      const saved = localStorage.getItem('kami-library-data');
      return saved ? JSON.parse(saved) : INITIAL_LIBRARY;
    } catch (e) {
      console.warn('Failed to load library from local storage', e);
      return INITIAL_LIBRARY;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('kami-library-data', JSON.stringify(library));
    } catch (e) {
      console.warn('Failed to save library to local storage', e);
    }
  }, [library]);

  // --- Typing Guard: Pause Orbit when using Keyboard ---
  useEffect(() => {
    const handleKeyDown = () => {
        if (!isMagicMode) return;
        
        isTypingRef.current = true;
        setShowTypingGuard(true);
        
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        
        // Cast to unknown then number to satisfy potentially strict compilers in mixed environments
        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            setShowTypingGuard(false);
        }, 1500) as unknown as number; 
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [isMagicMode]);


  const currentNotebook = library.find(n => n.id === activeNotebookId) || null;
  const currentNotes = currentNotebook ? currentNotebook.notes : [];

  // --- Audio Context ---
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = (type: 'turn' | 'slide' | 'click' | 'magic') => {
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;
    
    // Magic Click Sound
    if (type === 'click' || type === 'magic') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(type === 'magic' ? 800 : 400, t);
        osc.frequency.exponentialRampToValueAtTime(type === 'magic' ? 1200 : 200, t + 0.3);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.type = 'sine'; // Cold sine
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(t + 0.3);
        return;
    }

    // Physical Sounds (Turn / Slide)
    const duration = type === 'turn' ? 0.7 : 0.6;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        // Brown/Pink noise for texture
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Gain up
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    // Swish effect: Bandpass sweeping high to simulate paper friction
    filter.type = 'bandpass';
    filter.Q.value = 0.6;
    
    if (type === 'turn') {
        // Fast sweep for "Flip" sound
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.exponentialRampToValueAtTime(3000, t + 0.3);
        filter.frequency.exponentialRampToValueAtTime(500, t + 0.6);
    } else {
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.linearRampToValueAtTime(600, t + duration);
    }
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  };
  
  // Audio Helper
  let lastOut = 0;

  // --- View Control Logic ---
  const handleWheel = (e: React.WheelEvent) => {
    if (viewMode !== 'desk') return;
    const sensitivity = 0.2;
    setAngle(prev => Math.max(0, Math.min(180, prev - e.deltaY * sensitivity)));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (viewMode !== 'desk' || isMagicMode) return; // Disable mouse drag in magic mode

    const target = e.target as HTMLElement;
    const isInteractive = ['input', 'textarea', 'button', 'select', 'a'].includes(target.tagName.toLowerCase()) || target.closest('button');
    if (isInteractive) return;
    if (target.closest('.device-layer') || target.closest('.hinge-spine')) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    if (e.button === 1 || (e.button === 0 && !e.shiftKey)) {
        dragMode.current = 'orbit';
    } else if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
        dragMode.current = 'pan';
    } else {
        dragMode.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || viewMode !== 'desk' || isMagicMode) return;
    e.preventDefault();

    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;

    if (dragMode.current === 'orbit') {
        setDeviceRotation(prev => ({
            x: Math.max(-60, Math.min(60, prev.x - deltaY * 0.3)), 
            y: prev.y + deltaX * 0.3
        }));
    } else if (dragMode.current === 'pan') {
        setDevicePosition(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY
        }));
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
        isDragging.current = false;
        dragMode.current = null;
        e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  // --- Hand Control Handler ---
  const handleHandUpdate = (data: { 
    rotation?: { x: number, y: number }, 
    position?: { x: number, y: number },
    cursor?: { x: number, y: number },
    pinching: boolean,
    pinchDistance?: number,
    gesture: 'swipe_left' | 'swipe_right' | 'fist' | null
  }) => {
      // 1. Rotation (Left Hand) - BLOCKED IF TYPING
      if (data.rotation && !isTypingRef.current) {
          if (data.gesture === 'fist') {
             // Reset
             setDeviceRotation({ x: 25, y: 0 });
          } else {
             setDeviceRotation(data.rotation);
          }
      }
      
      // 2. Position (Pinch Hold)
      if (viewMode === 'desk') {
          if (data.position && data.pinching) {
              setDevicePosition(data.position);
          }
      } 

      // 3. Cursor (Right Hand)
      if (data.cursor) {
          setCursorPos(data.cursor);
      }
      setIsPinching(data.pinching);
      if (data.pinchDistance !== undefined) {
          setPinchGap(data.pinchDistance);
      }

      // 4. Gestures (Swipe)
      if (viewMode === 'desk' && data.gesture) {
          if (data.gesture === 'swipe_left') handleTurnNote('next');
          if (data.gesture === 'swipe_right') handleTurnNote('prev');
      }
  };

  // --- Virtual Click Engine ---
  useEffect(() => {
      if (!isMagicMode) return;

      // Detect Pinch START (Tap)
      if (isPinching && !prevPinchRef.current) {
          // Trigger Click
          const screenX = cursorPos.x * window.innerWidth;
          const screenY = cursorPos.y * window.innerHeight;
          
          // Use elementFromPoint to find what's under the cursor
          const el = document.elementFromPoint(screenX, screenY) as HTMLElement;
          if (el) {
              // Visual Feedback (Ripple)
              const ripple = document.createElement('div');
              Object.assign(ripple.style, {
                  position: 'fixed',
                  left: `${screenX}px`,
                  top: `${screenY}px`,
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  transform: 'translate(-50%, -50%) scale(1)',
                  pointerEvents: 'none',
                  transition: 'transform 0.4s ease-out, opacity 0.4s ease-out',
                  zIndex: '9999',
                  boxShadow: '0 0 10px rgba(255,255,255,0.4)'
              });
              document.body.appendChild(ripple);
              
              requestAnimationFrame(() => {
                  ripple.style.transform = 'translate(-50%, -50%) scale(4)';
                  ripple.style.opacity = '0';
              });
              setTimeout(() => ripple.remove(), 400);

              // Trigger actual click
              el.click();
              playSound('click');
              
              // Handle special "Shelf" book clicks if element is part of a book card
              const bookCard = el.closest('[data-book-id]');
              if (bookCard && viewMode === 'shelf') {
                  const id = bookCard.getAttribute('data-book-id');
                  if (id) openNotebook(id);
              }
          }
      }

      prevPinchRef.current = isPinching;
  }, [isMagicMode, isPinching, cursorPos, viewMode]);

  // --- Notebook Operations ---
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  
  const openNotebook = (id: string) => {
    setActiveNotebookId(id);
    const book = library.find(b => b.id === id);
    if (book && book.notes.length > 0) {
        setActiveNoteId(book.notes[0].id);
    } else {
        setActiveNoteId(null);
    }
    playSound('slide');
    setViewMode('desk');
    setAngle(175); // Reset to open
    setDeviceRotation({ x: 25, y: 0 }); // Reset camera
    setDevicePosition({ x: 0, y: 0 });
  };

  const handleTurnNote = (direction: 'next' | 'prev') => {
      if (turning || !currentNotes.length) return;
      const currentIndex = currentNotes.findIndex(n => n.id === activeNoteId);
      let nextId = activeNoteId;

      if (direction === 'next') {
          if (currentIndex < currentNotes.length - 1) nextId = currentNotes[currentIndex + 1].id;
          else return;
      } else {
          if (currentIndex > 0) nextId = currentNotes[currentIndex - 1].id;
          else return;
      }

      playSound('turn');
      setTurning(direction);
      setTimeout(() => setActiveNoteId(nextId), 400); // Updated timing to match physics
      setTimeout(() => setTurning(null), 800);
  };

  const handleUpdateNote = (id: string, updates: Partial<Note>) => {
    if (!activeNotebookId) return;
    setLibrary(prevLib => prevLib.map(book => {
        if (book.id !== activeNotebookId) return book;
        return {
            ...book,
            notes: book.notes.map(n => n.id === id ? { ...n, ...updates, lastModified: Date.now() } : n)
        };
    }));
  };

  const handleCreateNote = () => {
    if (!activeNotebookId) return;
    const newNote: Note = {
      id: Date.now().toString(),
      title: '',
      content: '',
      lastModified: Date.now(),
      entryDate: Date.now(),
      category: 'Journal'
    };
    
    setLibrary(prevLib => prevLib.map(book => {
        if (book.id !== activeNotebookId) return book;
        return { ...book, notes: [newNote, ...book.notes] };
    }));

    setTurning('prev');
    playSound('turn');
    setTimeout(() => setActiveNoteId(newNote.id), 400);
    setTimeout(() => setTurning(null), 800);
  };

  // --- RENDER ---
  
  // Calculate depth ring scale
  const ringScale = isPinching ? 1 : Math.min(4, 1 + (pinchGap * 15));
  const ringOpacity = isPinching ? 0.8 : Math.max(0.2, 1 - (pinchGap * 2));

  return (
    <div 
        className="w-full h-screen flex flex-col items-center justify-center overflow-hidden cursor-move active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={handleWheel}
    >
      
      {/* ATMOSPHERE LAYERS */}
      <div className="fog-container">
          <div className="fog-layer"></div>
          <div className="fog-layer secondary"></div>
          <div className="god-rays"></div>
          <div className="vignette"></div>
      </div>

      {/* GLOBAL: Hand Tracking Controller */}
      {isMagicMode && (
          <>
            <HandController onUpdate={handleHandUpdate} />
            
            {/* Visual Feedback: Typing Guard */}
            {showTypingGuard && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full text-white/80 border border-white/10 animate-fade-in-up">
                    <Keyboard size={14} />
                    <span className="text-xs tracking-wider uppercase font-mono">Orbit Paused</span>
                </div>
            )}

            {/* Virtual Cursor with Z-Axis Depth Ring */}
            <div 
                className={`fixed z-[9999] pointer-events-none transition-transform duration-75 ease-linear flex flex-col items-center gap-1`}
                style={{ 
                    left: 0, 
                    top: 0,
                    transform: `translate3d(${cursorPos.x * window.innerWidth}px, ${cursorPos.y * window.innerHeight}px, 0)`
                }}
            >
                {/* Dynamic Depth Ring */}
                <div 
                    className="absolute w-12 h-12 rounded-full border-2 border-white/50 flex items-center justify-center transition-all duration-75 ease-out"
                    style={{
                        transform: `translate(-50%, -50%) scale(${ringScale})`,
                        opacity: ringOpacity,
                        borderColor: isPinching ? '#fff' : 'rgba(255,255,255,0.4)'
                    }}
                ></div>

                {/* Core Cursor Dot */}
                <div 
                    className={`w-2 h-2 rounded-full shadow-[0_0_10px_#fff] transition-all duration-200 transform -translate-x-1/2 -translate-y-1/2 ${isPinching ? 'bg-white scale-125' : 'bg-white/80 scale-100'}`}
                ></div>
            </div>
          </>
      )}

      {/* GLOBAL: Magic Mode Toggle */}
      <div className="fixed top-8 left-8 z-[100] flex flex-col gap-4 items-start">
         {viewMode === 'desk' && (
             <button 
                onClick={() => setViewMode('shelf')}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-all hover:translate-x-1 font-serif uppercase tracking-widest text-xs mb-2 pl-1"
                style={{ fontFamily: 'Cinzel Decorative' }}
            >
                <Library size={16} /> <span className="pt-1">Back to Hall</span>
            </button>
         )}

         <button 
            onClick={() => {
                const newState = !isMagicMode;
                setIsMagicMode(newState);
                if (newState) playSound('magic');
            }}
            className={`flex items-center gap-2 transition-all font-serif uppercase tracking-widest text-xs border rounded-sm px-4 py-2 backdrop-blur-sm ${isMagicMode ? 'bg-zinc-800/90 text-white border-zinc-500 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-black/20 text-zinc-500 border-zinc-700/30 hover:border-zinc-500 hover:text-zinc-300 hover:bg-black/40'}`}
            style={{ fontFamily: 'Cinzel Decorative' }}
        >
            {isMagicMode ? <Sparkles size={16} className="animate-spin-slow" /> : <Hexagon size={16} />} 
            <span className="pt-1">{isMagicMode ? 'Rune Sight' : 'Mortal View'}</span>
        </button>
      </div>


      {/* --- SHELF VIEW (THE GREAT HALL) --- */}
      {viewMode === 'shelf' && (
          <div 
            className="absolute inset-0 z-50 flex flex-col items-center pt-24 perspective-[1000px] overflow-hidden"
          >
              <div 
                className="w-full h-full flex flex-col items-center transition-transform duration-300 ease-out transform-style-3d"
                style={{
                    transform: isMagicMode 
                        ? `rotateX(${deviceRotation.x * 0.1}deg) rotateY(${deviceRotation.y * 0.1}deg)` 
                        : 'none'
                }}
              >
                  <h1 className="text-5xl font-serif text-zinc-300 mb-20 tracking-[0.2em] opacity-80 animate-fade-in-up drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]" style={{ fontFamily: 'Cinzel Decorative' }}>
                      ARCHIVES
                  </h1>
                  
                  {/* THE ALTAR / SLAB */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-20 max-w-7xl px-8 w-full perspective-[2000px]">
                      {library.map((book, i) => (
                          <div 
                            key={book.id}
                            data-book-id={book.id}
                            onClick={() => openNotebook(book.id)}
                            className="group flex flex-col items-center gap-8 cursor-pointer animate-fade-in-up relative perspective-[1000px]"
                            style={{ animationDelay: `${i * 150}ms` }}
                          >
                              {/* Runic Halo on Hover */}
                              <div className="rune-halo border-zinc-500/20"></div>

                              {/* 3D BOOK STRUCTURE */}
                              <div className="shelf-book">
                                   {/* FRONT FACE */}
                                  <div 
                                    className="shelf-face front"
                                    style={{
                                        backgroundColor: book.theme['--cover-color'],
                                        ...book.theme 
                                    }}
                                  > 
                                     {/* Spine Hint */}
                                     <div className="absolute left-0 top-0 bottom-0 w-6 bg-black/40 rounded-l mix-blend-multiply"></div>
                                     
                                     {/* Emblem Preview (Embossed Compass) */}
                                     <div 
                                        className="cover-emblem absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                                        style={{ 
                                            // The style overrides from book.theme still apply (image/opacity)
                                            // but are now composed with the .cover-emblem class
                                        }}
                                     ></div>

                                     {/* Corner Details */}
                                     <div className="absolute top-0 right-0 w-8 h-8 opacity-80" style={{ backgroundImage: book.theme['--corner-image'] }}></div>
                                     <div className="absolute bottom-0 right-0 w-8 h-8 opacity-80 transform rotate-180" style={{ backgroundImage: book.theme['--corner-image'] }}></div>
                                     
                                     {/* Specular Highlight */}
                                     <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                                  </div>

                                  {/* SPINE FACE (Left) */}
                                  <div className="shelf-face spine" style={{ backgroundColor: book.theme['--spine-color'] }}></div>
                                  
                                  {/* PAGES TOP */}
                                  <div className="shelf-face pages-top"></div>
                                  
                                  {/* PAGES RIGHT */}
                                  <div className="shelf-face pages-right"></div>
                              </div>
                              
                              {/* Altar Pedestal */}
                              <div className="altar-slab"></div>

                              <div className="text-center relative z-20 mt-4 transform translate-z-20">
                                  <h3 className="text-zinc-300 text-xl mb-1 group-hover:text-white transition-colors tracking-widest uppercase" style={{ fontFamily: 'Cinzel Decorative' }}>{book.title}</h3>
                                  <p className="text-zinc-500 font-mono text-xs">{book.notes.length} scrolls</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- DESK VIEW --- */}
      {viewMode === 'desk' && currentNotebook && (
          <>
            <Device3D 
                angle={angle} 
                rotation={deviceRotation} 
                position={devicePosition}
                turning={turning}
                onTurnPage={handleTurnNote}
                theme={currentNotebook.theme}
            >
                <KamiOS 
                notes={currentNotebook.notes}
                activeNoteId={activeNoteId}
                onSelectNote={(id) => {
                    const cIdx = currentNotebook.notes.findIndex(n => n.id === activeNoteId);
                    const nIdx = currentNotebook.notes.findIndex(n => n.id === id);
                    if (nIdx > cIdx) handleTurnNote('next');
                    else if (nIdx < cIdx) handleTurnNote('prev');
                }}
                onUpdateNote={handleUpdateNote}
                onCreateNote={handleCreateNote}
                onNext={() => handleTurnNote('next')}
                onPrev={() => handleTurnNote('prev')}
                />
            </Device3D>
            
            {/* Gesture Instructions */}
            <div className="fixed bottom-8 flex gap-8 text-zinc-500 opacity-60 font-mono text-[10px] select-none pointer-events-none tracking-widest uppercase items-center z-50">
                {isMagicMode ? (
                     <>
                        <div className="flex items-center gap-2">
                            <Move3d size={14} /> 
                            <span>Left Palm: Orbit</span>
                        </div>
                        <div className="w-px h-4 bg-white/20"></div>
                        <div className="flex items-center gap-2">
                            <Scan size={14} /> 
                            <span>Right Index: Cursor</span>
                        </div>
                         <div className="w-px h-4 bg-white/20"></div>
                        <div className={`flex items-center gap-2 transition-all duration-200 ${isPinching ? 'text-zinc-200 font-bold scale-110' : ''}`}>
                            <Hand size={14} /> 
                            <span>Pinch: {viewMode === 'desk' ? 'Drag' : 'Click'}</span>
                        </div>
                     </>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <MousePointer2 size={12} /> Orbit
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold border border-zinc-600 rounded px-1 text-[8px]">SHIFT</span> + Drag Pan
                        </div>
                        <div className="flex items-center gap-2">
                            Scroll to Close
                        </div>
                    </>
                )}
            </div>
          </>
      )}

    </div>
  );
}
