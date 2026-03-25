
import React from 'react';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
  type: 'pen' | 'pencil' | 'highlighter' | 'sketch';
}

export interface Note {
  id: string;
  title: string;
  content: string;
  sketches?: Stroke[];
  lastModified: number;
  entryDate: number;
  category?: string;
}

export type VFXType = 'dust' | 'embers' | 'pollen' | 'snow' | 'none';

export interface ThemeConfig extends React.CSSProperties {
  '--cover-color'?: string;
  '--cover-color-light'?: string;
  '--spine-color'?: string;
  '--metal-color'?: string;
  '--metal-shadow'?: string;
  '--page-bg'?: string;
  '--page-line'?: string;
  '--emblem-image'?: string;
  '--emblem-opacity'?: string;
  '--emblem-blend'?: string;
  '--corner-image'?: string;
  '--texture-filter'?: string; 
  '--font-display'?: string;
  
  // New Interior Design Vars
  '--font-header'?: string;
  '--font-body'?: string;
  '--ink-color'?: string;
  '--paper-pattern'?: string;
  '--paper-overlay'?: string; 
  '--vfx-type'?: VFXType;
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  type: 'journal' | 'grimoire' | 'architect' | 'botanist';
  theme: ThemeConfig;
  notes: Note[];
}

export interface DeviceState {
  angle: number;       // 0 to 180
  autoRotate: boolean;
  activeNoteId: string | null;
}

// Helper to get relative dates
const today = new Date();
today.setHours(12, 0, 0, 0);
const getRelativeDate = (daysOffset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - daysOffset);
  return d.getTime();
};

// --- ASSETS ---

// 1. COMPASS ROSE (Vegvisir / Nordic Style)
const SVG_COMPASS = `url("data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cfilter id='inset'%3E%3CfeOffset dx='0' dy='1'/%3E%3CfeGaussianBlur stdDeviation='1' result='offset-blur'/%3E%3CfeComposite operator='out' in='SourceGraphic' in2='offset-blur' result='inverse'/%3E%3CfeFlood flood-color='black' flood-opacity='1' result='color'/%3E%3CfeComposite operator='in' in='color' in2='inverse' result='shadow'/%3E%3CfeComposite operator='over' in='shadow' in2='SourceGraphic'/%3E%3C/filter%3E%3C/defs%3E%3Cg fill='none' stroke='%2318181b' stroke-width='1.5' opacity='0.8'%3E%3Ccircle cx='80' cy='80' r='58' stroke-width='1' opacity='0.4'/%3E%3Ccircle cx='80' cy='80' r='45' stroke-width='0.5' stroke-dasharray='4,4' opacity='0.3'/%3E%3Cpath d='M80 15 L80 145 M15 80 L145 80' stroke-width='1.5'/%3E%3Cpath d='M34 34 L126 126 M126 34 L34 126' stroke-width='1' opacity='0.6'/%3E%3Cpath d='M80 15 L75 25 L85 25 Z' fill='%2318181b'/%3E%3Cpath d='M80 145 L75 135 L85 135 Z' fill='%2318181b'/%3E%3Cpath d='M145 80 L135 75 L135 85 Z' fill='%2318181b'/%3E%3Cpath d='M15 80 L25 75 L25 85 Z' fill='%2318181b'/%3E%3Ccircle cx='80' cy='80' r='6' fill='%2318181b'/%3E%3Cpath d='M80 40 L70 40 M80 120 L90 120 M40 80 L40 70 M120 80 L120 90' stroke-width='2' stroke-linecap='round'/%3E%3C/g%3E%3C/svg%3E")`;

// 2. Rune Circle (Grimoire)
const SVG_RUNE = `url("data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='%2394a3b8' fill='none' stroke-width='1'%3E%3Ccircle cx='80' cy='80' r='70' stroke-dasharray='10,5' opacity='0.5'/%3E%3Cpath d='M80 10 L 90 30 L 70 30 Z' fill='%2394a3b8' opacity='0.5'/%3E%3Cpath d='M40 40 L 120 120 M 120 40 L 40 120' stroke-width='0.5' opacity='0.3'/%3E%3Crect x='60' y='60' width='40' height='40' transform='rotate(45 80 80)' opacity='0.4'/%3E%3C/g%3E%3C/svg%3E")`;

// 3. Mountain / Geo (Architect)
const SVG_MOUNTAIN = `url("data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='%23525252' fill='none' stroke-width='2'%3E%3Cpath d='M20 120 L 60 40 L 100 120' /%3E%3Cpath d='M60 120 L 100 60 L 140 120' opacity='0.7'/%3E%3Ccircle cx='100' cy='40' r='10' opacity='0.5'/%3E%3Cline x1='20' y1='130' x2='140' y2='130' stroke-width='1' opacity='0.3'/%3E%3C/g%3E%3C/svg%3E")`;

// 4. Pine / Nature
const SVG_PINE = `url("data:image/svg+xml,%3Csvg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cg stroke='%233f4c3b' fill='none' stroke-width='1.5'%3E%3Cpath d='M80 20 L 80 140' stroke-width='2' opacity='0.6'/%3E%3Cpath d='M80 40 L 50 80 M 80 40 L 110 80' /%3E%3Cpath d='M80 60 L 40 100 M 80 60 L 120 100' /%3E%3Cpath d='M80 80 L 30 130 M 80 80 L 130 130' /%3E%3C/g%3E%3C/svg%3E")`;

// Corners - Minimal Iron/Silver styles
const CORNER_IRON = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,0 L50,0 L0,50 Z' fill='%2327272a' stroke='%233f3f46' stroke-width='1'/%3E%3Ccircle cx='10' cy='10' r='2' fill='%2352525b'/%3E%3C/svg%3E")`;
const CORNER_SILVER = `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,0 L50,0 Q25,25 0,50 Z' fill='%2352525b' stroke='%23a1a1aa' stroke-width='0.5' opacity='0.8'/%3E%3Ccircle cx='12' cy='12' r='2' fill='%23d4d4d8'/%3E%3C/svg%3E")`;

