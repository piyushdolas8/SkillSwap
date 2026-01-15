
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChatMessage, UserProfile, SharedFile } from '../types';

interface Props {
  matchId: string | null;
  partner: UserProfile | null;
  skill?: string;
  onEnd: () => void;
}

interface Point { x: number; y: number; }
interface CanvasElement {
  id: string;
  type: 'stroke' | 'text' | 'rect' | 'circle' | 'eraser';
  points?: Point[];
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  color: string;
  width: number;
  translateX: number;
  translateY: number;
  rotation: number;
  scale: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

const MONO_FONT = '"JetBrains Mono", "Fira Code", "SFMono-Regular", Consolas, monospace';
const SANS_FONT = '"Space Grotesk", sans-serif';

const LANGUAGES = [
  { id: 'python', name: 'Python', color: '#3776ab' },
  { id: 'javascript', name: 'JavaScript', color: '#f7df1e' },
  { id: 'typescript', name: 'TypeScript', color: '#3178c6' },
  { id: 'cpp', name: 'C++', color: '#659ad2' },
  { id: 'html', name: 'HTML/CSS', color: '#e34f26' }
];

const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  'python': `# SkillSwap Python Session\n\ndef main():\n    print("Hello, Peer!")\n\nif __name__ == "__main__":\n    main()`,
  'javascript': `// SkillSwap JS Session\nconst greet = () => {\n  console.log("Collaborative coding is fun!");\n};\ngreet();`,
  'typescript': `interface User {\n  id: string;\n  skill: string;\n}\n\nconst user: User = {\n  id: "123",\n  skill: "Expert"\n};`,
  'cpp': `#include <iostream>\n\nint main() {\n    std::cout << "Learning together!" << std::endl;\n    return 0;\n}`,
  'html': `<!-- SkillSwap Sandbox -->\n<div class="container">\n  <h1>Peer Learning</h1>\n  <p>Start trading skills today.</p>\n</div>\n\n<style>\n  .container { color: #0d33f2; font-family: sans-serif; }\n</style>`
};

