
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChatMessage, UserProfile, SharedFile } from '../types';

// Defined missing types to resolve "Cannot find name" errors.
type SessionMode = 'code' | 'draw';
type SidebarTab = 'chat' | 'files';
type DrawingTool = 'select' | 'pencil' | 'eraser' | 'text' | 'rect' | 'circle';
type TransformMode = 'move' | 'rotate' | 'resize' | null;

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
  { id: 'python', name: 'Python', color: '#3776ab', glow: 'rgba(55, 118, 171, 0.3)' },
  { id: 'javascript', name: 'JavaScript', color: '#f7df1e', glow: 'rgba(247, 223, 30, 0.2)' },
  { id: 'typescript', name: 'TypeScript', color: '#3178c6', glow: 'rgba(49, 120, 198, 0.3)' },
  { id: 'cpp', name: 'C++', color: '#00599c', glow: 'rgba(0, 89, 156, 0.3)' },
  { id: 'html', name: 'HTML/CSS', color: '#e34f26', glow: 'rgba(227, 79, 38, 0.3)' }
];

const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  'python': `# Python Expert Session\nimport math\n\ndef calculate_radius(area):\n    """Calculate radius from area."""\n    return math.sqrt(area / math.pi)\n\n# Let's test this function\nprint(f"Radius: {calculate_radius(100):.2f}")`,
  'javascript': `// JavaScript Masterclass\nconst peerExchange = {\n  status: "active",\n  participants: ["Expert", "Learner"],\n  async initiate() {\n    console.log("Syncing peer nodes...");\n    return true;\n  }\n};\n\npeerExchange.initiate();`,
  'typescript': `interface Peer {\n  id: string;\n  skill: string;\n  xp: number;\n}\n\nfunction mentor(peer: Peer): string {\n  return \`Mastering \${peer.skill} at level \${peer.xp}\`;\n}\n\nconst user = { id: "p01", skill: "TS", xp: 99 };`,
  'cpp': `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Optimal peer-to-peer logic\n    cout << "SkillSwap C++ Protocol v2.4" << endl;\n    return 0;\n}`,
  'html': `<!-- Advanced Component Structure -->\n<div class="skill-card">\n  <h2>Mastering CSS Grid</h2>\n  <p>Trade what you know.</p>\n</div>\n\n<style>\n  .skill-card {\n    display: grid;\n    place-items: center;\n    color: #0d33f2;\n  }\n</style>`
};

