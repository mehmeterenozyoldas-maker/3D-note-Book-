
import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Loader2, Hand, CameraOff } from 'lucide-react';

interface HandControllerProps {
  onUpdate: (data: { 
    rotation?: { x: number, y: number }, 
    position?: { x: number, y: number },
    cursor?: { x: number, y: number },
    pinching: boolean,
    pinchDistance?: number,
    gesture: 'swipe_left' | 'swipe_right' | 'fist' | null
  }) => void;
}

const LER_ALPHA = 0.2; 
const ROT_ALPHA = 0.08; 
const PINCH_THRESHOLD = 0.06;
const SWIPE_THRESHOLD = 0.035; // Lowered from 0.05 for higher sensitivity
const SWIPE_COOLDOWN = 800; 

const lerp = (start: number, end: number, amt: number) => {
  return (1 - amt) * start + amt * end;
};

export const HandController: React.FC<HandControllerProps> = ({ onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const requestRef = useRef<number>();
  
  // State Tracking for smoothing
  const targetState = useRef({ rotX: 0, rotY: 0, posX: 0, posY: 0, curX: 0.5, curY: 0.5 });
  const currentState = useRef({ rotX: 0, rotY: 0, posX: 0, posY: 0, curX: 0.5, curY: 0.5 });
  
  // Gesture Tracking History
  const lastGestureTime = useRef(0);
  const prevRightHandX = useRef(0);
  
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        
        if (!isMounted) return;

        handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 }
            } 
        });
        
        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', predict);
        }
        if (isMounted) setLoading(false);
      } catch (err: any) {
        console.error(err);
        if (isMounted) {
            let msg = "Failed to initialize vision.";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg = "Camera permission denied. Please allow camera access.";
            } else if (err.message) {
                msg = err.message;
            }
            setError(msg);
            setLoading(false);
        }
      }
    };

    init();

    return () => {
       isMounted = false;
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
       if (videoRef.current?.srcObject) {
         const stream = videoRef.current.srcObject as MediaStream;
         stream.getTracks().forEach(t => t.stop());
       }
    };
  }, []);

  const predict = async () => {
    if (!handLandmarkerRef.current || !videoRef.current) return;
    
    if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        requestRef.current = requestAnimationFrame(predict);
        return;
    }

    let results;
    try {
        results = handLandmarkerRef.current.detectForVideo(videoRef.current, performance.now());
    } catch (e) {
        requestRef.current = requestAnimationFrame(predict);
        return;
    }
    
    let isPinching = false;
    let pinchDistance = 1.0;
    let detectedGesture: 'swipe_left' | 'swipe_right' | 'fist' | null = null;
    let hasLeftHand = false;
    let hasRightHand = false;
    
    if (results && results.landmarks && results.handedness) {
        for (let i = 0; i < results.landmarks.length; i++) {
            const landmarks = results.landmarks[i];
            const handednessEntry = results.handedness[i]?.[0];
            
            if (!landmarks || !handednessEntry) continue;

            const mpLabel = handednessEntry.categoryName; 
            
            // --- USER LEFT HAND (Orbit & Tilt) ---
            if (mpLabel === 'Right') { 
                hasLeftHand = true;
                const palm = landmarks[0]; 
                
                const fingersClosed = landmarks[8].y > landmarks[5].y && landmarks[12].y > landmarks[9].y;
                
                if (fingersClosed) {
                    detectedGesture = 'fist'; 
                    targetState.current.rotX = 25; 
                    targetState.current.rotY = 0;
                } else {
                    targetState.current.rotY = (0.5 - palm.x) * 100; 
                    targetState.current.rotX = 25 + (0.5 - palm.y) * 60;
                }
            }

            // --- USER RIGHT HAND (Cursor & Action) ---
            if (mpLabel === 'Left') { 
                hasRightHand = true;
                const thumbTip = landmarks[4];
                const indexTip = landmarks[8];
                const palm = landmarks[0];

                // 1. Calculate Pinch
                pinchDistance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
                isPinching = pinchDistance < PINCH_THRESHOLD;

                // 2. Cursor Position
                targetState.current.curX = 1 - indexTip.x;
                targetState.current.curY = indexTip.y;

                // 3. Desk Pan Mapping
                if (isPinching) {
                    const targetPX = (1 - palm.x - 0.5) * 1200; 
                    const targetPY = (palm.y - 0.5) * 800;
                    targetState.current.posX = targetPX;
                    targetState.current.posY = targetPY;
                }

                // 4. Swipe Detection
                const now = performance.now();
                if (now - lastGestureTime.current > SWIPE_COOLDOWN) {
                    const dx = palm.x - prevRightHandX.current;
                    // Improved Direction Mapping:
                    // MediaPipe Raw: x=0 (Left), x=1 (Right).
                    // Video is Mirrored.
                    // If user swipes Physical Hand LEFT (West):
                    //   On screen (mirror), hand moves to LEFT side.
                    //   palm.x goes from 0.5 -> 0.1.
                    //   dx is Negative.
                    //   Result: 'swipe_left' (Next Page).
                    
                    // If user swipes Physical Hand RIGHT (East):
                    //   On screen (mirror), hand moves to RIGHT side.
                    //   palm.x goes from 0.5 -> 0.9.
                    //   dx is Positive.
                    //   Result: 'swipe_right' (Prev Page).

                    if (Math.abs(dx) > SWIPE_THRESHOLD) {
                        if (dx > SWIPE_THRESHOLD) detectedGesture = 'swipe_right';
                        if (dx < -SWIPE_THRESHOLD) detectedGesture = 'swipe_left';
                        
                        if (detectedGesture) lastGestureTime.current = now;
                    }
                }
                prevRightHandX.current = palm.x;
            }
        }
    }

    // Smooth Interpolation
    currentState.current.rotX = lerp(currentState.current.rotX, targetState.current.rotX, ROT_ALPHA);
    currentState.current.rotY = lerp(currentState.current.rotY, targetState.current.rotY, ROT_ALPHA);
    
    currentState.current.curX = lerp(currentState.current.curX, targetState.current.curX, LER_ALPHA);
    currentState.current.curY = lerp(currentState.current.curY, targetState.current.curY, LER_ALPHA);

    if (isPinching) {
       currentState.current.posX = lerp(currentState.current.posX, targetState.current.posX, LER_ALPHA);
       currentState.current.posY = lerp(currentState.current.posY, targetState.current.posY, LER_ALPHA);
    }

    onUpdate({
        rotation: hasLeftHand ? { x: currentState.current.rotX, y: currentState.current.rotY } : undefined,
        position: isPinching ? { x: currentState.current.posX, y: currentState.current.posY } : undefined,
        cursor: hasRightHand ? { x: currentState.current.curX, y: currentState.current.curY } : undefined,
        pinching: isPinching,
        pinchDistance,
        gesture: detectedGesture
    });

    requestRef.current = requestAnimationFrame(predict);
  };

  return (
    <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-2 pointer-events-none">
       {loading && <div className="bg-black/80 text-white p-2 rounded flex gap-2 items-center"><Loader2 className="animate-spin" size={16}/> <span>Init Vision...</span></div>}
       
       {error ? (
           <div className="bg-red-900/90 text-white p-3 rounded-lg text-sm max-w-[200px] flex flex-col gap-2 items-center text-center border border-red-500/50 shadow-xl">
               <CameraOff size={20} className="text-red-300" />
               <span>{error}</span>
           </div>
       ) : (
           <div className={`relative rounded-lg overflow-hidden border-2 transition-all duration-500 ${loading ? 'opacity-0' : 'opacity-80 border-[#b59e5f]/50 shadow-[0_0_20px_rgba(181,158,95,0.2)]'} group`}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-[160px] h-[120px] object-cover -scale-x-100" 
              />
              
              {/* Status Overlay */}
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white/70 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity p-2 text-center">
                   <span className="mb-1 text-[#b59e5f]">GESTURE GUIDE</span>
                   <span>LEFT: Orbit (Palm)</span>
                   <span>RIGHT: Cursor (Index)</span>
                   <span>SWIPE: Turn Page</span>
              </div>
    
              <div className="absolute top-1 left-2 text-[8px] uppercase tracking-widest text-white/70 font-mono flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`}></div> 
                {loading ? 'VISION ACTIVE' : 'LOADING'}
              </div>
           </div>
       )}
    </div>
  );
};
