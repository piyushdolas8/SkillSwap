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
  type: 'stroke' | 'text';
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

const MONO_FONT = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace';
const SANS_FONT = '"Space Grotesk", sans-serif';
const SERIF_FONT = 'Georgia, serif';

const LANGUAGES = [
  { id: 'python', name: 'Python', color: '#3776ab', icon: 'terminal' },
  { id: 'javascript', name: 'JavaScript', color: '#f7df1e', icon: 'javascript' },
  { id: 'typescript', name: 'TypeScript', color: '#3178c6', icon: 'code' },
  { id: 'cpp', name: 'C++', color: '#00599c', icon: 'settings' },
  { id: 'html', name: 'HTML/CSS', color: '#e34f26', icon: 'html' }
];

const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  'python': `# Lesson: Interactive Python\ndef welcome():\n    print("Welcome to SkillSwap!")\n\nwelcome()`,
  'javascript': `// Lesson: Interactive JS\nconst welcome = () => {\n  console.log("Welcome to SkillSwap!");\n};\n\nwelcome();`,
  'typescript': `interface User {\n  id: number;\n  name: string;\n}\n\nconst user: User = { id: 1, name: "Expert" };`,
  'cpp': `#include <iostream>\n\nint main() {\n    std::cout << "Hello Swap!";\n    return 0;\n}`,
  'html': `<!DOCTYPE html>\n<html>\n<body>\n  <h1>SkillSwap Session</h1>\n</body>\n</html>`
};

type SessionMode = 'code' | 'draw';
type SidebarTab = 'chat' | 'files';
type DrawingTool = 'pencil' | 'select' | 'text';