const highlightCode = (code: string, language: string) => {
  let html = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  const patterns: Record<string, { regex: RegExp; class: string }[]> = {
    common: [
      { regex: /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, class: 'text-[#ce9178]' }, // Strings
      { regex: /\b(\d+)\b/g, class: 'text-[#b5cea8]' }, // Numbers
    ],
    javascript: [
      { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, class: 'text-[#6a9955] italic' }, // Comments
      { regex: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|this|await|async|type|interface|enum|default)\b/g, class: 'text-[#569cd6]' }, // Keywords
      { regex: /\b(console|window|document|Math|Object|Array|String|Number|Boolean|JSON)\b/g, class: 'text-[#4ec9b0]' }, // Built-ins
      { regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g, class: 'text-[#dcdcaa]' }, // Functions
    ],
    python: [
      { regex: /(#.*$)/gm, class: 'text-[#6a9955] italic' }, // Comments
      { regex: /(""".*?"""|'''.*?''')/gs, class: 'text-[#6a9955] italic' }, // Docstrings
      { regex: /\b(def|return|if|elif|else|for|while|import|from|class|as|with|try|except|finally|pass|in|is|not|and|or|lambda|None|True|False|async|await)\b/g, class: 'text-[#569cd6]' }, // Keywords
      { regex: /\b(print|range|len|enumerate|zip|dict|list|set|str|int|float|open)\b/g, class: 'text-[#4ec9b0]' }, // Built-ins
      { regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g, class: 'text-[#dcdcaa]' }, // Functions
    ],
    cpp: [
      { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, class: 'text-[#6a9955] italic' },
      { regex: /#\s*\b(include|define|if|else|endif|pragma)\b/g, class: 'text-[#c586c0]' }, // Preprocessor
      { regex: /\b(int|float|double|char|bool|void|class|struct|public|private|protected|template|typename|operator|new|delete|return|if|else|for|while|do|switch|case|break|continue|using|namespace|std|cout|cin|endl)\b/g, class: 'text-[#569cd6]' },
      { regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g, class: 'text-[#dcdcaa]' },
    ],
    html: [
      { regex: /(&lt;!--.*?--&gt;)/gs, class: 'text-[#6a9955] italic' }, // Comments
      { regex: /(&lt;\/?[a-z1-6]+|&gt;)/gi, class: 'text-[#808080]' }, // Tags
      { regex: /\b(class|id|style|src|href|alt|type|value|name|onclick|rel|target)\b/g, class: 'text-[#9cdcfe]' }, // Attributes
    ]
  };

  const langPatterns = patterns[language] || patterns.javascript;
  const allPatterns = [...langPatterns, ...patterns.common];
  
  allPatterns.forEach(p => {
    html = html.replace(p.regex, (match) => `<span class="${p.class}">${match}</span>`);
  });

  // Add line numbers
  const lines = html.split('\n');
  return lines.map((line, i) => `
    <div class="flex">
      <span class="w-10 text-right pr-4 text-slate-700 select-none text-[10px] font-mono leading-relaxed mt-1">${i + 1}</span>
      <span class="flex-1">${line || ' '}</span>
    </div>
  `).join('');
};

const LiveSession: React.FC<Props> = ({ matchId, partner, skill = 'python', onEnd }) => {
  const [mode, setMode] = useState<SessionMode>('code');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState(skill.toLowerCase());
  const [code, setCode] = useState<string>(DEFAULT_CODE_TEMPLATES[skill.toLowerCase()] || DEFAULT_CODE_TEMPLATES['python']);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
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

  // --- MEDIA HANDLER (PREVENTS BLACK SCREEN) ---
  useEffect(() => {
    let mounted = true;
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(e => console.warn("Video play error:", e));
          };
        }
      } catch (err) {
        console.error("Media error:", err);
      }
    };
    startMedia();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  // Sync track state (fixed black screen by using enabled property)
  useEffect(() => {
    if (streamRef.current) {
      const videoTracks = streamRef.current.getVideoTracks();
      const audioTracks = streamRef.current.getAudioTracks();
      
      videoTracks.forEach(track => { track.enabled = !isVideoOff; });
      audioTracks.forEach(track => { track.enabled = !isMuted; });

      if (!isVideoOff && videoRef.current) {
        videoRef.current.play().catch(() => {});
      }

      channelRef.current?.send({ 
        type: 'broadcast', 
        event: 'media-update', 
        payload: { isMuted, isVideoOff } 
      });
    }
  }, [isVideoOff, isMuted]);

  // --- NETWORK SYNC ---
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

  // --- CANVAS RENDERING (ANIMATED & SMOOTH) ---
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
      ctx.lineWidth = el.type === 'eraser' ? 32 : 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'stroke' || el.type === 'eraser') {
        if (el.points && el.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(el.points[0].x, el.points[0].y);
          for (let i = 1; i < el.points.length; i++) {
            ctx.lineTo(el.points[i].x, el.points[i].y);
          }
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
        const lines = el.text.split('\n');
        lines.forEach((line, i) => ctx.fillText(line, el.bbox.minX, el.bbox.minY + i * (el.fontSize || 24) * 1.2));
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
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(el.bbox.minX - 10, el.bbox.minY - 10, (el.bbox.maxX - el.bbox.minX) + 20, (el.bbox.maxY - el.bbox.minY) + 20);
        
        ctx.setLineDash([]);
        ctx.fillStyle = '#0d33f2';
        // Resize handle
        ctx.fillRect(el.bbox.maxX + 4, el.bbox.maxY + 4, 12, 12);
        // Rotate handle
        ctx.beginPath();
        ctx.arc(centerX, el.bbox.minY - 24, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [elements, selectedId, drawingTool]);

  useEffect(() => {
    const frame = requestAnimationFrame(renderCanvas);
    return () => cancelAnimationFrame(frame);
  }, [renderCanvas]);

  // --- INTERACTION ---
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

      const hit = [...elements].reverse().find(el => {
        const centerX = (el.bbox.minX + el.bbox.maxX) / 2;
        const centerY = (el.bbox.minY + el.bbox.maxY) / 2;
        const dx = x - (el.translateX + centerX);
        const dy = y - (el.translateY + centerY);
        const cos = Math.cos(-el.rotation);
        const sin = Math.sin(-el.rotation);
        const lx = (dx * cos - dy * sin) / el.scale + centerX;
        const ly = (dx * sin + dy * cos) / el.scale + centerY;
        return lx >= el.bbox.minX - 10 && lx <= el.bbox.maxX + 10 && ly >= el.bbox.minY - 10 && ly <= el.bbox.maxY + 10;
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
      else {
        setActiveTextInput({ x, y, id: Math.random().toString() });
        setCurrentTextValue('');
      }
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
          const ds = Math.hypot(startPosRef.current.x - centerX, startPosRef.current.y - centerY);
          const dn = Math.hypot(x - centerX, y - centerY);
          return { ...el, scale: initialTransformRef.current.scale * (dn / (ds || 1)) };
        }
        return el;
      }));
      return;
    }

    if (!isInteractingRef.current) return;
    if (drawingTool === 'pencil' || drawingTool === 'eraser') {
      currentStrokeRef.current.push({ x, y });
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
      const pts = [...currentStrokeRef.current];
      if (pts.length < 2) { isInteractingRef.current = false; return; }
      newEl = {
        id: Math.random().toString(),
        type: drawingTool === 'eraser' ? 'eraser' : 'stroke',
        points: pts,
        color: drawingTool === 'eraser' ? '#ffffff' : drawColor,
        width: drawingTool === 'eraser' ? 32 : 3,
        translateX: 0, translateY: 0, rotation: 0, scale: 1,
        bbox: { 
          minX: Math.min(...pts.map(p => p.x)), 
          minY: Math.min(...pts.map(p => p.y)), 
          maxX: Math.max(...pts.map(p => p.x)), 
          maxY: Math.max(...pts.map(p => p.y)) 
        }
      };
    } else if (drawingTool === 'rect' || drawingTool === 'circle') {
      newEl = {
        id: Math.random().toString(),
        type: drawingTool,
        color: drawColor,
        width: 3,
        translateX: 0, translateY: 0, rotation: 0, scale: 1,
        bbox: { 
          minX: Math.min(startPosRef.current.x, x), 
          minY: Math.min(startPosRef.current.y, y), 
          maxX: Math.max(startPosRef.current.x, x), 
          maxY: Math.max(startPosRef.current.y, y) 
        }
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
    const h = lines.length * drawFontSize * 1.2;
    const w = Math.max(...lines.map(l => l.length)) * (drawFontSize * 0.6);
    const newEl: CanvasElement = {
      id: activeTextInput.id,
      type: 'text',
      text: currentTextValue,
      color: drawColor,
      fontSize: drawFontSize,
      fontFamily: drawFontFamily,
      translateX: 0, translateY: 0, rotation: 0, scale: 1,
      bbox: { minX: activeTextInput.x, minY: activeTextInput.y, maxX: activeTextInput.x + w, maxY: activeTextInput.y + h },
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
    channelRef.current.send({ 
      type: 'broadcast', 
      event: 'chat-message', 
      payload: { ...msg, sender: 'partner', name: partner?.name || 'Partner' } 
    });
    setMessageInput('');
  };

  const currentTheme = LANGUAGES.find(l => l.id === selectedLang) || LANGUAGES[0];

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0b10] overflow-hidden font-display">
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-3 bg-[#161a2d] z-50">
        <div className="flex items-center gap-6">
          <div className="size-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path></svg>
          </div>
          <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 shadow-lg">
            <button onClick={() => setMode('code')} className={`px-6 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'code' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>Code Editor</button>
            <button onClick={() => setMode('draw')} className={`px-6 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'draw' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>Whiteboard</button>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 rounded-xl border border-primary/20">
              <span className="size-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#0d33f2]"></span>
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">Real-time Node</span>
           </div>
           <button onClick={onEnd} className="bg-red-600/10 text-red-500 border border-red-500/20 text-[10px] font-black h-10 px-6 rounded-xl hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest shadow-lg">Disconnect</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col relative bg-[#080910]">
          {mode === 'code' ? (
            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
              <div className="h-10 flex items-center justify-between px-6 bg-[#161a2d] border-b border-white/5 shadow-xl z-20">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: currentTheme.color }}></span>
                    <select 
                      value={selectedLang} 
                      onChange={(e) => {
                        const newLang = e.target.value;
                        setSelectedLang(newLang);
                        setCode(DEFAULT_CODE_TEMPLATES[newLang] || "");
                      }} 
                      className="bg-transparent text-slate-400 text-[11px] font-black uppercase tracking-widest border-none outline-none cursor-pointer hover:text-white transition-colors"
                    >
                      {LANGUAGES.map(lang => <option key={lang.id} value={lang.id} className="bg-[#161a2d]">{lang.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <button onClick={() => navigator.clipboard.writeText(code)} className="size-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all"><span className="material-symbols-outlined !text-sm">content_copy</span></button>
                </div>
              </div>
              <div className="flex-1 relative font-mono text-[13px] overflow-hidden group">
                 <div 
                   className="absolute inset-0 transition-all duration-700 pointer-events-none opacity-20"
                   style={{ background: `radial-gradient(circle at 50% 50%, ${currentTheme.glow} 0%, transparent 80%)` }}
                 />
                 <pre 
                   ref={preRef} 
                   className="absolute inset-0 p-6 m-0 pointer-events-none whitespace-pre-wrap break-words leading-relaxed overflow-hidden text-slate-300 transition-colors duration-500" 
                   dangerouslySetInnerHTML={{ __html: highlightCode(code, selectedLang) }} 
                 />
                 <textarea 
                   ref={editorRef} 
                   spellCheck={false} 
                   value={code} 
                   onScroll={() => { 
                     if (preRef.current && editorRef.current) { 
                       preRef.current.scrollTop = editorRef.current.scrollTop; 
                       preRef.current.scrollLeft = editorRef.current.scrollLeft; 
                     } 
                   }} 
                   onChange={(e) => { 
                     setCode(e.target.value); 
                     channelRef.current?.send({ type: 'broadcast', event: 'code-update', payload: { code: e.target.value, lang: selectedLang } }); 
                   }} 
                   className="absolute inset-0 p-6 pt-[25px] pl-[56px] bg-transparent text-transparent caret-white resize-none outline-none overflow-auto whitespace-pre-wrap break-words leading-relaxed border-none selection:bg-primary/30" 
                 />
              </div>
            </div>
          ) : (
            <div className="flex-1 relative bg-white overflow-hidden animate-in fade-in duration-500">
              <canvas ref={canvasRef} width={2500} height={2500} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} className={`w-full h-full ${drawingTool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`} />
              
              {activeTextInput && (
                <textarea 
                  ref={textInputRef} 
                  autoFocus 
                  value={currentTextValue} 
                  onChange={(e) => setCurrentTextValue(e.target.value)} 
                  onBlur={finalizeText} 
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finalizeText(); } }}
                  className="absolute bg-white border-2 border-primary outline-none p-3 rounded-xl text-2xl shadow-2xl backdrop-blur-md transition-all placeholder:text-slate-400 z-50 text-slate-900" 
                  placeholder="Type here..."
                  style={{ left: activeTextInput.x, top: activeTextInput.y, fontFamily: drawFontFamily, fontSize: drawFontSize, minWidth: '220px', maxWidth: '400px' }} 
                />
              )}
              
              <div className="absolute top-6 left-6 flex flex-col gap-2 bg-[#161a2d]/95 backdrop-blur-xl p-3 rounded-3xl border border-white/10 shadow-2xl z-40">
                 {['select', 'pencil', 'eraser', 'text', 'rect', 'circle'].map(tool => (
                   <button key={tool} onClick={() => { setDrawingTool(tool as DrawingTool); if (tool !== 'select') setSelectedId(null); }} className={`size-10 flex items-center justify-center rounded-xl transition-all ${drawingTool === tool ? 'bg-primary text-white scale-110 shadow-glow' : 'text-slate-400 hover:bg-white/5'}`}>
                     <span className="material-symbols-outlined !text-xl">{tool === 'select' ? 'near_me' : tool === 'pencil' ? 'edit' : tool === 'eraser' ? 'ink_eraser' : tool === 'text' ? 'title' : tool === 'rect' ? 'rectangle' : 'circle'}</span>
                   </button>
                 ))}
                 <div className="h-px w-full bg-white/10 my-1"></div>
                 {drawingTool === 'text' && (
                   <div className="flex flex-col gap-2 animate-in fade-in zoom-in-95">
                      {[16, 24, 32, 48].map(size => (
                        <button key={size} onClick={() => setDrawFontSize(size)} className={`text-[9px] font-black w-full py-1.5 rounded-lg border ${drawFontSize === size ? 'bg-primary border-primary text-white' : 'border-white/5 text-slate-500'}`}>{size}PX</button>
                      ))}
                   </div>
                 )}
                 <button onClick={() => { setElements([]); setSelectedId(null); channelRef.current?.send({ type: 'broadcast', event: 'clear-canvas' }); }} className="size-10 flex items-center justify-center text-slate-500 hover:text-red-500 transition-all"><span className="material-symbols-outlined">delete_sweep</span></button>
              </div>
            </div>
          )}

          {/* Media Views Overlay (FIXED FOR NO BLACK SCREEN) */}
          <div className="absolute bottom-6 right-6 flex flex-col gap-4 z-40 pointer-events-none">
             <div className="w-64 aspect-video bg-black rounded-3xl border-2 border-primary/30 overflow-hidden relative shadow-2xl pointer-events-auto">
                <video ref={partnerVideoRef} autoPlay playsInline className={`w-full h-full object-cover transition-opacity duration-700 ${partnerMediaStatus.isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
                {partnerMediaStatus.isVideoOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1d2e] text-slate-500">
                    <span className="material-symbols-outlined !text-4xl animate-pulse">person</span>
                    <span className="text-[9px] font-black uppercase tracking-widest mt-3">Node Offline</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-black text-white uppercase tracking-widest border border-white/10">
                   {partner?.name || 'Partner'}
                </div>
                {partnerMediaStatus.isMuted && (
                  <div className="absolute top-3 right-3 bg-red-600 size-7 rounded-full flex items-center justify-center border border-white/20 shadow-lg">
                    <span className="material-symbols-outlined text-white !text-sm">mic_off</span>
                  </div>
                )}
             </div>
             
             <div className="w-48 aspect-video bg-black rounded-3xl border-2 border-white/10 overflow-hidden relative shadow-2xl pointer-events-auto self-end group">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-700 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} 
                />
                {isVideoOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#161a2d] text-slate-600">
                    <span className="material-symbols-outlined !text-3xl">videocam_off</span>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] font-black text-white uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Me</div>
             </div>
          </div>

          {/* Controls Bar */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#161a2d]/95 backdrop-blur-2xl border border-white/10 p-4 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-40 transition-all hover:scale-105">
             <button 
               onClick={() => setIsMuted(!isMuted)} 
               className={`size-12 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-white/5 text-slate-400 hover:text-white'}`}
             >
               <span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span>
             </button>
             <button 
               onClick={() => setIsVideoOff(!isVideoOff)} 
               className={`size-12 rounded-2xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-white/5 text-slate-400 hover:text-white'}`}
             >
               <span className="material-symbols-outlined">{isVideoOff ? 'videocam_off' : 'videocam'}</span>
             </button>
             <div className="h-8 w-px bg-white/10 mx-2"></div>
             <button 
                className="px-6 h-12 rounded-2xl flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] bg-white/5 text-slate-400 hover:text-white transition-all active:scale-95"
             >
                <span className="material-symbols-outlined text-lg">screen_share</span> 
                Mirror Node
             </button>
          </div>
        </div>

        <aside className="w-80 h-full border-l border-white/5 flex flex-col bg-[#161a2d] shadow-2xl z-30">
          <div className="flex border-b border-white/5 p-1 bg-black/20">
             <button onClick={() => setSidebarTab('chat')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ${sidebarTab === 'chat' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>Discussion</button>
             <button onClick={() => setSidebarTab('files')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ${sidebarTab === 'files' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>Assets</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 custom-scrollbar bg-black/20">
             {sidebarTab === 'chat' ? (
               chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                 <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="text-[10px] font-black uppercase text-slate-500">{msg.name}</span>
                      <span className="text-[8px] font-bold text-slate-700">{msg.timestamp}</span>
                    </div>
                    <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none shadow-lg' : 'bg-[#1e2235] text-slate-200 rounded-tl-none border border-white/5'}`}>
                      {msg.text}
                    </div>
                 </div>
               )) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-700 text-center px-10">
                    <span className="material-symbols-outlined !text-5xl mb-4 opacity-10">forum</span>
                    <span className="text-[10px] font-black uppercase tracking-widest leading-loose">Exchange ideas with your peer instantly.</span>
                 </div>
               )
             ) : (
               <div className="space-y-4">
                  <button className="w-full py-10 border-2 border-dashed border-white/5 rounded-3xl text-slate-600 text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-white transition-all bg-white/5">
                    Sync Project Assets
                  </button>
               </div>
             )}
          </div>
          {sidebarTab === 'chat' && (
            <div className="p-4 bg-[#161a2d] border-t border-white/5">
               <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5 focus-within:border-primary/50 transition-colors">
                 <input 
                    value={messageInput} 
                    onChange={(e) => setMessageInput(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
                    placeholder="Message peer..." 
                    className="flex-1 bg-transparent px-4 py-2 text-sm text-white outline-none placeholder:text-slate-700" 
                 />
                 <button onClick={sendMessage} className="size-11 bg-primary text-white rounded-xl flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-glow"><span className="material-symbols-outlined !text-xl">send</span></button>
               </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default LiveSession;
