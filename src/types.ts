export type MotionName = 'none' | 'fade' | 'pop' | 'zoom' | 'scale' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'rise-up' | 'rise-down' | 'hook-left';
export interface Motion { name:MotionName; duration:number; intensity:number; easing:'linear'|'ease-out'|'spring'; }
export type Transitions = Partial<Record<'in'|'hold'|'out',Motion>>;
export interface Word { probability?:number; id: string; text: string; start: number; end: number; emphasis?: boolean; joinAfter?:boolean; transitions?:Transitions; wordTransitions?:Transitions; breakAfter?: boolean; timing?: 'word' | 'segment' | 'estimated' }
export type PresetId = 'impact' | 'power' | 'cinematic' | 'bubble' | 'desi' | 'handwritten' | 'sticker' | 'blast' | 'retro' | 'glass' | 'scribble' | 'akshar' | 'boxkaraoke' | 'pillline' | 'wide' | 'neon';
export type FontId = 'Inter' | 'Barlow Condensed' | 'Nunito' | 'Noto Sans Devanagari' | 'Mynerve' | 'Courier New';
// Optional look fields for the newer template family. They default to off when
// absent, so the original six presets render exactly as before.
export interface CaptionStyle { preset: PresetId; maxChars?:number; lines?:number; weight?:number; italic?:boolean; underline?:boolean; align?:'left'|'center'|'right'; background?:string; transitions?:Transitions; mask?:{x:number;y:number;width:number;height:number;color:string}; font: FontId; size: number; color: string; accent: string; strokeColor: string; stroke: number; shadow: number; position: number; positionX?: number; strength: number; grouping: number; uppercase: boolean; box?: 'word-pill' | 'line-pill' | 'glass'; boxColor?: string; glow?: number; letterSpacing?: number; rotate?: number; float?: boolean; charReveal?: boolean; scribble?: boolean; emphasisScale?: number; }
export interface MediaInfo { width: number; height: number; duration: number; hasAudio: boolean; name: string; }
export interface Job { kind: 'transcribe' | 'export'; label: string; progress: number | null; }
export interface ExportOptions { resolution: 720 | 1080; format: 'mp4' | 'webm'; }
export type CaptionLanguage = 'same' | 'english' | 'hindi' | 'hinglish';
export interface LanguageSettings { spoken: string; caption: CaptionLanguage; model: 'tiny' | 'base' | 'small' | 'shruti'; audioMode?: 'original' | 'light' | 'center' }