const highlightCode = (code: string, language: string) => {
  let html = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const patterns: Record<string, { regex: RegExp; class: string }[]> = {
    common: [
      { regex: /(".*?"|'.*?'|`.*?`)/g, class: 'text-[#ce9178]' },
      { regex: /\b(\d+)\b/g, class: 'text-[#b5cea8]' },
    ],
    javascript: [
      { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, class: 'text-[#6a9955] italic' },
      { regex: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|this|await|async|type|interface|enum)\b/g, class: 'text-[#569cd6]' },
      { regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g, class: 'text-[#dcdcaa]' },
    ],
    python: [
      { regex: /(#.*$)/gm, class: 'text-[#6a9955] italic' },
      { regex: /\b(def|return|if|elif|else|for|while|import|from|class|as|with|try|except|finally|pass|in|is|not|and|or|lambda|None|True|False)\b/g, class: 'text-[#569cd6]' },
      { regex: /\b(print|range|len|enumerate|zip)\b/g, class: 'text-[#4ec9b0]' },
    ]
  };
  const langPatterns = patterns[language] || patterns.javascript;
  [...langPatterns, ...patterns.common].forEach(p => {
    html = html.replace(p.regex, (match) => `<span class="${p.class}">${match}</span>`);
  });
  return html;
};

type SessionMode = 'code' | 'draw';
type SidebarTab = 'chat' | 'files';
type DrawingTool = 'select' | 'pencil' | 'text' | 'rect' | 'circle' | 'eraser';
type TransformMode = 'move' | 'resize' | 'rotate' | null;

const LiveSession: React.FC<Props> = ({ matchId, partner, skill = 'python', onEnd }) => {
  const [mode, setMode] = useState<SessionMode>('code');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState(skill.toLowerCase());
  const [code, setCode] = useState<string>(DEFAULT_CODE_TEMPLATES[skill.toLowerCase()] || DEFAULT_CODE_TEMPLATES['python']);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [messageInput, setMessageInput] = useState('');
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [partnerMediaStatus, setPartnerMediaStatus] = useState({ isMuted: false, isVideoOff: false });
  
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [drawColor, setDrawColor] = useState('#0d33f2');
  const [drawFontSize, setDrawFontSize] = useState(24);
  const [drawFontFamily, setDrawFontFamily] = useState(SANS_FONT);
  
  const [activeTextInput, setActiveTextInput] = useState<{ x: number, y: number, id: string } | null>(null);
  const [currentTextValue, setCurrentTextValue] = useState('');

  const isInteractingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const startPosRef = useRef<Point>({ x: 0, y: 0 });
  const transformModeRef = useRef<TransformMode>(null);
  const initialTransformRef = useRef({ translateX: 0, translateY: 0, scale: 1, rotation: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);

  // Media Stream Setup & Maintenance
  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(console.error);
        }
      } catch (err) {
        console.error("Media error:", err);
      }
    };
    startMedia();
    return () => streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  // Sync Media State to tracks and remote partner
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(t => t.enabled = !isMuted);
      streamRef.current.getVideoTracks().forEach(t => t.enabled = !isVideoOff);
      
      channelRef.current?.send({ 
        type: 'broadcast', 
        event: 'media-update', 
        payload: { isMuted, isVideoOff } 
      });

      if (!isVideoOff && videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, [isMuted, isVideoOff]);

  // Network Sync Setup
  useEffect(() => {
    if (!matchId) return;
    const channel = supabase.channel(`session:${matchId}`, { config: { broadcast: { self: false } } });
    channel
      .on('broadcast', { event: 'code-update' }, (p) => { setCode(p.payload.code); if (p.payload.lang) setSelectedLang(p.payload.lang); })
      .on('broadcast', { event: 'chat-message' }, (p) => setChatMessages(prev => [...prev, p.payload]))
      .on('broadcast', { event: 'element-added' }, (p) => setElements(prev => [...prev, p.payload.element]))
      .on('broadcast', { event: 'element-updated' }, (p) => setElements(prev => prev.map(el => el.id === p.payload.element.id ? p.payload.element : el)))
      .on('broadcast', { event: 'clear-canvas' }, () => setElements([]))
      .on('broadcast', { event: 'media-update' }, (p) => setPartnerMediaStatus(p.payload));

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
        channel.send({ type: 'broadcast', event: 'media-update', payload: { isMuted, isVideoOff } });
      }
    });
    return () => { supabase.removeChannel(channel); };
  }, [matchId, isMuted, isVideoOff]);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    elements.forEach(el => {
      ctx.save();
      const centerX = (el.bbox.minX + el.bbox.maxX) / 2;
      const centerY = (el.bbox.minY + el.bbox.maxY) / 2;
      
      ctx.translate(el.translateX + centerX, el.translateY + centerY);
      ctx.rotate(el.rotation);
      ctx.scale(el.scale, el.scale);
      ctx.translate(-centerX, -centerY);
      
      ctx.strokeStyle = el.type === 'eraser' ? '#ffffff' : el.color;
      ctx.lineWidth = el.type === 'eraser' ? 24 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'stroke' || el.type === 'eraser') {
        if (el.points) {
          ctx.beginPath();
          el.points.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
          ctx.stroke();
        }
      } else if (el.type === 'rect') {
        ctx.strokeRect(el.bbox.minX, el.bbox.minY, el.bbox.maxX - el.bbox.minX, el.bbox.maxY - el.bbox.minY);
      } else if (el.type === 'circle') {
        const rx = (el.bbox.maxX - el.bbox.minX) / 2;
        const ry = (el.bbox.maxY - el.bbox.minY) / 2;
        ctx.beginPath();
        ctx.ellipse(el.bbox.minX + rx, el.bbox.minY + ry, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (el.type === 'text' && el.text) {
        ctx.fillStyle = el.color; 
        ctx.font = `${el.fontSize || 24}px ${el.fontFamily || SANS_FONT}`; 
        ctx.textBaseline = 'top';
        el.text.split('\n').forEach((line, i) => ctx.fillText(line, el.bbox.minX, el.bbox.minY + i * (el.fontSize || 24) * 1.2));
      }
      ctx.restore();
    });

    if (selectedId && drawingTool === 'select') {
      const el = elements.find(e => e.id === selectedId);
      if (el) {
        ctx.save();
        const centerX = (el.bbox.minX + el.bbox.maxX) / 2;
        const centerY = (el.bbox.minY + el.bbox.maxY) / 2;
        ctx.translate(el.translateX + centerX, el.translateY + centerY);
        ctx.rotate(el.rotation);
        ctx.scale(el.scale, el.scale);
        ctx.translate(-centerX, -centerY);
        
        ctx.strokeStyle = '#0d33f2';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(el.bbox.minX - 6, el.bbox.minY - 6, (el.bbox.maxX - el.bbox.minX) + 12, (el.bbox.maxY - el.bbox.minY) + 12);
        
        ctx.setLineDash([]);
        ctx.fillStyle = '#0d33f2';
        // Resize handle
        ctx.fillRect(el.bbox.maxX + 4, el.bbox.maxY + 4, 10, 10);
        // Rotate handle
        ctx.beginPath();
        ctx.arc(centerX, el.bbox.minY - 24, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [elements, selectedId, drawingTool]);

  useEffect(() => renderCanvas(), [renderCanvas]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startPosRef.current = { x, y };

    if (drawingTool === 'select') {
      if (selectedId) {
        const el = elements.find(e => e.id === selectedId);
        if (el) {
          const centerX = (el.bbox.minX + el.bbox.maxX) / 2 + el.translateX;
          const centerY = (el.bbox.minY + el.bbox.maxY) / 2 + el.translateY;
          if (Math.hypot(x - centerX, y - (el.bbox.minY - 24 + el.translateY)) < 24) {
            transformModeRef.current = 'rotate';
            initialTransformRef.current = { ...el };
            isInteractingRef.current = true;
            return;
          }
          if (Math.hypot(x - (el.bbox.maxX + el.translateX), y - (el.bbox.maxY + el.translateY)) < 24) {
            transformModeRef.current = 'resize';
            initialTransformRef.current = { ...el };
            isInteractingRef.current = true;
            return;
          }
        }
      }

      // Hit test elements with basic inverse coordinate mapping
      const hit = [...elements].reverse().find(el => {
        const centerX = (el.bbox.minX + el.bbox.maxX) / 2;
        const centerY = (el.bbox.minY + el.bbox.maxY) / 2;
        const dx = x - (el.translateX + centerX);
        const dy = y - (el.translateY + centerY);
        const cos = Math.cos(-el.rotation);
        const sin = Math.sin(-el.rotation);
        const localX = (dx * cos - dy * sin) / el.scale + centerX;
        const localY = (dx * sin + dy * cos) / el.scale + centerY;
        return localX >= el.bbox.minX && localX <= el.bbox.maxX && localY >= el.bbox.minY && localY <= el.bbox.maxY;
      });

      if (hit) {
        setSelectedId(hit.id);
        transformModeRef.current = 'move';
        initialTransformRef.current = { ...hit };
        isInteractingRef.current = true;
      } else {
        setSelectedId(null);
      }
      return;
    }

    if (drawingTool === 'pencil' || drawingTool === 'eraser') {
      isInteractingRef.current = true;
      currentStrokeRef.current = [{ x, y }];
    } else if (drawingTool === 'rect' || drawingTool === 'circle') {
      isInteractingRef.current = true;
    } else if (drawingTool === 'text') {
      if (activeTextInput) finalizeText();
      else setActiveTextInput({ x, y, id: Math.random().toString() });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (drawingTool === 'select' && selectedId && isInteractingRef.current) {
      const dx = x - startPosRef.current.x;
      const dy = y - startPosRef.current.y;
      setElements(prev => prev.map(el => {
        if (el.id !== selectedId) return el;
        if (transformModeRef.current === 'move') {
          return { ...el, translateX: initialTransformRef.current.translateX + dx, translateY: initialTransformRef.current.translateY + dy };
        }
        if (transformModeRef.current === 'rotate') {
          const centerX = (el.bbox.minX + el.bbox.maxX) / 2 + el.translateX;
          const centerY = (el.bbox.minY + el.bbox.maxY) / 2 + el.translateY;
          const angle = Math.atan2(y - centerY, x - centerX) + Math.PI / 2;
          return { ...el, rotation: angle };
        }
        if (transformModeRef.current === 'resize') {
          const centerX = (el.bbox.minX + el.bbox.maxX) / 2 + el.translateX;
          const centerY = (el.bbox.minY + el.bbox.maxY) / 2 + el.translateY;
          const distStart = Math.hypot(startPosRef.current.x - centerX, startPosRef.current.y - centerY);
          const distNow = Math.hypot(x - centerX, y - centerY);
          return { ...el, scale: initialTransformRef.current.scale * (distNow / (distStart || 1)) };
        }
        return el;
      }));
      return;
    }

    if (!isInteractingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (drawingTool === 'pencil' || drawingTool === 'eraser') {
      currentStrokeRef.current.push({ x, y });
      ctx.strokeStyle = drawingTool === 'eraser' ? '#ffffff' : drawColor;
      ctx.lineWidth = drawingTool === 'eraser' ? 24 : 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const last = currentStrokeRef.current[currentStrokeRef.current.length - 2];
      if (last) { ctx.moveTo(last.x, last.y); ctx.lineTo(x, y); ctx.stroke(); }
    } else if (drawingTool === 'rect') {
      renderCanvas();
      ctx.strokeStyle = drawColor; ctx.lineWidth = 3;
      ctx.strokeRect(startPosRef.current.x, startPosRef.current.y, x - startPosRef.current.x, y - startPosRef.current.y);
    } else if (drawingTool === 'circle') {
      renderCanvas();
      ctx.strokeStyle = drawColor; ctx.lineWidth = 3;
      const rx = (x - startPosRef.current.x) / 2;
      const ry = (y - startPosRef.current.y) / 2;
      ctx.beginPath();
      ctx.ellipse(startPosRef.current.x + rx, startPosRef.current.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isInteractingRef.current) return;
    
    if (drawingTool === 'select' && selectedId) {
      const updated = elements.find(el => el.id === selectedId);
      if (updated) channelRef.current?.send({ type: 'broadcast', event: 'element-updated', payload: { element: updated } });
      isInteractingRef.current = false;
      transformModeRef.current = null;
      return;
    }

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let newEl: CanvasElement | null = null;

    if (drawingTool === 'pencil' || drawingTool === 'eraser') {
      const pts = currentStrokeRef.current;
      newEl = {
        id: Math.random().toString(),
        type: drawingTool === 'eraser' ? 'eraser' : 'stroke',
        points: pts,
        color: drawingTool === 'eraser' ? '#ffffff' : drawColor,
        width: drawingTool === 'eraser' ? 24 : 3,
        translateX: 0, translateY: 0, rotation: 0, scale: 1,
        bbox: { minX: Math.min(...pts.map(p => p.x)), minY: Math.min(...pts.map(p => p.y)), maxX: Math.max(...pts.map(p => p.x)), maxY: Math.max(...pts.map(p => p.y)) }
      };
    } else if (drawingTool === 'rect' || drawingTool === 'circle') {
      newEl = {
        id: Math.random().toString(),
        type: drawingTool,
        color: drawColor,
        width: 3,
        translateX: 0, translateY: 0, rotation: 0, scale: 1,
        bbox: { minX: Math.min(startPosRef.current.x, x), minY: Math.min(startPosRef.current.y, y), maxX: Math.max(startPosRef.current.x, x), maxY: Math.max(startPosRef.current.y, y) }
      };
    }

    if (newEl) {
      setElements(prev => [...prev, newEl!]);
      channelRef.current?.send({ type: 'broadcast', event: 'element-added', payload: { element: newEl } });
    }
    isInteractingRef.current = false;
    currentStrokeRef.current = [];
  };

  const finalizeText = () => {
    if (!activeTextInput || !currentTextValue.trim()) { setActiveTextInput(null); return; }
    const lines = currentTextValue.split('\n');
    const height = lines.length * drawFontSize * 1.2;
    const width = Math.max(...lines.map(l => l.length)) * (drawFontSize * 0.6);
    const newEl: CanvasElement = {
      id: activeTextInput.id,
      type: 'text',
      text: currentTextValue,
      color: drawColor,
      fontSize: drawFontSize,
      fontFamily: drawFontFamily,
      translateX: 0, translateY: 0, rotation: 0, scale: 1,
      bbox: { minX: activeTextInput.x, minY: activeTextInput.y, maxX: activeTextInput.x + width, maxY: activeTextInput.y + height },
      width: 0
    };
    setElements(prev => [...prev, newEl]);
    channelRef.current?.send({ type: 'broadcast', event: 'element-added', payload: { element: newEl } });
    setActiveTextInput(null);
    setCurrentTextValue('');
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !channelRef.current) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      name: 'Me',
      text: messageInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages(prev => [...prev, msg]);
    channelRef.current.send({ type: 'broadcast', event: 'chat-message', payload: { ...msg, sender: 'partner', name: partner?.name || 'Partner' } });
    setMessageInput('');
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#111218] overflow-hidden font-display">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-3 bg-[#161a2d] z-50">
        <div className="flex items-center gap-6">
          <div className="size-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path></svg>
          </div>
          <div className="flex bg-black/20 rounded-xl p-1 border border-white/5">
            <button onClick={() => setMode('code')} className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'code' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>IDE Mode</button>
            <button onClick={() => setMode('draw')} className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'draw' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>Whiteboard</button>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Sync</span>
           </div>
           <button onClick={onEnd} className="bg-red-600 text-white text-[10px] font-black h-10 px-6 rounded-xl hover:brightness-110 transition-all uppercase tracking-widest shadow-lg">End Session</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative bg-[#080910]">
          {mode === 'code' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-10 flex items-center justify-between px-6 bg-[#161a2d] border-b border-white/5">
                <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="bg-transparent text-slate-400 text-[11px] font-bold border-none outline-none cursor-pointer hover:text-white transition-colors">
                  {LANGUAGES.map(lang => <option key={lang.id} value={lang.id} className="bg-[#161a2d]">{lang.id.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="flex-1 relative font-mono text-sm">
                 <pre ref={preRef} className="absolute inset-0 p-6 m-0 pointer-events-none whitespace-pre-wrap break-words leading-relaxed overflow-hidden" dangerouslySetInnerHTML={{ __html: highlightCode(code, selectedLang) + '\n' }} />
                 <textarea ref={editorRef} spellCheck={false} value={code} onScroll={() => { if (preRef.current && editorRef.current) { preRef.current.scrollTop = editorRef.current.scrollTop; preRef.current.scrollLeft = editorRef.current.scrollLeft; } }} onChange={(e) => { setCode(e.target.value); channelRef.current?.send({ type: 'broadcast', event: 'code-update', payload: { code: e.target.value, lang: selectedLang } }); }} className="absolute inset-0 p-6 bg-transparent text-transparent caret-white resize-none outline-none overflow-auto whitespace-pre-wrap break-words leading-relaxed" />
              </div>
            </div>
          ) : (
            <div className="flex-1 relative bg-white overflow-hidden">
              <canvas ref={canvasRef} width={2000} height={2000} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} className={`w-full h-full ${drawingTool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`} />
              {activeTextInput && (
                <textarea 
                  ref={textInputRef} 
                  autoFocus 
                  value={currentTextValue} 
                  onChange={(e) => setCurrentTextValue(e.target.value)} 
                  onBlur={finalizeText} 
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finalizeText(); } }}
                  className="absolute bg-white/5 border border-primary outline-none p-2 rounded-lg text-2xl shadow-xl backdrop-blur-md transition-shadow" 
                  style={{ left: activeTextInput.x, top: activeTextInput.y, fontFamily: drawFontFamily, fontSize: drawFontSize, color: drawColor, minWidth: '160px' }} 
                />
              )}
              
              <div className="absolute top-6 left-6 flex flex-col gap-2 bg-[#161a2d]/90 backdrop-blur-xl p-3 rounded-3xl border border-white/10 shadow-2xl z-40">
                 {['select', 'pencil', 'eraser', 'text', 'rect', 'circle'].map(tool => (
                   <button key={tool} onClick={() => { setDrawingTool(tool as DrawingTool); if (tool !== 'select') setSelectedId(null); }} className={`size-10 flex items-center justify-center rounded-xl transition-all ${drawingTool === tool ? 'bg-primary text-white scale-110 shadow-glow' : 'text-slate-400 hover:bg-white/5'}`}>
                     <span className="material-symbols-outlined !text-xl">{tool === 'select' ? 'near_me' : tool === 'pencil' ? 'edit' : tool === 'eraser' ? 'ink_eraser' : tool === 'text' ? 'title' : tool === 'rect' ? 'rectangle' : 'circle'}</span>
                   </button>
                 ))}
                 <div className="h-px w-full bg-white/10 my-1"></div>
                 {drawingTool === 'text' && (
                   <div className="flex flex-col gap-2 animate-in fade-in zoom-in-95">
                      {[16, 24, 32, 48].map(size => (
                        <button key={size} onClick={() => setDrawFontSize(size)} className={`text-[9px] font-black w-full py-1 rounded-lg border ${drawFontSize === size ? 'bg-primary border-primary text-white' : 'border-white/5 text-slate-500'}`}>{size}PX</button>
                      ))}
                   </div>
                 )}
                 <button onClick={() => { setElements([]); setSelectedId(null); channelRef.current?.send({ type: 'broadcast', event: 'clear-canvas' }); }} className="size-10 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"><span className="material-symbols-outlined">delete_sweep</span></button>
              </div>
            </div>
          )}

          {/* Media Views Overlay */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-4 z-40 pointer-events-none">
             <div className="w-56 aspect-video bg-black rounded-2xl border-2 border-primary/30 overflow-hidden relative shadow-2xl pointer-events-auto">
                {partnerMediaStatus.isVideoOff ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-600">
                    <span className="material-symbols-outlined !text-4xl animate-pulse">person</span>
                    <span className="text-[8px] font-black uppercase tracking-widest mt-2">Video Off</span>
                  </div>
                ) : (
                  <video ref={partnerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                )}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest">{partner?.name || 'Partner'}</div>
                {partnerMediaStatus.isMuted && <div className="absolute top-2 right-2 bg-red-600 size-6 rounded-full flex items-center justify-center border border-white/20"><span className="material-symbols-outlined text-white !text-xs">mic_off</span></div>}
             </div>
             <div className="w-44 aspect-video bg-black rounded-2xl border-2 border-white/10 overflow-hidden relative shadow-2xl pointer-events-auto self-end">
                {isVideoOff ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-600">
                    <span className="material-symbols-outlined !text-2xl">visibility_off</span>
                  </div>
                ) : (
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                )}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest">Me</div>
             </div>
          </div>

          {/* Centered Controls */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#161a2d]/90 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl z-40">
             <button onClick={() => setIsMuted(!isMuted)} className={`size-12 rounded-xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span></button>
             <button onClick={() => setIsVideoOff(!isVideoOff)} className={`size-12 rounded-xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined">{isVideoOff ? 'videocam_off' : 'videocam'}</span></button>
             <div className="h-8 w-px bg-white/10 mx-2"></div>
             <button onClick={() => {/* Screen Share Logic */}} className="px-6 h-12 rounded-xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest bg-white/5 text-slate-400 hover:text-white transition-all"><span className="material-symbols-outlined text-lg">present_to_all</span> Screen Share</button>
          </div>
        </div>

        <aside className="w-80 h-full border-l border-white/5 flex flex-col bg-[#161a2d]">
          <div className="flex border-b border-white/5">
             <button onClick={() => setSidebarTab('chat')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'chat' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-white'}`}>Discussion</button>
             <button onClick={() => setSidebarTab('files')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'files' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-white'}`}>Expert Assets</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar bg-black/10">
             {sidebarTab === 'chat' ? (
               chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                 <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-1`}>
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-[9px] font-black uppercase text-slate-600">{msg.name}</span>
                      <span className="text-[8px] font-bold text-slate-700">{msg.timestamp}</span>
                    </div>
                    <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none shadow-lg' : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'}`}>
                      {msg.text}
                    </div>
                 </div>
               )) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-700 text-center px-6">
                    <span className="material-symbols-outlined !text-4xl mb-3 opacity-20">chat_bubble</span>
                    <span className="text-[10px] font-black uppercase tracking-widest">Connect with your peer through chat</span>
                 </div>
               )
             ) : (
               <div className="space-y-4">
                  <button className="w-full py-6 border-2 border-dashed border-white/5 rounded-2xl text-slate-600 text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-white transition-all">
                    Initialize Asset Transfer
                  </button>
               </div>
             )}
          </div>
          {sidebarTab === 'chat' && (
            <div className="p-4 bg-[#161a2d] border-t border-white/5">
               <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                 <input value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Send message..." className="flex-1 bg-transparent px-4 py-2 text-sm text-white outline-none placeholder:text-slate-700" />
                 <button onClick={sendMessage} className="size-10 bg-primary text-white rounded-xl flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-lg"><span className="material-symbols-outlined !text-lg">send</span></button>
               </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default LiveSession;