const LiveSession: React.FC<Props> = ({ matchId, partner, skill = 'python', onEnd }) => {
  const [mode, setMode] = useState<SessionMode>('code');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('pencil');
  const [selectedLang, setSelectedLang] = useState(skill.toLowerCase());
  const [code, setCode] = useState<string>(DEFAULT_CODE_TEMPLATES[skill.toLowerCase()] || DEFAULT_CODE_TEMPLATES['python']);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [partnerMediaStatus, setPartnerMediaStatus] = useState({ isMuted: false, isVideoOff: false });
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  
  // Whiteboard state
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawColor, setDrawColor] = useState('#0d33f2');
  const [lineWidth, setLineWidth] = useState(3);
  const [selectedFontSize, setSelectedFontSize] = useState(40);
  const [selectedFontFamily, setSelectedFontFamily] = useState(SANS_FONT);
  
  // Text input state
  const [activeTextInput, setActiveTextInput] = useState<{ x: number, y: number, id: string } | null>(null);
  const [currentTextValue, setCurrentTextValue] = useState('');

  const isInteractingRef = useRef(false);
  const interactionModeRef = useRef<'drawing' | 'moving' | 'rotating' | 'scaling' | null>(null);
  const lastMousePosRef = useRef<Point>({ x: 0, y: 0 });
  const currentStrokeRef = useRef<Point[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);
    };
    getSession();
  }, []);

  useEffect(() => {
    if (!isVideoOff && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isVideoOff]);

  // Fix Text Focus
  useEffect(() => {
    if (activeTextInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [activeTextInput]);

  // Sync Code Language
  useEffect(() => {
    if (DEFAULT_CODE_TEMPLATES[selectedLang] && !code.trim()) {
       setCode(DEFAULT_CODE_TEMPLATES[selectedLang]);
    }
  }, [selectedLang]);

  // Real-time Sync Logic
  useEffect(() => {
    if (!matchId || !currentUserId) return;

    const channel = supabase.channel(`session:${matchId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'code-update' }, (payload) => {
        setCode(payload.payload.code);
        if (payload.payload.lang) setSelectedLang(payload.payload.lang);
      })
      .on('broadcast', { event: 'element-added' }, (payload) => {
        setElements(prev => [...prev, payload.payload.element]);
      })
      .on('broadcast', { event: 'element-transformed' }, (payload) => {
        setElements(prev => prev.map(s => 
          s.id === payload.payload.id ? { ...s, ...payload.payload.transforms } : s
        ));
      })
      .on('broadcast', { event: 'element-deleted' }, (payload) => {
        setElements(prev => prev.filter(s => s.id !== payload.payload.id));
        if (selectedId === payload.payload.id) setSelectedId(null);
      })
      .on('broadcast', { event: 'clear-canvas' }, () => {
        setElements([]);
        setSelectedId(null);
      })
      .on('broadcast', { event: 'file-shared' }, (payload) => {
        setSharedFiles(prev => [payload.payload.file, ...prev]);
      })
      .on('broadcast', { event: 'media-update' }, (payload) => {
        setPartnerMediaStatus(payload.payload);
      });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, [matchId, currentUserId, selectedId]);

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

      if (el.type === 'stroke' && el.points) {
        ctx.strokeStyle = el.color;
        ctx.lineWidth = el.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        el.points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      } else if (el.type === 'text' && el.text) {
        ctx.fillStyle = el.color;
        ctx.font = `${el.fontSize || 24}px ${el.fontFamily || SANS_FONT}`;
        ctx.textBaseline = 'top';
        ctx.fillText(el.text, el.bbox.minX, el.bbox.minY);
      }

      if (selectedId === el.id) {
        ctx.strokeStyle = '#0d33f2';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(el.bbox.minX - 10, el.bbox.minY - 10, (el.bbox.maxX - el.bbox.minX) + 20, (el.bbox.maxY - el.bbox.minY) + 20);
        ctx.setLineDash([]);
        ctx.fillStyle = '#0d33f2';
        ctx.beginPath();
        ctx.arc(centerX, el.bbox.minY - 30, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(el.bbox.maxX + 10, el.bbox.maxY + 10, 12, 12);
      }
      ctx.restore();
    });

    if (interactionModeRef.current === 'drawing' && currentStrokeRef.current.length > 0) {
      ctx.save();
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      currentStrokeRef.current.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }, [elements, selectedId, drawColor, lineWidth]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const getMousePos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    return { 
      x: (clientX - rect.left) * (canvas.width / rect.width), 
      y: (clientY - rect.top) * (canvas.height / rect.height) 
    };
  };

  const handleStartInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeTextInput) { finalizeText(); return; }
    isInteractingRef.current = true;
    const pos = getMousePos(e);
    lastMousePosRef.current = pos;

    if (drawingTool === 'pencil') {
      interactionModeRef.current = 'drawing';
      currentStrokeRef.current = [pos];
    } else if (drawingTool === 'text') {
      setActiveTextInput({ x: pos.x, y: pos.y, id: Math.random().toString(36).substr(2, 9) });
      isInteractingRef.current = false;
    } else {
      const hit = [...elements].reverse().find(s => {
        const centerX = (s.bbox.minX + s.bbox.maxX) / 2;
        const centerY = (s.bbox.minY + s.bbox.maxY) / 2;
        const localX = (pos.x - (s.translateX + centerX)) / s.scale + centerX;
        const localY = (pos.y - (s.translateY + centerY)) / s.scale + centerY;
        return localX >= s.bbox.minX - 20 && localX <= s.bbox.maxX + 20 &&
               localY >= s.bbox.minY - 20 && localY <= s.bbox.maxY + 20;
      });
      if (hit) {
        setSelectedId(hit.id);
        const centerX = (hit.bbox.minX + hit.bbox.maxX) / 2 + hit.translateX;
        const centerY = (hit.bbox.minY + hit.bbox.maxY) / 2 + hit.translateY;
        const distToRotate = Math.hypot(pos.x - centerX, pos.y - (hit.translateY + hit.bbox.minY - 30));
        const distToScale = Math.hypot(pos.x - (hit.translateX + hit.bbox.maxX + 15), pos.y - (hit.translateY + hit.bbox.maxY + 15));
        if (distToRotate < 25) interactionModeRef.current = 'rotating';
        else if (distToScale < 25) interactionModeRef.current = 'scaling';
        else interactionModeRef.current = 'moving';
      } else {
        setSelectedId(null);
        interactionModeRef.current = null;
      }
    }
  };

  const handleMoveInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isInteractingRef.current) return;
    const pos = getMousePos(e);
    const dx = pos.x - lastMousePosRef.current.x;
    const dy = pos.y - lastMousePosRef.current.y;

    if (interactionModeRef.current === 'drawing') {
      currentStrokeRef.current.push(pos);
      renderCanvas();
    } else if (selectedId) {
      setElements(prev => prev.map(s => {
        if (s.id !== selectedId) return s;
        let newT = { ...s };
        if (interactionModeRef.current === 'moving') { newT.translateX += dx; newT.translateY += dy; }
        else if (interactionModeRef.current === 'scaling') { newT.scale = Math.max(0.1, s.scale + dx / 150); }
        else if (interactionModeRef.current === 'rotating') {
          const cX = (s.bbox.minX + s.bbox.maxX) / 2 + s.translateX;
          const cY = (s.bbox.minY + s.bbox.maxY) / 2 + s.translateY;
          newT.rotation = Math.atan2(pos.y - cY, pos.x - cX) + Math.PI/2;
        }
        channelRef.current?.send({
          type: 'broadcast',
          event: 'element-transformed',
          payload: { id: s.id, transforms: { translateX: newT.translateX, translateY: newT.translateY, scale: newT.scale, rotation: newT.rotation } }
        });
        return newT;
      }));
    }
    lastMousePosRef.current = pos;
  };

  const handleEndInteraction = () => {
    if (interactionModeRef.current === 'drawing' && currentStrokeRef.current.length > 1) {
      const minX = Math.min(...currentStrokeRef.current.map(p => p.x));
      const minY = Math.min(...currentStrokeRef.current.map(p => p.y));
      const maxX = Math.max(...currentStrokeRef.current.map(p => p.x));
      const maxY = Math.max(...currentStrokeRef.current.map(p => p.y));
      const newEl: CanvasElement = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'stroke',
        points: [...currentStrokeRef.current],
        color: drawColor, width: lineWidth,
        translateX: 0, translateY: 0, rotation: 0, scale: 1,
        bbox: { minX, minY, maxX, maxY }
      };
      setElements(prev => [...prev, newEl]);
      channelRef.current?.send({ type: 'broadcast', event: 'element-added', payload: { element: newEl } });
    }
    isInteractingRef.current = false;
    interactionModeRef.current = null;
    currentStrokeRef.current = [];
    renderCanvas();
  };

  const finalizeText = () => {
    if (activeTextInput && currentTextValue.trim()) {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.font = `${selectedFontSize}px ${selectedFontFamily}`;
        const metrics = ctx.measureText(currentTextValue);
        const newEl: CanvasElement = {
          id: activeTextInput.id, type: 'text', text: currentTextValue, color: drawColor,
          fontFamily: selectedFontFamily, fontSize: selectedFontSize, width: 1,
          translateX: 0, translateY: 0, rotation: 0, scale: 1,
          bbox: { minX: activeTextInput.x, minY: activeTextInput.y, maxX: activeTextInput.x + metrics.width, maxY: activeTextInput.y + selectedFontSize }
        };
        setElements(prev => [...prev, newEl]);
        channelRef.current?.send({ type: 'broadcast', event: 'element-added', payload: { element: newEl } });
      }
    }
    setActiveTextInput(null);
    setCurrentTextValue('');
  };

  const deleteSelectedElement = () => {
    if (!selectedId) return;
    setElements(prev => prev.filter(el => el.id !== selectedId));
    channelRef.current?.send({ type: 'broadcast', event: 'element-deleted', payload: { id: selectedId } });
    setSelectedId(null);
  };

  const clearCanvas = () => {
    if (confirm("Clear whiteboard?")) {
      setElements([]);
      setSelectedId(null);
      channelRef.current?.send({ type: 'broadcast', event: 'clear-canvas' });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !matchId || !currentUserId) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `shared/${matchId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const newFile: SharedFile = {
        id: Math.random().toString(36).substring(2),
        name: file.name,
        url: publicUrl,
        size: file.size,
        uploader_name: 'Me',
        created_at: new Date().toISOString()
      };

      setSharedFiles(prev => [newFile, ...prev]);
      channelRef.current?.send({ type: 'broadcast', event: 'file-shared', payload: { file: newFile } });
    } catch (err: any) {
      console.error("Storage error:", err);
      setErrorNotification("File upload failed. Check connection.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        screenStreamRef.current?.getTracks().forEach(track => track.stop());
        setIsScreenSharing(false);
      } else {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
        stream.getVideoTracks()[0].onended = () => setIsScreenSharing(false);
        setIsScreenSharing(true);
      }
    } catch (err) {
      setErrorNotification("Screen capture declined.");
      setIsScreenSharing(false);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !matchId || !currentUserId) return;
    const { error } = await supabase.from('messages').insert({ match_id: matchId, sender_id: currentUserId, content: messageInput });
    if (!error) setMessageInput('');
  };

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e) { setErrorNotification("Media access required."); }
    };
    initMedia();
    return () => { 
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const activeLang = LANGUAGES.find(l => l.id === selectedLang) || LANGUAGES[0];

  return (
    <div className="flex flex-col h-screen w-full bg-background-dark overflow-hidden font-display relative">
      {errorNotification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-400/50">
            <span className="material-symbols-outlined">warning</span>
            <span className="text-sm font-bold uppercase">{errorNotification}</span>
            <button onClick={() => setErrorNotification(null)}><span className="material-symbols-outlined !text-sm">close</span></button>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between border-b border-border-dark px-6 py-3 bg-background-dark/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-6">
          <div className="size-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path></svg>
          </div>
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/5">
            <button onClick={() => setMode('code')} className={`px-6 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'code' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>Editor</button>
            <button onClick={() => setMode('draw')} className={`px-6 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'draw' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>Whiteboard</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Sync</span>
           </div>
           <button onClick={onEnd} className="bg-red-600/20 text-red-500 text-[10px] font-black h-9 px-6 rounded-lg hover:bg-red-600 hover:text-white transition-all uppercase tracking-[0.2em]">End</button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-4 bg-background-dark relative">
          <div className="flex-1 relative rounded-3xl overflow-hidden bg-[#0d0f1a] border border-border-dark flex flex-col shadow-2xl">
            {mode === 'code' ? (
              <div className="flex-1 flex flex-col relative group">
                <div className="h-14 flex items-center justify-between px-6 bg-white/5 border-b border-white/5 backdrop-blur-xl">
                   <div className="flex items-center gap-3">
                      <div className="size-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: activeLang.color }}>
                         <span className="material-symbols-outlined !text-lg">{activeLang.icon}</span>
                      </div>
                      <select 
                        value={selectedLang} 
                        onChange={(e) => {
                          const newLang = e.target.value;
                          setSelectedLang(newLang);
                          channelRef.current?.send({ type: 'broadcast', event: 'code-update', payload: { code, lang: newLang } });
                        }}
                        className="bg-transparent text-white text-[11px] font-black uppercase tracking-widest border-none p-0 outline-none cursor-pointer hover:text-primary transition-colors"
                      >
                         {LANGUAGES.map(lang => <option key={lang.id} value={lang.id} className="bg-card-dark">{lang.name}</option>)}
                      </select>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-primary/40 animate-ping"></div>
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Live Editor</span>
                   </div>
                </div>
                <div className="flex-1 relative flex overflow-hidden">
                   <div className="w-14 bg-black/40 flex flex-col items-center pt-6 text-[10px] font-mono text-slate-700 select-none border-r border-white/5">
                      {code.split('\n').map((_, i) => <div key={i} className="h-6 leading-6">{i + 1}</div>)}
                   </div>
                   <textarea
                    ref={editorRef}
                    spellCheck={false} value={code}
                    onChange={(e) => {
                      const newCode = e.target.value;
                      setCode(newCode);
                      channelRef.current?.send({ type: 'broadcast', event: 'code-update', payload: { code: newCode, lang: selectedLang } });
                    }}
                    className="flex-1 p-6 bg-transparent text-slate-300 font-mono text-sm resize-none outline-none custom-scrollbar leading-6"
                    style={{ fontFamily: MONO_FONT, caretColor: activeLang.color }}
                    placeholder={`// Enter ${activeLang.name} code...`}
                  />
                  <div 
                    className="absolute inset-0 pointer-events-none border-2 border-transparent transition-all duration-700 rounded-b-3xl"
                    style={{ borderColor: `${activeLang.color}20`, boxShadow: `inset 0 0 40px ${activeLang.color}05` }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="flex-1 relative bg-white overflow-hidden">
                <canvas ref={canvasRef} width={1600} height={1200} onMouseDown={handleStartInteraction} onMouseMove={handleMoveInteraction} onMouseUp={handleEndInteraction} onMouseLeave={handleEndInteraction} className={`w-full h-full ${drawingTool === 'pencil' ? 'cursor-crosshair' : drawingTool === 'text' ? 'cursor-text' : 'cursor-default'}`} />
                {activeTextInput && (
                  <textarea 
                    ref={textInputRef} 
                    value={currentTextValue} 
                    onChange={(e) => setCurrentTextValue(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finalizeText(); } }} 
                    onBlur={finalizeText} 
                    className="absolute bg-transparent border-none outline-none p-0 overflow-hidden resize-none whitespace-pre z-50" 
                    style={{ 
                      left: `${(activeTextInput.x / 1600) * 100}%`, 
                      top: `${(activeTextInput.y / 1200) * 100}%`, 
                      color: drawColor, 
                      fontSize: `${(selectedFontSize / 1200) * 100}vh`,
                      fontFamily: selectedFontFamily, 
                      lineHeight: '1', 
                      minWidth: '200px',
                      caretColor: drawColor
                    }} 
                  />
                )}
                <div className="absolute top-6 left-6 flex flex-col gap-2 bg-[#1a1d2d]/90 backdrop-blur-lg p-3 rounded-2xl border border-white/10 shadow-2xl z-40">
                   <button onClick={() => setDrawingTool('pencil')} className={`size-10 flex items-center justify-center rounded-xl transition-all ${drawingTool === 'pencil' ? 'bg-primary text-white shadow-glow' : 'text-slate-400 hover:bg-white/5'}`}><span className="material-symbols-outlined">edit</span></button>
                   <button onClick={() => setDrawingTool('text')} className={`size-10 flex items-center justify-center rounded-xl transition-all ${drawingTool === 'text' ? 'bg-primary text-white shadow-glow' : 'text-slate-400 hover:bg-white/5'}`}><span className="material-symbols-outlined">title</span></button>
                   <button onClick={() => setDrawingTool('select')} className={`size-10 flex items-center justify-center rounded-xl transition-all ${drawingTool === 'select' ? 'bg-primary text-white shadow-glow' : 'text-slate-400 hover:bg-white/5'}`}><span className="material-symbols-outlined">near_me</span></button>
                   {selectedId && <button onClick={deleteSelectedElement} className="size-10 flex items-center justify-center rounded-xl transition-all bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white"><span className="material-symbols-outlined">delete</span></button>}
                   <div className="h-px w-full bg-white/10 my-1"></div>
                   <div className="flex flex-col gap-2 items-center">
                     <button onClick={() => setDrawColor('#0d33f2')} className={`size-7 rounded-full border-2 ${drawColor === '#0d33f2' ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: '#0d33f2' }}></button>
                     <button onClick={() => setDrawColor('#ef4444')} className={`size-7 rounded-full border-2 ${drawColor === '#ef4444' ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: '#ef4444' }}></button>
                     <button onClick={() => setDrawColor('#10b981')} className={`size-7 rounded-full border-2 ${drawColor === '#10b981' ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: '#10b981' }}></button>
                   </div>
                   <div className="h-px w-full bg-white/10 my-1"></div>
                   <button onClick={clearCanvas} className="size-10 flex items-center justify-center text-slate-500 hover:bg-white/5 rounded-xl transition-all"><span className="material-symbols-outlined">delete_sweep</span></button>
                </div>
              </div>
            )}
            
            <div className="absolute bottom-6 left-6 flex gap-4 z-20 pointer-events-none">
              <div className="w-48 aspect-video bg-[#0a0c16] rounded-2xl border-2 border-primary overflow-hidden relative shadow-glow pointer-events-auto flex items-center justify-center">
                {partnerMediaStatus.isVideoOff ? <div className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Partner Offline</div> : <video ref={partnerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />}
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-widest">{partner?.name || 'Partner'}</div>
              </div>
              <div className="w-40 aspect-video bg-black rounded-2xl border-2 border-emerald-500 overflow-hidden relative shadow-glow pointer-events-auto flex items-center justify-center">
                {isVideoOff ? <div className="absolute inset-0 bg-slate-900 flex items-center justify-center"><p className="text-[7px] font-black uppercase text-slate-500">Self Off</p></div> : <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />}
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-widest">You</div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center pb-6">
            <div className="flex items-center gap-3 bg-[#1a1d2d]/95 backdrop-blur-xl border border-white/5 p-3 rounded-2xl shadow-2xl">
              <button onClick={() => setIsMuted(!isMuted)} className={`size-12 flex items-center justify-center rounded-xl transition-all ${isMuted ? 'bg-red-600 text-white shadow-glow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span></button>
              <button onClick={() => setIsVideoOff(!isVideoOff)} className={`size-12 flex items-center justify-center rounded-xl transition-all ${isVideoOff ? 'bg-red-600 text-white shadow-glow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined">{isVideoOff ? 'videocam_off' : 'videocam'}</span></button>
              <button onClick={toggleScreenShare} className={`px-6 h-12 flex items-center gap-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isScreenSharing ? 'bg-primary text-white shadow-glow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined text-sm">screen_share</span>{isScreenSharing ? 'Stop' : 'Share'}</button>
            </div>
          </div>
        </div>

        <aside className="w-[400px] h-full border-l border-border-dark flex flex-col bg-[#0b0c14] relative">
          <div className="flex border-b border-white/5 bg-black/20">
             <button onClick={() => setSidebarTab('chat')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'chat' ? 'text-primary bg-primary/5 border-b-2 border-primary' : 'text-slate-500 hover:text-white'}`}>Chat</button>
             <button onClick={() => setSidebarTab('files')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'files' ? 'text-primary bg-primary/5 border-b-2 border-primary' : 'text-slate-500 hover:text-white'}`}>Vault</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {sidebarTab === 'chat' ? (
              <div className="p-6 space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={msg.id || i} className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] font-black text-slate-500 uppercase">{msg.name}</span>
                    <div className={`p-4 rounded-2xl max-w-[85%] text-sm ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none shadow-glow' : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'}`}>{msg.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-white text-sm font-bold tracking-tight">Session Vault</h4>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Shared Assets</p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="size-10 bg-primary/10 border border-primary/20 text-primary rounded-xl flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                    <span className="material-symbols-outlined">add</span>
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                </div>
                
                {isUploading && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-3 animate-pulse">
                    <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                    <p className="text-white text-xs font-bold uppercase tracking-widest">Uploading...</p>
                  </div>
                )}

                {sharedFiles.length === 0 && !isUploading ? (
                  <div className="py-24 text-center text-slate-600 flex flex-col items-center">
                    <span className="material-symbols-outlined !text-6xl mb-4 opacity-10">inventory_2</span>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30">No files shared yet</p>
                  </div>
                ) : (
                  sharedFiles.map(file => (
                    <div key={file.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-primary/40 transition-all group">
                       <div className="size-12 rounded-xl bg-black/40 flex items-center justify-center text-slate-500 overflow-hidden border border-white/5">
                          {file.name.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) ? (
                            <img src={file.url} className="w-full h-full object-cover" alt="preview" />
                          ) : (
                            <span className="material-symbols-outlined !text-xl">description</span>
                          )}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-white text-xs font-bold truncate mb-0.5">{file.name}</p>
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-tight">{formatFileSize(file.size)} • {file.uploader_name}</p>
                       </div>
                       <a href={file.url} download target="_blank" className="size-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white transition-all">
                          <span className="material-symbols-outlined text-sm">download</span>
                       </a>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          {sidebarTab === 'chat' && (
            <div className="p-6 border-t border-white/5 flex gap-2 bg-black/20">
              <input type="text" value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Message..." className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-700" />
              <button onClick={sendMessage} className="size-12 bg-primary text-white rounded-xl flex items-center justify-center shadow-glow transition-transform active:scale-90"><span className="material-symbols-outlined">send</span></button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default LiveSession;