// Paper Textures
const PAPER_FROST = `url("data:image/svg+xml,%3Csvg viewBox='0 0 300 300' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`;
const PAPER_ROUGH = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0 L100 100 M100 0 L0 100' stroke='%23000' opacity='0.03'/%3E%3C/svg%3E")`;

export const INITIAL_LIBRARY: Notebook[] = [
  {
    id: 'saga',
    title: "Vinter Saga",
    description: "Chronicles of the long winter.",
    type: 'journal',
    theme: {
      '--cover-color': '#27272a', // Zinc 800
      '--cover-color-light': '#3f3f46', // Zinc 700
      '--spine-color': '#18181b', // Zinc 900
      '--metal-color': '#a1a1aa', // Zinc 400
      '--metal-shadow': '#000000',
      '--page-bg': '#f4f4f5', // Zinc 100
      '--page-line': 'linear-gradient(#e4e4e7 1px, transparent 1px)',
      '--emblem-image': SVG_COMPASS,
      '--emblem-opacity': '0.7',
      '--emblem-blend': 'multiply',
      '--corner-image': CORNER_IRON,
      '--font-display': '"Cinzel Decorative", serif',
      '--font-header': '"Cinzel Decorative", serif',
      '--font-body': '"Cormorant Garamond", serif',
      '--ink-color': '#18181b',
      '--paper-pattern': PAPER_FROST,
      '--vfx-type': 'snow'
    },
    notes: [
      {
        id: '1',
        title: 'The First Frost',
        content: 'The harbor has frozen over. The silence is absolute, broken only by the cracking of the ice...',
        sketches: [],
        lastModified: getRelativeDate(0),
        entryDate: getRelativeDate(0),
        category: 'Journal'
      }
    ]
  },
  {
    id: 'runes',
    title: "Elder Runes",
    description: "Study of ancient sigils.",
    type: 'grimoire',
    theme: {
      '--cover-color': '#1e293b', // Slate 800
      '--cover-color-light': '#334155', // Slate 700
      '--spine-color': '#0f172a', // Slate 900
      '--metal-color': '#94a3b8', // Slate 400
      '--metal-shadow': '#020617',
      '--page-bg': '#0f172a', // Dark Mode Paper
      '--page-line': 'none',
      '--emblem-image': SVG_RUNE,
      '--emblem-opacity': '0.3',
      '--emblem-blend': 'screen',
      '--corner-image': CORNER_SILVER,
      '--font-display': '"Cinzel Decorative", serif',
      '--font-header': '"Space Mono", monospace',
      '--font-body': '"Space Mono", monospace',
      '--ink-color': '#e2e8f0',
      '--paper-pattern': PAPER_ROUGH,
      '--vfx-type': 'embers'
    },
    notes: [
      {
        id: 'g1',
        title: 'Algiz',
        content: 'The Elk. Protection. A connection to the divine...',
        sketches: [],
        lastModified: getRelativeDate(1),
        entryDate: getRelativeDate(1),
        category: 'Study'
      }
    ]
  },
  {
    id: 'plans',
    title: "Keep Plans",
    description: "Fortification schematics.",
    type: 'architect',
    theme: {
      '--cover-color': '#404040', // Neutral 700
      '--cover-color-light': '#525252',
      '--spine-color': '#262626',
      '--metal-color': '#d4d4d4',
      '--metal-shadow': '#171717',
      '--page-bg': '#ffffff',
      '--page-line': 'none', 
      '--emblem-image': SVG_MOUNTAIN,
      '--emblem-opacity': '0.8',
      '--emblem-blend': 'multiply',
      '--corner-image': CORNER_IRON,
      '--font-display': '"Space Mono", monospace',
      '--font-header': '"Space Mono", monospace',
      '--font-body': '"Space Mono", monospace',
      '--ink-color': '#000000',
      '--paper-pattern': 'none',
      '--vfx-type': 'none'
    },
    notes: [
      {
        id: 'a1',
        title: 'North Wall',
        content: 'Requires reinforcement. The stone from the quarry is too brittle...',
        sketches: [],
        lastModified: getRelativeDate(2),
        entryDate: getRelativeDate(2),
        category: 'Plans'
      }
    ]
  },
  {
    id: 'forest',
    title: "Black Forest",
    description: "Flora of the deep woods.",
    type: 'botanist',
    theme: {
      '--cover-color': '#14532d', // Green 900
      '--cover-color-light': '#166534',
      '--spine-color': '#052e16',
      '--metal-color': '#a16207', // Bronze/Goldish
      '--metal-shadow': '#000000',
      '--page-bg': '#f0fdf4',
      '--page-line': 'linear-gradient(#dcfce7 1px, transparent 1px)',
      '--emblem-image': SVG_PINE,
      '--emblem-opacity': '0.4',
      '--emblem-blend': 'multiply',
      '--corner-image': CORNER_SILVER,
      '--font-display': '"IM Fell English", serif',
      '--font-header': '"IM Fell English", serif',
      '--font-body': '"Crimson Pro", serif',
      '--ink-color': '#064e3b',
      '--paper-pattern': PAPER_FROST,
      '--vfx-type': 'pollen'
    },
    notes: [
      {
        id: 'b1',
        title: 'Wolfsbane',
        content: 'Found in the shadowed valleys. Highly toxic.',
        sketches: [],
        lastModified: getRelativeDate(3),
        entryDate: getRelativeDate(3),
        category: 'Collection'
      }
    ]
  }
];
