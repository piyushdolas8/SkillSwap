
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
  { id: 'python', name: 'Python', color: '#3776ab', icon: 'terminal' },
  { id: 'javascript', name: 'JavaScript', color: '#f7df1e', icon: 'javascript' },
  { id: 'typescript', name: 'TypeScript', color: '#3178c6', icon: 'code' },
  { id: 'cpp', name: 'C++', color: '#659ad2', icon: 'settings' },
  { id: 'html', name: 'HTML/CSS', color: '#e34f26', icon: 'html' }
];

const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  'python': `# SkillSwap Python Session\n\ndef main():\n    print("Hello, Peer!")\n\nif __name__ == "__main__":\n    main()`,
  'javascript': `// SkillSwap JS Session\n\nconst greet = () => {\n  console.log("Collaborative coding is fun!");\n};\n\ngreet();`,
  'typescript': `interface User {\n  id: string;\n  skill: string;\n}\n\nconst user: User = {\n  id: "123",\n  skill: "Expert"\n};`,
  'cpp': `#include <iostream>\n\nint main() {\n    std::cout << "Learning together!" << std::endl;\n    return 0;\n}`,
  'html': `<!-- SkillSwap Sandbox -->\n<div class="container">\n  <h1>Peer Learning</h1>\n  <p>Start trading skills today.</p>\n</div>\n\n<style>\n  .container { color: #0d33f2; }\n</style>`
};

