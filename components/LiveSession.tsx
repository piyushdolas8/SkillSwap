
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { ChatMessage } from '../types';

interface Props {
  skill?: string;
  onEnd: () => void;
}

interface SharedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  sender: 'user' | 'partner';
  timestamp: string;
}

interface CursorPos {
  line: number;
  col: number;
}

type WhiteboardTool = 'brush' | 'rectangle' | 'circle' | 'text' | 'eraser';

const FRAME_RATE = 1; 
const JPEG_QUALITY = 0.5;

// Font Metrics - These must match the CSS font-family for precision alignment
const MONO_FONT = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace';
const CHAR_WIDTH = 9.6; // Calculated width for standard 16px monospace
const LINE_HEIGHT = 24; 

const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  'python': `# Lesson 1: Data Structures\n\ndef main():\n    items = ["Apple", "Banana", "Cherry"]\n    for item in items:\n        print(f"I like {item}")\n\nif __name__ == "__main__":\n    main()`,
  'javascript': `// Lesson 1: Modern JS Fundamentals\n\nconst greet = (name) => {\n  console.log(\`Hello, \${name}!\`);\n};\n\ngreet('Developer');`,
  'typescript': `// Lesson 1: Type Safety\n\ninterface User {\n  id: number;\n  name: string;\n}\n\nconst user: User = { id: 1, name: 'SkillSwapper' };\nconsole.log(user.name);`,
  'cpp': `// Lesson 1: Systems Basics\n#include <iostream>\n\nint main() {\n    std::cout << "Hello World" << std::endl;\n    return 0;\n}`,
  'java': `// Lesson 1: OOP Principles\npublic class Lesson {\n    public static void main(String[] args) {\n        System.out.println("Ready to swap skills!");\n    }\n}`,
  'sql': `-- Lesson 1: Querying Data\nSELECT name, rating \nFROM experts \nWHERE tokens > 10 \nORDER BY rating DESC;`,
  'ruby': `# Lesson 1: Ruby Elegance\ndef hello(name)\n  puts "Hi, #{name}!"\nend\n\nhello("SkillSwap")`,
};

