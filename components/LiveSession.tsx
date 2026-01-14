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

const MONO_FONT = '"JetBrains Mono", "Fira Code", "SFMono-Regular", Consolas, monospace';
const SANS_FONT = '"Space Grotesk", sans-serif';
const SERIF_FONT = 'Georgia, serif';

const LANGUAGES = [
  { id: 'python', name: 'Python', color: '#3776ab', icon: 'terminal', glow: 'rgba(55, 118, 171, 0.4)' },
  { id: 'javascript', name: 'JavaScript', color: '#f7df1e', icon: 'javascript', glow: 'rgba(247, 223, 30, 0.4)' },
  { id: 'typescript', name: 'TypeScript', color: '#3178c6', icon: 'code', glow: 'rgba(49, 120, 198, 0.4)' },
  { id: 'cpp', name: 'C++', color: '#659ad2', icon: 'settings', glow: 'rgba(101, 154, 210, 0.4)' },
  { id: 'html', name: 'HTML/CSS', color: '#e34f26', icon: 'html', glow: 'rgba(227, 79, 38, 0.4)' }
];

const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  'python': `# SkillSwap Python Session\n\ndef main():\n    print("Hello, Peer!")\n\nif __name__ == "__main__":\n    main()`,
  'javascript': `// SkillSwap JS Session\n\nconst greet = () => {\n  console.log("Collaborative coding is fun!");\n};\n\ngreet();`,
  'typescript': `interface User {\n  id: string;\n  skill: string;\n}\n\nconst user: User = {\n  id: "123",\n  skill: "Expert"\n};`,
  'cpp': `#include <iostream>\n\nint main() {\n    std::cout << "Learning together!" << std::endl;\n    return 0;\n}`,
  'html': `<!-- SkillSwap Sandbox -->\n<div class="container">\n  <h1>Peer Learning</h1>\n  <p>Start trading skills today.</p>\n</div>\n\n<style>\n  .container { color: #0d33f2; }\n</style>`
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
  
  // Media States
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [partnerMediaStatus, setPartnerMediaStatus] = useState({ isMuted: false, isVideoOff: false });
  
  const [isUploading, setIsUploading] = useState(false);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  
  // Whiteboard state
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawColor, setDrawColor] = useState('#0d33f2');
  const [lineWidth, setLineWidth] = useState(3);
  const [selectedFontSize, setSelectedFontSize] = useState(48);
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

  // Sync Hardware Tracks with State
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOff;
      });

      // Broadcast update to partner
      channelRef.current?.send({
        type: 'broadcast',
        event: 'media-update',
        payload: { isMuted, isVideoOff }
      });
    }
  }, [isMuted, isVideoOff]);

  useEffect(() => {
    if (!isVideoOff && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isVideoOff]);

  // Fix Text Focus when tool is active
  useEffect(() => {
    if (activeTextInput && textInputRef.current) {
      const t = setTimeout(() => textInputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [activeTextInput]);

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
        // Broadcast initial media state
        channel.send({
          type: 'broadcast',
          event: 'media-update',
          payload: { isMuted, isVideoOff }
        });
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
        ctx.fillRect(el.bbox.maxX + 10, el.bbox.maxY + 10, 15, 15);
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
        return localX >= s.bbox.minX - 25 && localX <= s.bbox.maxX + 25 &&
               localY >= s.bbox.minY - 25 && localY <= s.bbox.maxY + 25;
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

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setErrorNotification("Code copied to clipboard!");
    setTimeout(() => setErrorNotification(null), 2000);
  };

  const handleDownloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = activeLang.id === 'python' ? 'py' : activeLang.id === 'cpp' ? 'cpp' : activeLang.id === 'html' ? 'html' : 'js';
    a.download = `skillswap-session.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        
        // Initial hardware set
        stream.getAudioTracks().forEach(t => t.enabled = !isMuted);
        stream.getVideoTracks().forEach(t => t.enabled = !isVideoOff);
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
          <div className="bg-primary text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 backdrop-blur-md">
            <span className="material-symbols-outlined">info</span>
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
          <div className="flex bg-white/5 rounded-2xl p-1 border border-white/10">
            <button onClick={() => setMode('code')} className={`px-8 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'code' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>IDE Mode</button>
            <button onClick={() => setMode('draw')} className={`px-8 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'draw' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>Whiteboard</button>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Connected</span>
           </div>
           <button onClick={onEnd} className="bg-red-600/10 text-red-500 border border-red-500/20 text-[10px] font-black h-10 px-8 rounded-xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-[0.2em] shadow-lg">Leave Session</button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-6 gap-6 bg-background-dark relative">
          <div className="flex-1 relative rounded-[2.5rem] overflow-hidden bg-[#0d0f1a] border border-border-dark flex flex-col shadow-2xl transition-all duration-500 group">
            {mode === 'code' ? (
              <div className="flex-1 flex flex-col relative">
                {/* Enhanced IDE Header */}
                <div className="h-16 flex items-center justify-between px-8 bg-white/5 border-b border-white/5 backdrop-blur-2xl">
                   <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110" style={{ backgroundColor: activeLang.color, boxShadow: `0 0 20px ${activeLang.glow}` }}>
                         <span className="material-symbols-outlined !text-xl">{activeLang.icon}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Language Scope</span>
                        <select 
                          value={selectedLang} 
                          onChange={(e) => {
                            const newLang = e.target.value;
                            setSelectedLang(newLang);
                            channelRef.current?.send({ type: 'broadcast', event: 'code-update', payload: { code, lang: newLang } });
                          }}
                          className="bg-transparent text-white text-[12px] font-black uppercase tracking-widest border-none p-0 outline-none cursor-pointer hover:text-primary transition-colors appearance-none"
                        >
                           {LANGUAGES.map(lang => <option key={lang.id} value={lang.id} className="bg-[#1a1d2d]">{lang.name}</option>)}
                        </select>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-3">
                      <button onClick={handleCopyCode} title="Copy Code" className="size-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all border border-white/5">
                        <span className="material-symbols-outlined !text-xl">content_copy</span>
                      </button>
                      <button onClick={handleDownloadCode} title="Download Source" className="size-10 rounded-xl bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all border border-white/5">
                        <span className="material-symbols-outlined !text-xl">download</span>
                      </button>
                      <div className="h-8 w-px bg-white/10 mx-2"></div>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-lg border border-white/5">
                         <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Collab Ready</span>
                      </div>
                   </div>
                </div>

                <div className="flex-1 relative flex overflow-hidden">
                   {/* Styled Gutter */}
                   <div className="w-16 bg-black/30 flex flex-col items-center pt-8 text-[11px] font-mono text-slate-700 select-none border-r border-white/5" style={{ color: `${activeLang.color}60` }}>
                      {code.split('\n').map((_, i) => (
                        <div key={i} className="h-6 leading-6 flex items-center justify-center w-full transition-colors hover:text-white">
                          {i + 1}
                        </div>
                      ))}
                   </div>

                   <textarea
                    ref={editorRef}
                    spellCheck={false} value={code}
                    onChange={(e) => {
                      const newCode = e.target.value;
                      setCode(newCode);
                      channelRef.current?.send({ type: 'broadcast', event: 'code-update', payload: { code: newCode, lang: selectedLang } });
                    }}
                    className="flex-1 p-8 bg-transparent text-slate-300 font-mono text-[14px] resize-none outline-none custom-scrollbar leading-6"
                    style={{ fontFamily: MONO_FONT, caretColor: activeLang.color }}
                    placeholder={`// Enter ${activeLang.name} masterclass code here...`}
                  />

                  {/* Dynamic Glowing Accents */}
                  <div 
                    className="absolute inset-0 pointer-events-none border-2 transition-all duration-700 rounded-b-[2.5rem]"
                    style={{ borderColor: `${activeLang.color}15`, boxShadow: `inset 0 0 60px ${activeLang.color}05` }}
                  ></div>
                  <div 
                    className="absolute top-0 right-0 w-64 h-64 blur-[100px] pointer-events-none transition-all duration-700 opacity-20"
                    style={{ background: activeLang.color }}
                  ></div>
                </div>

                {/* Footer "Terminal" Stats */}
                <div className="h-10 px-8 bg-black/40 border-t border-white/5 flex items-center justify-between text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">
                   <div className="flex gap-6">
                      <span>Chars: {code.length}</span>
                      <span>Lines: {code.split('\n').length}</span>
                   </div>
                   <div className="flex gap-4">
                      <span>UTF-8</span>
                      <span className="text-primary">{activeLang.name} Runtime Simulation</span>
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 relative bg-white overflow-hidden">
                <canvas 
                  ref={canvasRef} 
                  width={1600} 
                  height={1200} 
                  onMouseDown={handleStartInteraction} 
                  onMouseMove={handleMoveInteraction} 
                  onMouseUp={handleEndInteraction} 
                  onMouseLeave={handleEndInteraction} 
                  className={`w-full h-full ${drawingTool === 'pencil' ? 'cursor-crosshair' : drawingTool === 'text' ? 'cursor-text' : 'cursor-default'}`} 
                />
                
                {/* Whiteboard Overlay Text Tool */}
                {activeTextInput && (
                  <textarea 
                    ref={textInputRef} 
                    value={currentTextValue} 
                    onChange={(e) => setCurrentTextValue(e.target.value)} 
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finalizeText(); } }} 
                    onBlur={finalizeText} 
                    className="absolute bg-transparent border-none outline-none p-0 overflow-hidden resize-none whitespace-pre z-50 text-center" 
                    style={{ 
                      left: `${(activeTextInput.x / 1600) * 100}%`, 
                      top: `${(activeTextInput.y / 1200) * 100}%`, 
                      color: drawColor, 
                      fontSize: `${(selectedFontSize / 1200) * 100}vh`,
                      fontFamily: selectedFontFamily, 
                      lineHeight: '1', 
                      minWidth: '300px',
                      transform: 'translate(-50%, -50%)',
                      caretColor: drawColor
                    }} 
                  />
                )}

                {/* Draw Toolbar */}
                <div className="absolute top-8 left-8 flex flex-col gap-3 bg-[#1a1d2d]/90 backdrop-blur-2xl p-4 rounded-[2rem] border border-white/10 shadow-2xl z-40">
                   <button onClick={() => setDrawingTool('pencil')} className={`size-12 flex items-center justify-center rounded-2xl transition-all ${drawingTool === 'pencil' ? 'bg-primary text-white shadow-glow scale-110' : 'text-slate-400 hover:bg-white/5'}`}><span className="material-symbols-outlined !text-2xl">edit</span></button>
                   <button onClick={() => setDrawingTool('text')} className={`size-12 flex items-center justify-center rounded-2xl transition-all ${drawingTool === 'text' ? 'bg-primary text-white shadow-glow scale-110' : 'text-slate-400 hover:bg-white/5'}`}><span className="material-symbols-outlined !text-2xl">title</span></button>
                   <button onClick={() => setDrawingTool('select')} className={`size-12 flex items-center justify-center rounded-2xl transition-all ${drawingTool === 'select' ? 'bg-primary text-white shadow-glow scale-110' : 'text-slate-400 hover:bg-white/5'}`}><span className="material-symbols-outlined !text-2xl">near_me</span></button>
                   
                   {selectedId && <button onClick={deleteSelectedElement} className="size-12 flex items-center justify-center rounded-2xl transition-all bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white"><span className="material-symbols-outlined !text-2xl">delete</span></button>}
                   
                   <div className="h-px w-full bg-white/10 my-1"></div>
                   
                   <div className="flex flex-col gap-3 items-center">
                     <button onClick={() => setDrawColor('#0d33f2')} className={`size-8 rounded-full border-2 ${drawColor === '#0d33f2' ? 'border-white scale-125' : 'border-transparent opacity-60'}`} style={{ backgroundColor: '#0d33f2' }}></button>
                     <button onClick={() => setDrawColor('#ef4444')} className={`size-8 rounded-full border-2 ${drawColor === '#ef4444' ? 'border-white scale-125' : 'border-transparent opacity-60'}`} style={{ backgroundColor: '#ef4444' }}></button>
                     <button onClick={() => setDrawColor('#10b981')} className={`size-8 rounded-full border-2 ${drawColor === '#10b981' ? 'border-white scale-125' : 'border-transparent opacity-60'}`} style={{ backgroundColor: '#10b981' }}></button>
                   </div>
                   
                   <div className="h-px w-full bg-white/10 my-1"></div>
                   <button onClick={clearCanvas} className="size-12 flex items-center justify-center text-slate-500 hover:bg-red-500/10 hover:text-red-500 rounded-2xl transition-all"><span className="material-symbols-outlined !text-2xl">delete_sweep</span></button>
                </div>
              </div>
            )}
            
            {/* Peer Media Overlay HUD */}
            <div className="absolute bottom-8 left-8 flex gap-6 z-20 pointer-events-none">
              <div className="w-56 aspect-video bg-[#0a0c16]/80 backdrop-blur-xl rounded-[2rem] border-2 border-primary overflow-hidden relative shadow-glow pointer-events-auto flex items-center justify-center">
                {partnerMediaStatus.isVideoOff ? (
                  <div className="text-center">
                    <span className="material-symbols-outlined text-slate-600 !text-3xl mb-2">videocam_off</span>
                    <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Partner Cam Off</p>
                  </div>
                ) : (
                  <video ref={partnerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                )}
                
                {/* Partner Indicators */}
                {partnerMediaStatus.isMuted && (
                  <div className="absolute top-3 right-3 bg-red-600/80 backdrop-blur-md size-8 rounded-lg flex items-center justify-center text-white border border-white/10 shadow-lg">
                    <span className="material-symbols-outlined !text-lg">mic_off</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-primary/20 backdrop-blur-md px-3 py-1 rounded-lg text-[9px] font-black text-white uppercase tracking-widest border border-primary/30">{partner?.name || 'Partner'}</div>
              </div>

              <div className="w-48 aspect-video bg-black rounded-[2rem] border-2 border-emerald-500 overflow-hidden relative shadow-glow pointer-events-auto flex items-center justify-center">
                {isVideoOff ? (
                  <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center">
                    <span className="material-symbols-outlined text-slate-700 !text-2xl">visibility_off</span>
                  </div>
                ) : (
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                )}
                {isMuted && (
                  <div className="absolute top-3 right-3 bg-red-600/60 backdrop-blur-md size-6 rounded-lg flex items-center justify-center text-white border border-white/10">
                    <span className="material-symbols-outlined !text-sm">mic_off</span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-emerald-500/20 backdrop-blur-md px-3 py-1 rounded-lg text-[9px] font-black text-white uppercase tracking-widest border border-emerald-500/30">Self</div>
              </div>
            </div>

            {/* Floating Screen Share Window */}
            {isScreenSharing && (
              <div className="absolute top-8 right-8 w-72 aspect-video bg-black rounded-3xl border-2 border-primary overflow-hidden shadow-2xl z-30 pointer-events-auto">
                 <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                 <div className="absolute top-2 right-2 bg-red-600 px-2 py-0.5 rounded text-[8px] font-black text-white uppercase tracking-widest">Streaming</div>
              </div>
            )}
          </div>
          
          {/* Global Media HUD */}
          <div className="flex justify-center">
            <div className="flex items-center gap-4 bg-[#1a1d2d]/90 backdrop-blur-3xl border border-white/10 p-4 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className={`size-14 flex items-center justify-center rounded-2xl transition-all ${isMuted ? 'bg-red-600 text-white shadow-glow animate-pulse' : 'bg-white/5 text-slate-400 hover:text-white'}`}
              >
                <span className="material-symbols-outlined !text-2xl">{isMuted ? 'mic_off' : 'mic'}</span>
              </button>
              <button 
                onClick={() => setIsVideoOff(!isVideoOff)} 
                className={`size-14 flex items-center justify-center rounded-2xl transition-all ${isVideoOff ? 'bg-red-600 text-white shadow-glow' : 'bg-white/5 text-slate-400 hover:text-white'}`}
              >
                <span className="material-symbols-outlined !text-2xl">{isVideoOff ? 'videocam_off' : 'videocam'}</span>
              </button>
              <button 
                onClick={toggleScreenShare} 
                className={`px-10 h-14 flex items-center gap-3 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all ${isScreenSharing ? 'bg-primary text-white shadow-glow' : 'bg-white/5 text-slate-400 hover:text-white'}`}
              >
                <span className="material-symbols-outlined text-lg">screen_share</span>
                {isScreenSharing ? 'Stop Broadcast' : 'Present Screen'}
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Sidebar */}
        <aside className="w-[450px] h-full border-l border-border-dark flex flex-col bg-[#0b0c14] relative shadow-[-20px_0_50px_rgba(0,0,0,0.4)]">
          <div className="flex border-b border-white/5 bg-black/20 p-2">
             <button onClick={() => setSidebarTab('chat')} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ${sidebarTab === 'chat' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>Peer Chat</button>
             <button onClick={() => setSidebarTab('files')} className={`flex-1 py-4 text-[11px] font-black uppercase tracking-[0.2em] transition-all rounded-xl ${sidebarTab === 'files' ? 'text-primary bg-primary/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>Resource Vault</button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {sidebarTab === 'chat' ? (
              <div className="p-8 space-y-6">
                {chatMessages.length === 0 && (
                  <div className="py-20 text-center text-slate-700 flex flex-col items-center">
                    <span className="material-symbols-outlined !text-5xl mb-4 opacity-10">chat_bubble</span>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-20">No messages exchanged yet</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={msg.id || i} className={`flex flex-col gap-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-600 uppercase">{msg.name}</span>
                      <span className="text-[8px] font-bold text-slate-800 uppercase">{msg.timestamp}</span>
                    </div>
                    <div className={`p-5 rounded-3xl max-w-[90%] text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none shadow-glow-primary' : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5 backdrop-blur-md'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h4 className="text-white text-lg font-black tracking-tighter uppercase mb-1">Session Vault</h4>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shared Assets & Proofs</p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="size-12 bg-primary/10 border border-primary/20 text-primary rounded-2xl flex items-center justify-center hover:bg-primary hover:text-white transition-all shadow-lg group">
                    <span className="material-symbols-outlined group-hover:rotate-90 transition-transform">add</span>
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                </div>
                
                {isUploading && (
                  <div className="p-6 bg-primary/5 border border-primary/20 rounded-3xl flex items-center gap-4 animate-pulse">
                    <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                    <div>
                      <p className="text-white text-xs font-black uppercase tracking-widest">Transmitting...</p>
                      <p className="text-[9px] font-bold text-primary uppercase opacity-60">Encrypting P2P Stream</p>
                    </div>
                  </div>
                )}

                {sharedFiles.length === 0 && !isUploading ? (
                  <div className="py-28 text-center text-slate-800 flex flex-col items-center">
                    <span className="material-symbols-outlined !text-7xl mb-6 opacity-5">cloud_upload</span>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-20">The vault is currently empty</p>
                    <p className="text-[8px] font-bold text-slate-800 uppercase tracking-widest mt-2">Upload resources to sync across the network</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {sharedFiles.map(file => (
                      <div key={file.id} className="p-5 bg-white/5 border border-white/5 rounded-3xl flex items-center gap-5 hover:border-primary/40 hover:bg-white/10 transition-all group relative overflow-hidden">
                         <div className="size-14 rounded-2xl bg-black/40 flex items-center justify-center text-slate-500 overflow-hidden border border-white/5 group-hover:text-primary transition-all">
                            {file.name.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i) ? (
                              <img src={file.url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100" alt="preview" />
                            ) : (
                              <span className="material-symbols-outlined !text-2xl">description</span>
                            )}
                         </div>
                         <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-bold truncate mb-1">{file.name}</p>
                            <div className="flex items-center gap-3">
                               <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">{formatFileSize(file.size)}</span>
                               <div className="size-1 rounded-full bg-slate-800"></div>
                               <span className="text-[9px] font-black text-primary uppercase tracking-tighter">{file.uploader_name}</span>
                            </div>
                         </div>
                         <a href={file.url} download target="_blank" className="size-11 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 hover:bg-primary hover:text-white transition-all shadow-xl group-hover:scale-110 active:scale-95">
                            <span className="material-symbols-outlined text-xl">download</span>
                         </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {sidebarTab === 'chat' && (
            <div className="p-8 border-t border-white/5 flex gap-3 bg-black/30 backdrop-blur-md">
              <input 
                type="text" 
                value={messageInput} 
                onChange={(e) => setMessageInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()} 
                placeholder="Message the network..." 
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-800" 
              />
              <button 
                onClick={sendMessage} 
                className="size-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-glow transition-all hover:scale-110 active:scale-90"
              >
                <span className="material-symbols-outlined">send</span>
              </button>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default LiveSession;