const highlightCode = (code: string, language: string) => {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const patterns: Record<string, { regex: RegExp; class: string }[]> = {
    common: [
      { regex: /(".*?"|'.*?'|`.*?`)/g, class: 'text-[#ce9178]' },
      { regex: /\b(\d+)\b/g, class: 'text-[#b5cea8]' },
    ],
    javascript: [
      { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, class: 'text-[#6a9955] italic' },
      { regex: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|this|await|async|type|interface|enum)\b/g, class: 'text-[#569cd6]' },
      { regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g, class: 'text-[#dcdcaa]' },
      { regex: /\b(console|window|document|process|Object|Array|String|Number|Boolean)\b/g, class: 'text-[#4ec9b0]' },
    ],
    python: [
      { regex: /(#.*$)/gm, class: 'text-[#6a9955] italic' },
      { regex: /\b(def|return|if|elif|else|for|while|import|from|class|as|with|try|except|finally|pass|in|is|not|and|or|lambda|None|True|False)\b/g, class: 'text-[#569cd6]' },
      { regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g, class: 'text-[#dcdcaa]' },
      { regex: /\b(print|len|range|enumerate|zip|dict|list|set|str|int|float|open)\b/g, class: 'text-[#4ec9b0]' },
    ]
  };

  const langPatterns = patterns[language] || patterns.javascript;
  const allPatterns = [...langPatterns, ...patterns.common];
  allPatterns.forEach(p => {
    html = html.replace(p.regex, (match) => `<span class="${p.class}">${match}</span>`);
  });
  return html;
};

type SessionMode = 'code' | 'draw';
type SidebarTab = 'chat' | 'files';
type DrawingTool = 'pencil' | 'text' | 'rect' | 'circle' | 'eraser';

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
  const [partnerMediaStatus, setPartnerMediaStatus] = useState({ isMuted: false, isVideoOff: false });
  
  const [isUploading, setIsUploading] = useState(false);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [drawColor, setDrawColor] = useState('#0d33f2');
  const [activeTextInput, setActiveTextInput] = useState<{ x: number, y: number, id: string } | null>(null);
  const [currentTextValue, setCurrentTextValue] = useState('');

  const isInteractingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const startPosRef = useRef<Point>({ x: 0, y: 0 });

  const videoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  
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

  const syncScroll = () => {
    if (editorRef.current && preRef.current) {
      preRef.current.scrollTop = editorRef.current.scrollTop;
      preRef.current.scrollLeft = editorRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Failed to get media", err);
        setErrorNotification("Camera/Mic access denied.");
      }
    };
    startMedia();
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      const videoTracks = streamRef.current.getVideoTracks();
      audioTracks.forEach(track => { track.enabled = !isMuted; });
      videoTracks.forEach(track => { track.enabled = !isVideoOff; });
      channelRef.current?.send({ type: 'broadcast', event: 'media-update', payload: { isMuted, isVideoOff } });
    }
  }, [isMuted, isVideoOff]);

  useEffect(() => {
    if (!matchId || !currentUserId) return;
    const channel = supabase.channel(`session:${matchId}`, { config: { broadcast: { self: false } } });
    channel
      .on('broadcast', { event: 'code-update' }, (payload) => {
        setCode(payload.payload.code);
        if (payload.payload.lang) setSelectedLang(payload.payload.lang);
      })
      .on('broadcast', { event: 'chat-message' }, (payload) => {
        setChatMessages(prev => [...prev, payload.payload]);
      })
      .on('broadcast', { event: 'element-added' }, (payload) => setElements(prev => [...prev, payload.payload.element]))
      .on('broadcast', { event: 'clear-canvas' }, () => setElements([]))
      .on('broadcast', { event: 'file-shared' }, (payload) => setSharedFiles(prev => [payload.payload.file, ...prev]))
      .on('broadcast', { event: 'media-update' }, (payload) => setPartnerMediaStatus(payload.payload));

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channelRef.current = channel;
        channel.send({ type: 'broadcast', event: 'media-update', payload: { isMuted, isVideoOff } });
      }
    });
    return () => { supabase.removeChannel(channel); };
  }, [matchId, currentUserId]);

  const sendMessage = useCallback(() => {
    if (!messageInput.trim() || !channelRef.current || !currentUserId) return;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      name: 'Me',
      text: messageInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages(prev => [...prev, newMessage]);
    channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: { ...newMessage, sender: 'partner' }
    });
    setMessageInput('');
  }, [messageInput, currentUserId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId || !matchId) return;
    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `shared/${matchId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const sharedFile: SharedFile = {
        id: Math.random().toString(),
        name: file.name,
        url: publicUrl,
        size: file.size,
        uploader_name: 'Me',
        created_at: new Date().toISOString()
      };
      setSharedFiles(prev => [sharedFile, ...prev]);
      channelRef.current?.send({ type: 'broadcast', event: 'file-shared', payload: { file: sharedFile } });
      setErrorNotification("File shared successfully!");
    } catch (err: any) {
      setErrorNotification("Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        stream.getTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
        };
      } catch (err) {
        setErrorNotification("Screen share failed.");
      }
    }
  };

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    elements.forEach(el => {
      ctx.save();
      ctx.translate(el.translateX, el.translateY);
      ctx.rotate(el.rotation);
      ctx.scale(el.scale, el.scale);
      ctx.strokeStyle = el.type === 'eraser' ? '#ffffff' : el.color;
      ctx.lineWidth = el.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'stroke' || el.type === 'eraser') {
        if (el.points) {
          ctx.beginPath();
          el.points.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
          ctx.stroke();
        }
      } else if (el.type === 'rect') {
        ctx.strokeRect(el.bbox.minX, el.bbox.minY, el.bbox.maxX - el.bbox.minX, el.bbox.maxY - el.bbox.minY);
      } else if (el.type === 'circle') {
        const rx = (el.bbox.maxX - el.bbox.minX) / 2;
        const ry = (el.bbox.maxY - el.bbox.minY) / 2;
        const cx = el.bbox.minX + rx;
        const cy = el.bbox.minY + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (el.type === 'text' && el.text) {
        ctx.fillStyle = el.color; ctx.font = `${el.fontSize || 24}px ${el.fontFamily || SANS_FONT}`; ctx.textBaseline = 'top';
        ctx.fillText(el.text, el.bbox.minX, el.bbox.minY);
      }
      ctx.restore();
    });
  }, [elements]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    startPosRef.current = { x, y };
    if (drawingTool === 'pencil' || drawingTool === 'eraser') {
      isInteractingRef.current = true;
      currentStrokeRef.current = [{ x, y }];
    } else if (drawingTool === 'rect' || drawingTool === 'circle') {
      isInteractingRef.current = true;
    } else if (drawingTool === 'text') {
      setActiveTextInput({ x, y, id: Math.random().toString() });
      setCurrentTextValue('');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isInteractingRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (drawingTool === 'pencil' || drawingTool === 'eraser') {
      currentStrokeRef.current.push({ x, y });
      ctx.strokeStyle = drawingTool === 'eraser' ? '#ffffff' : drawColor;
      ctx.lineWidth = drawingTool === 'eraser' ? 20 : 3;
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
      const cx = startPosRef.current.x + rx;
      const cy = startPosRef.current.y + ry;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isInteractingRef.current) return;
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
        width: drawingTool === 'eraser' ? 20 : 3,
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
    const { x, y } = activeTextInput;
    const newEl: CanvasElement = {
      id: activeTextInput.id,
      type: 'text',
      text: currentTextValue,
      color: drawColor,
      fontSize: 24,
      fontFamily: SANS_FONT,
      translateX: 0, translateY: 0, rotation: 0, scale: 1,
      bbox: { minX: x, minY: y, maxX: x + 100, maxY: y + 30 },
      width: 0
    };
    setElements(prev => [...prev, newEl]);
    channelRef.current?.send({ type: 'broadcast', event: 'element-added', payload: { element: newEl } });
    setActiveTextInput(null);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#1e1e1e] overflow-hidden font-display relative">
      {errorNotification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4">
          <div className="bg-primary text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 backdrop-blur-md">
            <span className="material-symbols-outlined">info</span>
            <span className="text-sm font-bold uppercase">{errorNotification}</span>
            <button onClick={() => setErrorNotification(null)}><span className="material-symbols-outlined !text-sm">close</span></button>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between border-b border-[#333] px-6 py-3 bg-[#1e1e1e] z-50">
        <div className="flex items-center gap-6">
          <div className="size-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path></svg>
          </div>
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
            <button onClick={() => setMode('code')} className={`px-8 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'code' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>IDE Mode</button>
            <button onClick={() => setMode('draw')} className={`px-8 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'draw' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}>Whiteboard</button>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Syncing</span>
           </div>
           <button onClick={onEnd} className="bg-red-600/10 text-red-500 border border-red-500/20 text-[10px] font-black h-10 px-8 rounded-xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-[0.2em]">End Session</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col bg-[#1e1e1e] relative">
          <div className="flex-1 relative flex flex-col">
            {mode === 'code' ? (
              <div className="flex-1 flex flex-col relative overflow-hidden">
                <div className="h-12 flex items-center justify-between px-6 bg-[#252526] border-b border-[#333]">
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined !text-lg text-slate-500">terminal</span>
                        <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="bg-transparent text-slate-300 text-[11px] font-bold border-none outline-none cursor-pointer">
                           {LANGUAGES.map(lang => <option key={lang.id} value={lang.id} className="bg-[#252526]">{lang.name}</option>)}
                        </select>
                      </div>
                   </div>
                </div>
                <div className="flex-1 relative bg-[#1e1e1e] overflow-hidden">
                   <pre ref={preRef} className="absolute inset-0 p-6 m-0 pointer-events-none whitespace-pre-wrap break-words font-mono text-[14px] leading-6 overflow-hidden" dangerouslySetInnerHTML={{ __html: highlightCode(code, selectedLang) + '\n' }} />
                   <textarea ref={editorRef} spellCheck={false} value={code} onScroll={syncScroll} onChange={(e) => { setCode(e.target.value); channelRef.current?.send({ type: 'broadcast', event: 'code-update', payload: { code: e.target.value, lang: selectedLang } }); }} className="absolute inset-0 p-6 bg-transparent text-transparent caret-white font-mono text-[14px] leading-6 resize-none outline-none overflow-auto whitespace-pre-wrap break-words border-none" />
                </div>
              </div>
            ) : (
              <div className="flex-1 relative bg-white overflow-hidden">
                <canvas ref={canvasRef} width={2000} height={2000} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} className="w-full h-full cursor-crosshair" />
                {activeTextInput && (
                  <textarea ref={textInputRef} autoFocus value={currentTextValue} onChange={(e) => setCurrentTextValue(e.target.value)} onBlur={finalizeText} className="absolute bg-transparent border border-primary outline-none p-1 text-2xl" style={{ left: activeTextInput.x, top: activeTextInput.y, fontFamily: SANS_FONT, color: drawColor }} />
                )}
                <div className="absolute top-8 left-8 flex flex-col gap-3 bg-[#1a1d2d]/90 backdrop-blur-2xl p-4 rounded-2xl border border-white/10 shadow-2xl z-40">
                   {['pencil', 'eraser', 'text', 'rect', 'circle'].map(tool => (
                     <button key={tool} onClick={() => setDrawingTool(tool as DrawingTool)} className={`size-10 flex items-center justify-center rounded-lg transition-all ${drawingTool === tool ? 'bg-primary text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                       <span className="material-symbols-outlined !text-xl">{tool === 'pencil' ? 'edit' : tool === 'eraser' ? 'ink_eraser' : tool === 'text' ? 'title' : tool === 'rect' ? 'rectangle' : 'circle'}</span>
                     </button>
                   ))}
                   <div className="h-px w-full bg-white/10"></div>
                   <button onClick={() => { setElements([]); channelRef.current?.send({ type: 'broadcast', event: 'clear-canvas' }); }} className="size-10 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"><span className="material-symbols-outlined">delete</span></button>
                </div>
              </div>
            )}

            <div className="absolute bottom-6 right-6 flex flex-col gap-4 z-40">
               <div className="w-56 aspect-video bg-black rounded-2xl border-2 border-primary/40 overflow-hidden relative shadow-2xl">
                  {partnerMediaStatus.isVideoOff ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900"><span className="material-symbols-outlined text-slate-600">person_off</span></div>
                  ) : (
                    <video ref={partnerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-widest">{partner?.name || 'Partner'}</div>
                  {partnerMediaStatus.isMuted && <div className="absolute top-2 right-2 bg-red-600 size-5 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-white !text-xs">mic_off</span></div>}
               </div>
               <div className="w-48 aspect-video bg-black rounded-2xl border-2 border-white/10 overflow-hidden relative shadow-2xl">
                  {isVideoOff ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900"><span className="material-symbols-outlined text-slate-600 text-sm">visibility_off</span></div>
                  ) : (
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-widest">Me</div>
               </div>
            </div>

            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#252526] border border-[#333] p-3 rounded-2xl shadow-2xl z-40">
               <button onClick={() => setIsMuted(!isMuted)} className={`size-12 rounded-xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span></button>
               <button onClick={() => setIsVideoOff(!isVideoOff)} className={`size-12 rounded-xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined">{isVideoOff ? 'videocam_off' : 'videocam'}</span></button>
               <button onClick={toggleScreenShare} className={`px-6 h-12 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${isScreenSharing ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}><span className="material-symbols-outlined text-lg">screen_share</span> {isScreenSharing ? 'Sharing' : 'Screen'}</button>
            </div>
          </div>
        </div>

        <aside className="w-80 h-full border-l border-[#333] flex flex-col bg-[#252526]">
          <div className="flex border-b border-[#333]">
             <button onClick={() => setSidebarTab('chat')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'chat' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-white'}`}>Chat</button>
             <button onClick={() => setSidebarTab('files')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'files' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-white'}`}>Files</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
             {sidebarTab === 'chat' ? chatMessages.map((msg, i) => (
               <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-1`}>
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[9px] font-black uppercase text-slate-600">{msg.name}</span>
                    <span className="text-[8px] font-medium text-slate-700">{msg.timestamp}</span>
                  </div>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'}`}>
                    {msg.text}
                  </div>
               </div>
             )) : (
               <div className="space-y-4">
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-[#333] rounded-2xl text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-white transition-all">
                    {isUploading ? 'Uploading...' : 'Upload Expert File'}
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  {sharedFiles.map(file => (
                    <div key={file.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3 group">
                       <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">description</span>
                       <div className="flex-1 min-w-0">
                         <div className="font-bold text-white text-[11px] truncate uppercase">{file.name}</div>
                         <div className="text-[9px] font-black text-slate-600 uppercase">{(file.size / 1024).toFixed(1)} KB</div>
                       </div>
                       <a href={file.url} download className="text-slate-500 hover:text-primary transition-colors"><span className="material-symbols-outlined !text-lg">download</span></a>
                    </div>
                  ))}
               </div>
             )}
          </div>
          {sidebarTab === 'chat' && (
            <div className="p-4 border-t border-[#333]">
               <div className="flex gap-2">
                 <input value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type message..." className="flex-1 bg-black/20 border border-[#333] rounded-xl px-4 py-2.5 text-sm text-white focus:border-primary outline-none transition-all" />
                 <button onClick={sendMessage} className="size-10 bg-primary text-white rounded-xl flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"><span className="material-symbols-outlined !text-lg">send</span></button>
               </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default LiveSession;
