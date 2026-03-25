
import React, { useRef, useState } from 'react';
import { Stroke, Point } from '../types';

interface SketchLayerProps {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  isActive: boolean;
  toolType: 'pen' | 'pencil' | 'highlighter' | 'sketch';
  color: string;
  strokeWidth: number;
}

export const SketchLayer: React.FC<SketchLayerProps> = ({ 
  strokes, 
  onChange, 
  isActive, 
  toolType,
  color,
  strokeWidth 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  // Helper: Convert points to smooth SVG path using Quadratic Bezier curves
  const getSvgPathFromPoints = (points: Point[], close = false) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} Z`;

    // Move to first point
    let d = `M ${points[0].x} ${points[0].y}`;

    // For the rest, draw quadratic curves to the midpoint of the next segment
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      
      // Control point is p1, end point is mid
      d += ` Q ${p1.x} ${p1.y} ${midX} ${midY}`;
    }
    
    // Draw line to the very last point
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;

    return d;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isActive) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newStroke: Stroke = {
      points: [{ x, y, pressure: e.pressure }],
      color,
      width: strokeWidth,
      type: toolType
    };
    setCurrentStroke(newStroke);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isActive || !currentStroke) return;
    e.preventDefault();

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentStroke(prev => {
        if (!prev) return null;
        // Simple distance filter to reduce points
        const lastPt = prev.points[prev.points.length - 1];
        const dist = Math.hypot(x - lastPt.x, y - lastPt.y);
        if (dist < 2) return prev; // Ignore small movements

        return {
            ...prev,
            points: [...prev.points, { x, y, pressure: e.pressure }]
        };
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isActive || !currentStroke) return;
    e.preventDefault();
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Commit the stroke
    onChange([...strokes, currentStroke]);
    setCurrentStroke(null);
  };

  // Render individual strokes
  const renderStroke = (stroke: Stroke, index: number) => {
    const d = getSvgPathFromPoints(stroke.points);
    let opacity = 0.9;
    let blendMode = 'normal';

    if (stroke.type === 'pencil') {
        opacity = 0.7;
    } else if (stroke.type === 'highlighter') {
        opacity = 0.3;
        blendMode = 'multiply';
    }

    return (
      <path
        key={index}
        d={d}
        stroke={stroke.color}
        strokeWidth={stroke.width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity, mixBlendMode: blendMode as any }}
      />
    );
  };

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full touch-none"
      style={{ 
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 20 : 5 // Above text when sketching, below text when not (allows clicking text)
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <defs>
          <filter id="pencilTexture">
             <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" result="noise" />
             <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
          </filter>
      </defs>
      {strokes.map((s, i) => renderStroke(s, i))}
      {currentStroke && renderStroke(currentStroke, -1)}
    </svg>
  );
};
