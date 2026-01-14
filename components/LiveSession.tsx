
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

// Syntax Highlighting Engine
const highlightCode = (code: string, language: string) => {
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const patterns: Record<string, { regex: RegExp; class: string }[]> = {
    common: [
      { regex: /(".*?"|'.*?'|`.*?`)/g, class: 'text-[#ce9178]' }, // Strings
      { regex: /\b(\d+)\b/g, class: 'text-[#b5cea8]' }, // Numbers
    ],
    javascript: [
      { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, class: 'text-[#6a9955] italic' }, // Comments
      { regex: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|this|await|async|type|interface|enum)\b/g, class: 'text-[#569cd6]' }, // Keywords
      { regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g, class: 'text-[#dcdcaa]' }, // Functions
      { regex: /\b(console|window|document|process|Object|Array|String|Number|Boolean)\b/g, class: 'text-[#4ec9b0]' }, // Built-ins
    ],
    python: [
      { regex: /(#.*$)/gm, class: 'text-[#6a9955] italic' }, // Comments
      { regex: /\b(def|return|if|elif|else|for|while|import|from|class|as|with|try|except|finally|pass|in|is|not|and|or|lambda|None|True|False)\b/g, class: 'text-[#569cd6]' }, // Keywords
      { regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g, class: 'text-[#dcdcaa]' }, // Functions
      { regex: /\b(print|len|range|enumerate|zip|dict|list|set|str|int|float|open)\b/g, class: 'text-[#4ec9b0]' }, // Built-ins
    ],
    cpp: [
      { regex: /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, class: 'text-[#6a9955] italic' }, // Comments
      { regex: /\b(int|double|float|char|void|if|else|for|while|return|class|public|private|protected|template|typename|using|namespace|include|define)\b/g, class: 'text-[#569cd6]' }, // Keywords
      { regex: /\b([a-zA-Z_]\w*)(?=\s*\()/g, class: 'text-[#dcdcaa]' }, // Functions
      { regex: /#\w+/g, class: 'text-[#c586c0]' }, // Preprocessor
    ],
    html: [
      { regex: /(&lt;!--[\s\S]*?--&gt;)/g, class: 'text-[#6a9955] italic' }, // Comments
      { regex: /(&lt;\/?[a-z1-6]+)/gi, class: 'text-[#569cd6]' }, // Tags
      { regex: /([a-z-]+)(?==)/gi, class: 'text-[#9cdcfe]' }, // Attributes
      { regex: /&gt;/g, class: 'text-[#569cd6]' }, // Closers
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
  const [partnerMediaStatus, setPartnerMediaStatus] = useState({ isMuted: false, isVideoOff: false });
  
  const [isUploading, setIsUploading] = useState(false);
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawColor, setDrawColor] = useState('#0d33f2');
  const [lineWidth, setLineWidth] = useState(3);
  const [selectedFontSize, setSelectedFontSize] = useState(48);
  const [selectedFontFamily, setSelectedFontFamily] = useState(SANS_FONT);
  
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

  // Initialize camera and microphone
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

  // Sync mute/video status with peer
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
      streamRef.current.getVideoTracks().forEach(track => { track.enabled = !isVideoOff; });
      channelRef.current?.send({ type: 'broadcast', event: 'media-update', payload: { isMuted, isVideoOff } });
    }
  }, [isMuted, isVideoOff]);

  // Handle peer communication via Supabase Realtime
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
      .on('broadcast', { event: 'element-transformed' }, (payload) => {
        setElements(prev => prev.map(s => s.id === payload.payload.id ? { ...s, ...payload.payload.transforms } : s));
      })
      .on('broadcast', { event: 'element-deleted' }, (payload) => {
        setElements(prev => prev.filter(s => s.id !== payload.payload.id));
        if (selectedId === payload.payload.id) setSelectedId(null);
      })
      .on('broadcast', { event: 'clear-canvas' }, () => { setElements([]); setSelectedId(null); })
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

  // Handle chat message submission
  const sendMessage = useCallback(() => {
    if (!messageInput.trim() || !channelRef.current || !currentUserId) return;

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      name: 'Me',
      text: messageInput.trim(),
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatMessages(prev => [...prev, newMessage]);
    channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: { ...newMessage, sender: 'partner' }
    });
    setMessageInput('');
  }, [messageInput, currentUserId]);

  // Handle file sharing
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId || !matchId) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${matchId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const sharedFile: SharedFile = {
        id: Math.random().toString(),
        name: file.name,
        url: publicUrl,
        size: file.size,
        uploader_name: 'Me',
        created_at: new Date().toISOString()
      };

      setSharedFiles(prev => [sharedFile, ...prev]);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'file-shared',
        payload: { file: sharedFile }
      });
      setErrorNotification("File shared successfully!");
    } catch (err: any) {
      console.error("Upload error:", err);
      setErrorNotification("Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle screen sharing toggle
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
        console.error("Screen share error:", err);
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
      const centerX = (el.bbox.minX + el.bbox.maxX) / 2;
      const centerY = (el.bbox.minY + el.bbox.maxY) / 2;
      ctx.translate(el.translateX + centerX, el.translateY + centerY);
      ctx.rotate(el.rotation);
      ctx.scale(el.scale, el.scale);
      ctx.translate(-centerX, -centerY);
      if (el.type === 'stroke' && el.points) {
        ctx.strokeStyle = el.color; ctx.lineWidth = el.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); el.points.forEach((pt, i) => { if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
        ctx.stroke();
      } else if (el.type === 'text' && el.text) {
        ctx.fillStyle = el.color; ctx.font = `${el.fontSize || 24}px ${el.fontFamily || SANS_FONT}`; ctx.textBaseline = 'top';
        ctx.fillText(el.text, el.bbox.minX, el.bbox.minY);
      }
      if (selectedId === el.id) {
        ctx.strokeStyle = '#0d33f2'; ctx.lineWidth = 2; ctx.setLineDash([8, 4]);
        ctx.strokeRect(el.bbox.minX - 10, el.bbox.minY - 10, (el.bbox.maxX - el.bbox.minX) + 20, (el.bbox.maxY - el.bbox.minY) + 20);
        ctx.setLineDash([]); ctx.fillStyle = '#0d33f2'; ctx.beginPath(); ctx.arc(centerX, el.bbox.minY - 30, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(el.bbox.maxX + 10, el.bbox.maxY + 10, 15, 15);
      }
      ctx.restore();
    });
  }, [elements, selectedId]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editorRef.current?.selectionStart || 0;
      const end = editorRef.current?.selectionEnd || 0;
      const val = code;
      const newVal = val.substring(0, start) + "  " + val.substring(end);
      setCode(newVal);
      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = editorRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const activeLang = LANGUAGES.find(l => l.id === selectedLang) || LANGUAGES[0];

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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Connected</span>
           </div>
           <button onClick={onEnd} className="bg-red-600/10 text-red-500 border border-red-500/20 text-[10px] font-black h-10 px-8 rounded-xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-[0.2em]">Leave Session</button>
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
                        <span className="material-symbols-outlined !text-lg text-slate-500">{activeLang.icon}</span>
                        <select 
                          value={selectedLang} 
                          onChange={(e) => {
                            const newLang = e.target.value;
                            setSelectedLang(newLang);
                            channelRef.current?.send({ type: 'broadcast', event: 'code-update', payload: { code, lang: newLang } });
                          }}
                          className="bg-transparent text-slate-300 text-[11px] font-bold border-none p-0 outline-none cursor-pointer hover:text-white transition-colors appearance-none"
                        >
                           {LANGUAGES.map(lang => <option key={lang.id} value={lang.id} className="bg-[#252526]">{lang.name}</option>)}
                        </select>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <button onClick={() => { navigator.clipboard.writeText(code); setErrorNotification("Copied to clipboard!"); }} className="text-slate-400 hover:text-white transition-all">
                        <span className="material-symbols-outlined !text-lg">content_copy</span>
                      </button>
                      <div className="h-4 w-px bg-[#333]"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">UTF-8</span>
                   </div>
                </div>

                <div className="flex-1 relative flex overflow-hidden">
                   {/* Line numbers gutter */}
                   <div className="w-12 bg-[#1e1e1e] flex flex-col items-end pr-3 pt-6 text-[12px] font-mono text-[#858585] select-none border-r border-[#333]">
                      {code.split('\n').map((_, i) => (
                        <div key={i} className="h-6 leading-6 transition-colors hover:text-white">{i + 1}</div>
                      ))}
                   </div>

                   <div className="flex-1 relative bg-[#1e1e1e] overflow-hidden">
                      <pre 
                        ref={preRef}
                        aria-hidden="true"
                        className="absolute inset-0 p-6 m-0 pointer-events-none whitespace-pre-wrap break-words font-mono text-[14px] leading-6 overflow-hidden"
                        style={{ fontFamily: MONO_FONT }}
                        dangerouslySetInnerHTML={{ __html: highlightCode(code, selectedLang) + '\n' }}
                      />
                      <textarea
                        ref={editorRef}
                        spellCheck={false}
                        value={code}
                        onScroll={syncScroll}
                        onKeyDown={handleKeyDown}
                        onChange={(e) => {
                          const newCode = e.target.value;
                          setCode(newCode);
                          channelRef.current?.send({ type: 'broadcast', event: 'code-update', payload: { code: newCode, lang: selectedLang } });
                        }}
                        className="absolute inset-0 p-6 bg-transparent text-transparent caret-white font-mono text-[14px] leading-6 resize-none outline-none overflow-auto custom-scrollbar whitespace-pre-wrap break-words border-none focus:ring-0"
                        style={{ fontFamily: MONO_FONT }}
                      />
                   </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 relative bg-white overflow-hidden">
                <canvas ref={canvasRef} width={1600} height={1200} className="w-full h-full cursor-crosshair" />
                <div className="absolute top-8 left-8 flex flex-col gap-3 bg-[#1a1d2d]/90 backdrop-blur-2xl p-4 rounded-2xl border border-white/10 shadow-2xl z-40">
                   <button onClick={() => setDrawingTool('pencil')} className={`size-10 flex items-center justify-center rounded-lg transition-all ${drawingTool === 'pencil' ? 'bg-primary text-white' : 'text-slate-400'}`}><span className="material-symbols-outlined !text-xl">edit</span></button>
                   <button onClick={() => setDrawingTool('text')} className={`size-10 flex items-center justify-center rounded-lg transition-all ${drawingTool === 'text' ? 'bg-primary text-white' : 'text-slate-400'}`}><span className="material-symbols-outlined !text-xl">title</span></button>
                   <div className="h-px w-full bg-white/10"></div>
                   <button onClick={() => setDrawColor('#0d33f2')} className="size-6 rounded-full bg-primary border-2 border-white"></button>
                   <button onClick={() => setDrawColor('#ef4444')} className="size-6 rounded-full bg-red-500 border-2 border-transparent"></button>
                </div>
              </div>
            )}

            {/* Floating Media Overlay */}
            <div className="absolute bottom-6 right-6 flex flex-col gap-4 z-40">
               <div className="w-48 aspect-video bg-black rounded-2xl border border-primary overflow-hidden relative shadow-2xl group">
                  {partnerMediaStatus.isVideoOff ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900"><span className="material-symbols-outlined text-slate-600">person_off</span></div>
                  ) : (
                    <video ref={partnerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-widest">{partner?.name || 'Partner'}</div>
               </div>
               <div className="w-40 aspect-video bg-black rounded-2xl border border-emerald-500 overflow-hidden relative shadow-2xl">
                  {isVideoOff ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900"><span className="material-symbols-outlined text-slate-600 text-sm">visibility_off</span></div>
                  ) : (
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                  )}
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[8px] font-bold text-white uppercase tracking-widest">Me</div>
               </div>
            </div>

            {/* Media Controls HUD */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-[#252526] border border-[#333] p-3 rounded-2xl shadow-2xl z-40">
               <button onClick={() => setIsMuted(!isMuted)} className={`size-12 rounded-xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-400'}`}><span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span></button>
               <button onClick={() => setIsVideoOff(!isVideoOff)} className={`size-12 rounded-xl flex items-center justify-center transition-all ${isVideoOff ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-400'}`}><span className="material-symbols-outlined">{isVideoOff ? 'videocam_off' : 'videocam'}</span></button>
               <button onClick={toggleScreenShare} className={`px-6 h-12 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${isScreenSharing ? 'bg-primary text-white' : 'bg-white/5 text-slate-400'}`}><span className="material-symbols-outlined text-lg">screen_share</span> {isScreenSharing ? 'Stop' : 'Share'}</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 h-full border-l border-[#333] flex flex-col bg-[#252526]">
          <div className="flex border-b border-[#333]">
             <button onClick={() => setSidebarTab('chat')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'chat' ? 'text-primary' : 'text-slate-500'}`}>Chat</button>
             <button onClick={() => setSidebarTab('files')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${sidebarTab === 'files' ? 'text-primary' : 'text-slate-500'}`}>Files</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
             {sidebarTab === 'chat' ? (
               <div className="space-y-4">
                 {chatMessages.map((msg, i) => (
                   <div key={i} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="text-[9px] font-bold text-slate-500 mb-1">{msg.name}</span>
                      <div className={`px-4 py-2 rounded-xl text-sm ${msg.sender === 'user' ? 'bg-primary text-white' : 'bg-white/5 text-slate-300'}`}>{msg.text}</div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="space-y-4">
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-[#333] rounded-2xl text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-primary transition-all">Upload File</button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  {sharedFiles.map(file => (
                    <div key={file.id} className="p-3 bg-white/5 rounded-xl border border-[#333] flex items-center gap-3">
                       <span className="material-symbols-outlined text-slate-500">description</span>
                       <div className="flex-1 min-w-0"><p className="text-white text-xs font-bold truncate">{file.name}</p></div>
                       <a href={file.url} download className="text-primary hover:text-white"><span className="material-symbols-outlined !text-lg">download</span></a>
                    </div>
                  ))}
               </div>
             )}
          </div>
          {sidebarTab === 'chat' && (
            <div className="p-6 border-t border-[#333]">
               <div className="flex gap-2">
                 <input value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Send message..." className="flex-1 bg-white/5 border border-[#333] rounded-xl px-4 py-2 text-sm text-white focus:border-primary outline-none" />
                 <button onClick={sendMessage} className="size-10 bg-primary text-white rounded-xl flex items-center justify-center"><span className="material-symbols-outlined !text-lg">send</span></button>
               </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default LiveSession;
