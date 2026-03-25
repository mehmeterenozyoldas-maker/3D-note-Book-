
import React, { useRef, useEffect, useState } from 'react';
import { ThemeConfig } from '../types';

interface Device3DProps {
  angle: number;
  rotation: { x: number; y: number };
  position: { x: number; y: number };
  turning: 'next' | 'prev' | null;
  onTurnPage: (direction: 'next' | 'prev') => void;
  theme?: ThemeConfig;
  children: React.ReactNode;
}

export const Device3D: React.FC<Device3DProps> = ({ angle, rotation, position, turning, onTurnPage, theme, children }) => {
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightShadowRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const curlRef = useRef<HTMLDivElement>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Dynamic Shadow Refs for the stationary pages beneath the turning leaf
  const leftPageShadowRef = useRef<HTMLDivElement>(null);
  const rightPageShadowRef = useRef<HTMLDivElement>(null);

  // Refs for dynamic materials
  const frontCoverRef = useRef<HTMLDivElement>(null);
  const backCoverRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(1);
  const dragStartRef = useRef<{ x: number, target: 'left' | 'right' } | null>(null);

  // Constants matching CSS
  const SPINE_WIDTH = 50;
  const THICKNESS = 18;

  useEffect(() => {
    const handleResize = () => {
      const baseWidth = 900; 
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const widthScale = Math.min(1, (windowWidth - 40) / baseWidth);
      const heightScale = Math.min(1, (windowHeight - 100) / 600); 
      setScale(Math.min(widthScale, heightScale));
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Geometry Logic
  useEffect(() => {
    if (rightPanelRef.current && rightShadowRef.current && spineRef.current) {
      
      // Normalized openness (0 = closed, 1 = flat)
      const t = angle / 180;
      
      // 1. Right Panel Rotation
      // 0 -> -180deg
      const rightPanelRot = angle - 180;

      // 2. Right Panel Shift (X)
      // When flat (t=1): x = 0.
      // When closed (t=0): x = -SPINE_WIDTH (moves left to overlap Left Panel).
      const xOffset = -(1 - t) * SPINE_WIDTH;

      // 3. Right Panel Lift (Z)
      // When flat (t=1): z = 0.
      // When closed (t=0): z = THICKNESS.
      // Note: Because Right Panel is rotated 180deg, Local -Z points to Global +Z.
      // To move Global +Z, we translate Local -Z.
      const zOffset = -(1 - t) * THICKNESS;

      rightPanelRef.current.style.transform = `translateX(${xOffset}px) rotateY(${rightPanelRot}deg) translateZ(${zOffset}px)`;
      
      // 4. Spine Shift (X) & Rotation
      // Spine center should move to -25 to be at the hinge when closed.
      const spineX = -(1 - t) * (SPINE_WIDTH / 2);
      
      // Spine Rotation: 0 -> -90deg
      const spineRot = rightPanelRot / 2;

      spineRef.current.style.transform = `translateX(calc(-50% + ${spineX}px)) translateZ(calc(var(--thickness) / -2)) rotateY(${spineRot}deg)`;

      // Z-Index Sorting
      // When almost closed, Right Panel must be on top.
      if (angle < 90) {
          if (rightPanelRef.current) rightPanelRef.current.style.zIndex = '100';
      } else {
          if (rightPanelRef.current) rightPanelRef.current.style.zIndex = 'auto';
      }

      // Shadow & Curl
      const shadowOpacity = (1 - t) * 0.6;
      rightShadowRef.current.style.background = `linear-gradient(to right, rgba(0,0,0,${shadowOpacity}), transparent 20%)`;
      
      if (curlRef.current) {
        let curlOpacity = 0;
        if (angle < 178 && angle > 90) {
            curlOpacity = Math.min(1, Math.max(0, (angle - 90) / 60)) * Math.min(1, (178 - angle) / 10);
        }
        curlRef.current.style.opacity = (curlOpacity * 0.8).toString();
      }
    }
  }, [angle]);

  // Handle Turning Shadows (The shadow cast on the page below)
  useEffect(() => {
    // We trigger a CSS transition on the shadow overlays when turning
    if (turning === 'next' && leftPageShadowRef.current) {
        leftPageShadowRef.current.style.opacity = '0.6';
        // Reset after animation
        setTimeout(() => { if (leftPageShadowRef.current) leftPageShadowRef.current.style.opacity = '0'; }, 800);
    } else if (turning === 'prev' && rightPageShadowRef.current) {
        rightPageShadowRef.current.style.opacity = '0.6';
        setTimeout(() => { if (rightPageShadowRef.current) rightPageShadowRef.current.style.opacity = '0'; }, 800);
    }
  }, [turning]);

  // Dynamic Lighting
  useEffect(() => {
    if (deviceRef.current) {
       deviceRef.current.style.transform = `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`;
    }

    const lightX = 50 + (rotation.y * 1.5) + (angle * 0.1); 
    const lightY = 50 + (rotation.x * 1.5);

    if (frontCoverRef.current) {
        frontCoverRef.current.style.backgroundPosition = `${lightX}% ${lightY}%, 0 0`;
    }
    
    if (backCoverRef.current) {
        backCoverRef.current.style.backgroundPosition = `${lightX - 20}% ${lightY}%, 0 0`;
    }

  }, [rotation, angle]);

  const handlePointerDown = (e: React.PointerEvent, side: 'left' | 'right') => {
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'input' || 
        (e.target as HTMLElement).tagName.toLowerCase() === 'textarea') {
        return;
    }
    dragStartRef.current = { x: e.clientX, target: side };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const diff = e.clientX - dragStartRef.current.x;
    const threshold = 50; 
    if (dragStartRef.current.target === 'right' && diff < -threshold) {
        onTurnPage('next');
    } else if (dragStartRef.current.target === 'left' && diff > threshold) {
        onTurnPage('prev');
    }
    dragStartRef.current = null;
  };

  const handleMouseMove = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    containerRef.current.style.setProperty('--mouse-x', x.toString());
    containerRef.current.style.setProperty('--mouse-y', y.toString());
  };

  return (
    <div 
        ref={containerRef}
        className="scene-container w-[800px] h-[700px] flex items-center justify-center -translate-y-5 transition-transform duration-300 ease-out origin-center"
        style={{ 
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            ...theme 
        }}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerMove={handleMouseMove}
    >
      <div ref={deviceRef} className="device-layer relative transition-transform duration-100 ease-linear w-full h-full">
        
        <div ref={spineRef} className="hinge-spine">
          <div className="spine-ridges"></div>
        </div>

        {/* LEFT PANEL */}
        <div 
            ref={leftPanelRef}
            className="panel left"
            onPointerDown={(e) => handlePointerDown(e, 'left')}
        >
          <div className="side top"></div>
          <div className="side bottom"></div>
          <div className="side outer"></div>
          <div className="side inner"></div>
          
          <div ref={backCoverRef} className="face back">
            <div className="hinge-crease"></div>
            <div className="stitched-border"></div>
            <div className="back-emblem"></div>
            <div className="corner-decor corner-tl"></div>
            <div className="corner-decor corner-bl"></div>
          </div>
          
          <div className="face front">
            <div className="screen-content">
              {/* Dynamic Shadow Recipient */}
              <div ref={leftPageShadowRef} className="page-shadow-overlay"></div>
              
              <div className="gutter-shadow"></div>
              <div className="screen-inner">
                 {children}
              </div>
              <div className="glare"></div>
              <div className="shadow-fold" style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.1), transparent 15%)' }}></div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div 
            ref={rightPanelRef} 
            className="panel right"
            onPointerDown={(e) => handlePointerDown(e, 'right')}
        >
          <div className="side top"></div>
          <div className="side bottom"></div>
          <div className="side outer"></div>
          <div className="side inner"></div>
          
          <div ref={frontCoverRef} className="face back">
            <div className="hinge-crease"></div>
            <div className="stitched-border"></div>
            <div className="cover-emblem"></div>
            <div className="corner-decor corner-tr"></div>
            <div className="corner-decor corner-br"></div>
          </div>

          <div className="face front">
            <div className="screen-content">
               {/* Dynamic Shadow Recipient */}
               <div ref={rightPageShadowRef} className="page-shadow-overlay" style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.4) 0%, transparent 40%)' }}></div>

              <div className="gutter-shadow"></div>
              <div className="screen-inner">
                 {children}
              </div>
              
              <div className="glare"></div>
              <div ref={rightShadowRef} className="shadow-fold"></div>
              <div ref={curlRef} className="page-curl-corner"></div>
            </div>
          </div>
        </div>
        
        {/* TURNING LEAF - PHYSICS ENHANCED */}
        {turning && (
            <div className={`turning-leaf ${turning === 'next' ? 'animate-next' : 'animate-prev'}`}>
                {/* Front Face: The page you are turning away from */}
                <div className="face front" style={{ background: 'var(--page-bg)', overflow: 'hidden' }}>
                    <div className="absolute top-0 bottom-0 left-0 w-8 bg-gradient-to-r from-black/5 to-transparent mix-blend-multiply z-10"></div>
                     
                    {/* Visual Approximation of Content */}
                    <div className="absolute inset-0 opacity-20 p-8" style={{ background: 'var(--page-line)', backgroundSize: '100% 28px', backgroundPosition: '0 24px' }}>
                         <div className="w-1/2 h-8 bg-black/20 mb-8 mx-auto rounded"></div>
                         <div className="space-y-4">
                             <div className="w-full h-2 bg-black/20 rounded"></div>
                             <div className="w-5/6 h-2 bg-black/20 rounded"></div>
                             <div className="w-full h-2 bg-black/20 rounded"></div>
                             <div className="w-4/5 h-2 bg-black/20 rounded"></div>
                         </div>
                    </div>
                </div>

                {/* Back Face: The backside of the turning page (Usually just paper texture) */}
                <div className="face back" style={{ background: 'var(--page-bg)', overflow: 'hidden' }}>
                     <div className="absolute top-0 bottom-0 right-0 w-8 bg-gradient-to-l from-black/5 to-transparent mix-blend-multiply z-10"></div>
                     <div className="absolute inset-0 opacity-20 p-8" style={{ background: 'var(--page-line)', backgroundSize: '100% 28px', backgroundPosition: '0 24px' }}></div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