const LiveSession: React.FC<Props> = ({ skill = 'Python', onEnd }) => {
  // Detect language from skill string
  const detectedLang = useMemo(() => {
    const s = skill.toLowerCase();
    if (s.includes('python')) return 'python';
    if (s.includes('javascript') || s.includes('react') || s.includes('js')) return 'javascript';
    if (s.includes('typescript') || s.includes('ts')) return 'typescript';
    if (s.includes('c++') || s.includes('cpp')) return 'cpp';
    if (s.includes('java')) return 'java';
    if (s.includes('sql') || s.includes('database')) return 'sql';
    if (s.includes('ruby')) return 'ruby';
    return 'javascript'; // Default to JS if unknown
  }, [skill]);

  const [code, setCode] = useState<string>(DEFAULT_CODE_TEMPLATES[detectedLang] || DEFAULT_CODE_TEMPLATES['python']);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([
    { id: '1', name: `${detectedLang}_Cheat_Sheet.pdf`, size: '1.2 MB', type: 'pdf', sender: 'partner', timestamp: '10:05 AM' }
  ]);
  const [activeTab, setActiveTab] = useState<'transcript' | 'files' | 'agenda'>('transcript');
  const [mainView, setMainView] = useState<'code' | 'whiteboard'>('code');
  const [showSidebar, setShowSidebar] = useState(false); 
  const [timer, setTimer] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  
  const [remoteCursor, setRemoteCursor] = useState<CursorPos>({ line: 2, col: 4 });
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);
  const [agendaItems, setAgendaItems] = useState([
    { id: 1, text: 'Reciprocal introductions', completed: true },
    { id: 2, text: `Review: ${skill} Fundamentals`, completed: false },
    { id: 3, text: 'Hands-on coding exercise', completed: false },
    { id: 4, text: 'Peer feedback & verification', completed: false }
  ]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const whiteboardRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const initializationStartedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const [textInputPos, setTextInputPos] = useState<{ x: number, y: number, canvasX: number, canvasY: number } | null>(null);
  const [activeText, setActiveText] = useState('');
  const textOverlayRef = useRef<HTMLInputElement>(null);

  const [wbTool, setWbTool] = useState<WhiteboardTool>('brush');
  const [wbColor, setWbColor] = useState('#0d33f2');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [canvasSnapshot, setCanvasSnapshot] = useState<ImageData | null>(null);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => { track.enabled = !isMuted; });
    }
  }, [isMuted]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => { track.enabled = !isVideoOff; });
    }
  }, [isVideoOff]);

  useEffect(() => {
    if (mainView === 'whiteboard' && whiteboardRef.current) {
      const canvas = whiteboardRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const pixel = ctx.getImageData(0, 0, 1, 1).data;
        if (pixel[3] === 0) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [mainView]);

  const startDrawing = (e: React.MouseEvent) => {
    const canvas = whiteboardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (wbTool === 'text') {
      setTextInputPos({ x: e.clientX, y: e.clientY, canvasX: x, canvasY: y });
      setIsDrawing(false);
      return;
    }
    setStartPos({ x, y });
    setIsDrawing(true);
    setCanvasSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (wbTool === 'brush' || wbTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const canvas = whiteboardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (wbTool === 'brush' || wbTool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.strokeStyle = wbTool === 'eraser' ? '#ffffff' : wbColor;
      ctx.lineWidth = wbTool === 'eraser' ? 40 : 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if ((wbTool === 'rectangle' || wbTool === 'circle') && canvasSnapshot) {
      ctx.putImageData(canvasSnapshot, 0, 0);
      ctx.strokeStyle = wbColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      if (wbTool === 'rectangle') {
        ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
      } else {
        const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  const endDrawing = () => { setIsDrawing(false); setCanvasSnapshot(null); };

  const handleTextSubmit = (e: React.KeyboardEvent | React.FocusEvent) => {
    if ((e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') || !textInputPos || !activeText.trim()) {
      if (e.type === 'keydown' && (e as React.KeyboardEvent).key === 'Escape') { setTextInputPos(null); setActiveText(''); }
      return;
    }
    const canvas = whiteboardRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = 'bold 24px "Space Grotesk", sans-serif';
        ctx.fillStyle = wbColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeText, textInputPos.canvasX, textInputPos.canvasY);
      }
    }
    setTextInputPos(null);
    setActiveText('');
  };

  useEffect(() => { if (textInputPos && textOverlayRef.current) { textOverlayRef.current.focus(); } }, [textInputPos]);

  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
    return buffer;
  };

  const createAudioBlob = (data: Float32Array) => {
    const int16 = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
    return { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
  };

  const toggleScreenShare = useCallback(async () => {
    if (!isScreenSharing) {
      try {
        setShareError(null);
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = screenStream;
        setIsScreenSharing(true);
        screenStream.getTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
        };
      } catch (e: any) { 
        if (e.name === 'NotAllowedError') {
          setShareError("Permission denied: Screen share cancelled.");
          setTimeout(() => setShareError(null), 3000);
        } else {
          setShareError("An error occurred while trying to share your screen.");
          setTimeout(() => setShareError(null), 3000);
        }
      }
    } else {
      if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
      setIsScreenSharing(false);
    }
  }, [isScreenSharing]);

  const startSession = useCallback(async () => {
    if (initializationStartedRef.current) return;
    initializationStartedRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      const updateCodeDecl: FunctionDeclaration = {
        name: 'updateCode',
        parameters: {
          type: Type.OBJECT,
          properties: {
            newCode: { type: Type.STRING },
            line: { type: Type.NUMBER },
            col: { type: Type.NUMBER }
          },
          required: ['newCode', 'line', 'col']
        }
      };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            const source = audioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (!isMuted) {
                const pcmBlob = createAudioBlob(e.inputBuffer.getChannelData(0));
                sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
              }
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextRef.current!.destination);

            const interval = setInterval(() => {
              if (canvasRef.current && videoRef.current && !isVideoOff) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                  canvasRef.current.width = 640; canvasRef.current.height = 480;
                  ctx.drawImage(videoRef.current, 0, 0, 640, 480);
                  canvasRef.current.toBlob(blob => {
                    if (blob) {
                      blob.arrayBuffer().then(buf => {
                        const base64Data = encode(new Uint8Array(buf));
                        sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } }));
                      });
                    }
                  }, 'image/jpeg', JPEG_QUALITY);
                }
              }
            }, 1000 / FRAME_RATE);
            return () => clearInterval(interval);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.toolCall) {
              msg.toolCall.functionCalls.forEach(fc => {
                if (fc.name === 'updateCode') {
                  const { newCode, line, col } = fc.args as any;
                  setIsRemoteTyping(true); setCode(newCode); setRemoteCursor({ line, col });
                  setTimeout(() => setIsRemoteTyping(false), 800);
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { ok: true } } }));
                }
              });
            }
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setIsSpeaking(true);
              const ctx = outAudioContextRef.current!;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer; source.connect(ctx.destination);
              source.onended = () => {
                audioSourcesRef.current.delete(source);
                if (audioSourcesRef.current.size === 0) setIsSpeaking(false);
              };
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          tools: [{ functionDeclarations: [updateCodeDecl] }],
          systemInstruction: `You are Alex Rivera, an experienced mentor. Help Sarah learn ${skill} via the collaborative editor. Acting as a master of ${detectedLang}, use the updateCode tool to guide her step-by-step through core syntax and logical patterns.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (e) { console.error(e); }
  }, [isMuted, isVideoOff, skill, detectedLang]);

  useEffect(() => {
    startSession();
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => {
      clearInterval(interval);
      sessionRef.current?.close();
      audioContextRef.current?.close();
      outAudioContextRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const highlightedCode = useMemo(() => {
    let escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rules = [
      { regex: /(\/\/|#|--).*$/gm, class: 'text-slate-500 italic' },
      { regex: /(["'])(?:(?=(\\?))\2.)*?\1/g, class: 'text-[#f1fa8c]' },
      { regex: /\b(def|if|else|elif|return|import|from|as|class|while|for|in|print|const|let|var|function|async|await|interface|type|public|private|static|void|int|float|bool|string|include|using|namespace|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|ORDER|BY|DESC|ASC|puts|end|module|require)\b/g, class: 'text-[#ff79c6] font-bold' },
      { regex: /\b\d+\b/g, class: 'text-[#bd93f9]' },
      { regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/g, class: 'text-[#50fa7b]' }
    ];
    let highlighted = escaped;
    rules.forEach(rule => { highlighted = highlighted.replace(rule.regex, m => `<span class="${rule.class}">${m}</span>`); });
    return highlighted;
  }, [code]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newFile: SharedFile = {
        id: Date.now().toString(),
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB',
        type: file.name.split('.').pop() || 'file',
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setSharedFiles(prev => [newFile, ...prev]);
      e.target.value = '';
      setActiveTab('files');
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-background-dark overflow-hidden font-display relative">
      {shareError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] bg-red-600/90 backdrop-blur-md text-white px-6 py-2 rounded-full shadow-2xl animate-in fade-in slide-in-from-top duration-300 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">error</span>
          <span className="text-xs font-bold uppercase tracking-widest">{shareError}</span>
        </div>
      )}

      <header className="flex items-center justify-between border-b border-border-dark px-6 py-3 bg-background-dark/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="size-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
          </div>
          <div>
            <h2 className="text-white text-md font-bold leading-tight">SkillSwap Live</h2>
            <div className="flex items-center gap-2">
              <span className={`flex h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">Collaborating with Alex Rivera</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onEnd} className="bg-red-600/20 text-red-500 text-xs font-bold h-9 px-4 rounded-lg hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest">Complete Session</button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col p-4 gap-4 bg-background-dark relative">
          <div className="flex-1 relative rounded-xl overflow-hidden bg-[#0a0c16] border border-border-dark flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2 bg-[#1a1d2d] border-b border-border-dark">
              <div className="flex gap-4">
                <button 
                  onClick={() => setMainView('code')}
                  className={`flex items-center gap-2 border-b-2 pb-1 transition-all ${mainView === 'code' ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                >
                  <span className="material-symbols-outlined text-sm">code</span>
                  <span className="text-xs font-bold uppercase tracking-wide">Main.{detectedLang === 'cpp' ? 'cpp' : detectedLang === 'ruby' ? 'rb' : detectedLang === 'sql' ? 'sql' : detectedLang === 'python' ? 'py' : 'js'}</span>
                </button>
                <button 
                  onClick={() => setMainView('whiteboard')}
                  className={`flex items-center gap-2 border-b-2 pb-1 transition-all ${mainView === 'whiteboard' ? 'text-emerald-500 border-emerald-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                >
                  <span className="material-symbols-outlined text-sm">draw</span>
                  <span className="text-xs font-bold uppercase tracking-wide">Collaborative Whiteboard</span>
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex relative bg-[#0d0f1a] overflow-hidden">
              {mainView === 'code' ? (
                <>
                  <div className="w-12 h-full bg-[#161a2d]/30 border-r border-white/5 flex flex-col items-center py-4 text-slate-600 select-none font-mono text-xs" style={{ fontFamily: MONO_FONT }}>
                    {Array.from({ length: Math.max(code.split('\n').length, 25) }).map((_, i) => (
                      <span key={i} className="h-[24px] flex items-center">{i + 1}</span>
                    ))}
                  </div>
                  <div className="flex-1 relative font-mono text-base leading-[24px] overflow-hidden">
                    <pre 
                      ref={preRef} 
                      aria-hidden="true" 
                      className="absolute inset-0 p-4 m-0 pointer-events-none whitespace-pre overflow-hidden text-slate-300" 
                      style={{ fontFamily: MONO_FONT, padding: '16px' }}
                      dangerouslySetInnerHTML={{ __html: highlightedCode + '\n' }} 
                    />
                    
                    {/* Remote Cursor with calculated position */}
                    <div className="absolute pointer-events-none transition-all duration-300" style={{ left: `${16 + (remoteCursor.col * CHAR_WIDTH)}px`, top: `${16 + (remoteCursor.line * LINE_HEIGHT)}px`, zIndex: 20 }}>
                      <div className="w-0.5 h-6 bg-primary animate-pulse relative">
                        <div className="absolute top-[-20px] left-0 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-sm font-bold shadow-lg">Alex</div>
                      </div>
                    </div>

                    <textarea
                      ref={textareaRef} 
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onScroll={() => { if (textareaRef.current && preRef.current) { preRef.current.scrollTop = textareaRef.current.scrollTop; preRef.current.scrollLeft = textareaRef.current.scrollLeft; } }}
                      spellCheck={false}
                      style={{ fontFamily: MONO_FONT, padding: '16px', lineHeight: '24px' }}
                      className="absolute inset-0 w-full h-full p-4 m-0 bg-transparent border-none text-transparent caret-white focus:ring-0 resize-none whitespace-pre overflow-auto custom-scrollbar font-mono text-base"
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 relative bg-white">
                  <canvas ref={whiteboardRef} width={1600} height={1000} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseOut={endDrawing} className="w-full h-full cursor-crosshair" />
                </div>
              )}
            </div>

            <div className="absolute bottom-4 left-4 flex gap-4 pointer-events-none">
              <div className="w-32 sm:w-48 aspect-video bg-black rounded-xl border-2 border-primary overflow-hidden relative shadow-2xl">
                <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[8px] sm:text-[10px] font-bold text-white uppercase flex items-center gap-1 z-20">{isMuted && <span className="material-symbols-outlined !text-[10px] text-red-500">mic_off</span>}You</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center -mt-10 pb-4 relative z-20">
            <div className="flex items-center gap-2 sm:gap-3 bg-[#1a1d2d]/95 backdrop-blur-xl border border-[#3b3f54] p-2 sm:p-3 rounded-2xl shadow-2xl">
              <button onClick={() => setIsMuted(!isMuted)} className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-[#282b39] text-white hover:bg-red-500/20'}`}><span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span></button>
              <button onClick={() => setIsVideoOff(!isVideoOff)} className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl transition-all ${isVideoOff ? 'bg-red-500 text-white' : 'bg-[#282b39] text-white hover:bg-primary/20'}`}><span className="material-symbols-outlined">{isVideoOff ? 'videocam_off' : 'videocam'}</span></button>
              <button onClick={toggleScreenShare} className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl transition-all ${isScreenSharing ? 'bg-primary text-white' : 'bg-[#282b39] text-white hover:bg-primary/20'}`}><span className="material-symbols-outlined">screen_share</span></button>
              <button onClick={() => setShowSidebar(!showSidebar)} className={`lg:hidden flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl transition-all ${showSidebar ? 'bg-primary text-white' : 'bg-[#282b39] text-white hover:bg-primary/20'}`}>
                <span className="material-symbols-outlined">{showSidebar ? 'close' : 'side_navigation'}</span>
              </button>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <aside className={`fixed lg:static top-0 right-0 h-full w-[320px] sm:w-[400px] z-50 bg-[#0b0c14] border-l border-border-dark flex flex-col transition-transform duration-300 transform ${showSidebar ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
          <div className="flex items-center justify-around border-b border-border-dark bg-[#161a2d]/30">
            <button onClick={() => setActiveTab('transcript')} className={`flex-1 py-4 text-[10px] font-black tracking-widest uppercase transition-all ${activeTab === 'transcript' ? 'border-b-2 border-primary text-white' : 'text-slate-500'}`}>Transcript</button>
            <button onClick={() => setActiveTab('agenda')} className={`flex-1 py-4 text-[10px] font-black tracking-widest uppercase transition-all ${activeTab === 'agenda' ? 'border-b-2 border-emerald-500 text-white' : 'text-slate-500'}`}>Agenda</button>
            <button onClick={() => setActiveTab('files')} className={`flex-1 py-4 text-[10px] font-black tracking-widest uppercase transition-all ${activeTab === 'files' ? 'border-b-2 border-primary text-white' : 'text-slate-500'}`}>Files</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6 custom-scrollbar bg-mesh relative">
            {activeTab === 'agenda' ? (
              <div className="flex flex-col gap-4">
                {agendaItems.map(item => (
                  <button key={item.id} onClick={() => setAgendaItems(prev => prev.map(a => a.id === item.id ? {...a, completed: !a.completed} : a))} className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${item.completed ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                    <span className={`material-symbols-outlined text-lg ${item.completed ? 'text-emerald-500' : 'text-slate-600'}`}>{item.completed ? 'check_circle' : 'radio_button_unchecked'}</span>
                    <span className={`text-sm font-medium ${item.completed ? 'line-through text-slate-500' : 'text-white'}`}>{item.text}</span>
                  </button>
                ))}
              </div>
            ) : activeTab === 'transcript' ? (
              <div className="flex flex-col gap-4">
                 <div className="flex flex-col gap-2 self-start max-w-[95%]">
                    <span className="text-[10px] font-bold text-primary uppercase">Alex • 10:12 AM</span>
                    <div className="bg-[#1a1d2d] border border-white/5 p-4 rounded-2xl rounded-tl-none"><p className="text-sm leading-relaxed text-slate-200">Hi Sarah! Ready to dive into those ${skill} concepts? Let's start with the basics in the editor.</p></div>
                 </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 h-full">
                {sharedFiles.map(file => (
                  <div key={file.id} className="bg-[#1a1d2d] border border-border-dark p-4 rounded-xl flex items-center gap-4 group hover:border-primary/50 transition-all">
                    <div className="size-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined">{file.type === 'pdf' ? 'picture_as_pdf' : 'description'}</span>
                    </div>
                    <div className="flex-1 overflow-hidden text-xs">
                      <h4 className="font-bold text-white truncate">{file.name}</h4>
                      <p className="text-slate-500">{file.size} • {file.timestamp}</p>
                    </div>
                  </div>
                ))}
                <button onClick={() => fileInputRef.current?.click()} className="mt-auto w-full py-4 border-2 border-dashed border-border-dark rounded-xl text-slate-500 hover:border-primary hover:text-primary transition-all uppercase text-xs font-bold tracking-widest">Upload File</button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
};

export default LiveSession;
