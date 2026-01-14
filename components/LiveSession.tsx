import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { ChatMessage, UserProfile } from '../types';

interface Props {
  matchId: string | null;
  partner: UserProfile | null;
  skill?: string;
  onEnd: () => void;
}

const MONO_FONT = '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace';

const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  'python': `# Lesson: Interactive Python\n# Start typing to sync with your partner!\n\ndef solve_problem():\n    print("Hello SkillSwap!")\n\nsolve_problem()`,
  'javascript': `// Lesson: Interactive JS\nfunction helloWorld() {\n  console.log("Welcome to the session!");\n}\n\nhelloWorld();`
};

type SessionMode = 'code' | 'draw';

const LiveSession: React.FC<Props> = ({ matchId, partner, skill = 'Python', onEnd }) => {
  const [mode, setMode] = useState<SessionMode>('code');
  const [code, setCode] = useState<string>(DEFAULT_CODE_TEMPLATES[skill.toLowerCase()] || DEFAULT_CODE_TEMPLATES['python']);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [partnerMediaStatus, setPartnerMediaStatus] = useState({ isMuted: false, isVideoOff: false });
  const [errorNotification, setErrorNotification] = useState<string | null>(null);
  
  // Whiteboard state
  const [drawColor, setDrawColor] = useState('#0d33f2');
  const [lineWidth, setLineWidth] = useState(3);
  const isDrawingRef = useRef(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
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

  // Show error for 4 seconds
  useEffect(() => {
    if (errorNotification) {
      const timer = setTimeout(() => setErrorNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorNotification]);

  // Real-time Sync Logic
  useEffect(() => {
    if (!matchId || !currentUserId) return;

    const channel = supabase.channel(`session:${matchId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'code-update' }, (payload) => {
        setCode(payload.payload.code);
      })
      .on('broadcast', { event: 'draw-event' }, (payload) => {
        handleRemoteDraw(payload.payload);
      })
      .on('broadcast', { event: 'clear-canvas' }, () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      })
      .on('broadcast', { event: 'media-update' }, (payload) => {
        setPartnerMediaStatus(payload.payload);
      });

    const dbSubscription = supabase
      .channel(`db-messages:${matchId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `match_id=eq.${matchId}` 
      }, (payload) => {
        const newMessage = payload.new;
        setChatMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, {
            id: newMessage.id,
            sender: newMessage.sender_id === currentUserId ? 'user' : 'partner',
            name: newMessage.sender_id === currentUserId ? 'Me' : (partner?.name || 'Partner'),
            text: newMessage.content,
            timestamp: new Date(newMessage.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }];
        });
      })
      .subscribe();

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsRealtimeReady(true);
        channelRef.current = channel;
      }
    });

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(dbSubscription);
    };
  }, [matchId, partner, currentUserId]);

  // Media Control Logic
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => track.enabled = !isMuted);
      streamRef.current.getVideoTracks().forEach(track => track.enabled = !isVideoOff);
      
      channelRef.current?.send({
        type: 'broadcast',
        event: 'media-update',
        payload: { isMuted, isVideoOff }
      });
    }
  }, [isMuted, isVideoOff, isRealtimeReady]);

  // Canvas Drawing Handlers
  const handleRemoteDraw = (data: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(data.x0 * canvas.width, data.y0 * canvas.height);
    ctx.lineTo(data.x1 * canvas.width, data.y1 * canvas.height);
    ctx.stroke();
    ctx.closePath();
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    (canvas as any).lastPoint = { x, y };
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    const lastPoint = (canvas as any).lastPoint;

    if (lastPoint) {
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.closePath();

      channelRef.current?.send({
        type: 'broadcast',
        event: 'draw-event',
        payload: {
          x0: lastPoint.x / canvas.width,
          y0: lastPoint.y / canvas.height,
          x1: x / canvas.width,
          y1: y / canvas.height,
          color: drawColor,
          width: lineWidth
        }
      });
    }

    (canvas as any).lastPoint = { x, y };
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'clear-canvas'
      });
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'code-update',
        payload: { code: newCode }
      });
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        screenStreamRef.current?.getTracks().forEach(track => track.stop());
        setIsScreenSharing(false);
      } else {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          setErrorNotification("Screen sharing is not supported in this browser.");
          return;
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
        
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };
        
        setIsScreenSharing(true);
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setErrorNotification("Permission denied. Please allow screen access to share.");
      } else {
        setErrorNotification("Failed to start screen share. Please try again.");
      }
      console.warn("Screen share failed:", err);
      setIsScreenSharing(false);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !matchId || !currentUserId) return;

    const { error } = await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: currentUserId,
      content: messageInput
    });

    if (!error) setMessageInput('');
  };

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (e: any) { 
        setErrorNotification("Camera/Mic access denied. Some features will be limited.");
        console.warn("Media failed", e); 
      }
    };
    initMedia();
    return () => { 
      streamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-background-dark overflow-hidden font-display relative">
      {/* Error Notification Toast */}
      {errorNotification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 duration-300">
          <div className="bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-red-400/50">
            <span className="material-symbols-outlined">warning</span>
            <span className="text-sm font-bold uppercase tracking-tight">{errorNotification}</span>
            <button onClick={() => setErrorNotification(null)} className="ml-2 hover:opacity-70">
              <span className="material-symbols-outlined !text-sm">close</span>
            </button>
          </div>
        </div>
      )}

      <header className="flex items-center justify-between border-b border-border-dark px-6 py-3 bg-background-dark/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="size-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex h-8 bg-white/5 rounded-lg p-1 border border-white/5">
                <button 
                  onClick={() => setMode('code')}
                  className={`px-4 text-[10px] font-black uppercase tracking-widest rounded transition-all ${mode === 'code' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}
                >
                  Code
                </button>
                <button 
                  onClick={() => setMode('draw')}
                  className={`px-4 text-[10px] font-black uppercase tracking-widest rounded transition-all ${mode === 'draw' ? 'bg-primary text-white shadow-glow' : 'text-slate-500 hover:text-white'}`}
                >
                  Draw
                </button>
             </div>
             <div className="h-4 w-px bg-white/10 mx-2"></div>
             <div>
               <h2 className="text-white text-[10px] font-black uppercase tracking-widest leading-none">Interactive Lab</h2>
               <p className="text-slate-400 text-[8px] font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-1">
                 <span className={`size-1.5 rounded-full ${isRealtimeReady ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`}></span>
                 Session with {partner?.name || 'Partner'}
               </p>
             </div>
          </div>
        </div>
        <button onClick={onEnd} className="bg-red-600/20 text-red-500 text-[10px] font-black h-9 px-6 rounded-lg hover:bg-red-600 hover:text-white transition-all uppercase tracking-[0.2em]">End Session</button>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        {/* Workspace Side */}
        <div className="flex-1 flex flex-col p-4 gap-4 bg-background-dark relative">
          <div className="flex-1 relative rounded-3xl overflow-hidden bg-[#0d0f1a] border border-border-dark flex flex-col shadow-2xl">
            {mode === 'code' ? (
              <>
                <div className="flex items-center justify-between px-6 py-3 bg-white/5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary"></span>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{skill} Workspace</span>
                  </div>
                </div>
                <textarea
                  spellCheck={false}
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="flex-1 p-8 bg-transparent text-slate-300 font-mono text-sm resize-none outline-none custom-scrollbar leading-relaxed"
                  style={{ fontFamily: MONO_FONT }}
                  placeholder="# Start collaborating..."
                />
              </>
            ) : (
              <div className="flex-1 relative bg-white">
                <canvas 
                  ref={canvasRef}
                  width={1200}
                  height={800}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseOut={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-full cursor-crosshair"
                />
                <div className="absolute top-6 left-6 flex flex-col gap-2 bg-[#1a1d2d] p-3 rounded-2xl border border-white/10 shadow-2xl">
                   <button onClick={() => setDrawColor('#0d33f2')} className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${drawColor === '#0d33f2' ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: '#0d33f2' }}></button>
                   <button onClick={() => setDrawColor('#10b981')} className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${drawColor === '#10b981' ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: '#10b981' }}></button>
                   <button onClick={() => setDrawColor('#f59e0b')} className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${drawColor === '#f59e0b' ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: '#f59e0b' }}></button>
                   <button onClick={() => setDrawColor('#ef4444')} className={`size-8 rounded-full border-2 transition-transform hover:scale-110 ${drawColor === '#ef4444' ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: '#ef4444' }}></button>
                   <div className="h-px w-full bg-white/10 my-1"></div>
                   <button onClick={() => setDrawColor('#000000')} className="size-8 flex items-center justify-center text-slate-400 hover:text-white">
                      <span className="material-symbols-outlined !text-xl">edit</span>
                   </button>
                   <button onClick={clearCanvas} className="size-8 flex items-center justify-center text-red-500 hover:text-red-400">
                      <span className="material-symbols-outlined !text-xl">delete_sweep</span>
                   </button>
                </div>
              </div>
            )}

            {/* Float Video Overlays */}
            <div className="absolute bottom-6 left-6 flex gap-4 z-20 pointer-events-none">
              {isScreenSharing && (
                <div className="w-64 aspect-video bg-black rounded-2xl border-2 border-primary overflow-hidden shadow-glow pointer-events-auto">
                  <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                </div>
              )}
              
              {/* Partner Video Slot */}
              <div className="w-48 aspect-video bg-[#0a0c16] rounded-2xl border-2 border-primary overflow-hidden relative shadow-glow pointer-events-auto flex items-center justify-center group">
                {partnerMediaStatus.isVideoOff ? (
                  <div className="absolute inset-0 bg-[#0a0c16] flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div className="size-14 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 mb-2 border border-red-500/20">
                      <span className="material-symbols-outlined !text-2xl">videocam_off</span>
                    </div>
                    <p className="text-[7px] font-black uppercase text-red-500 tracking-widest">Partner Offline</p>
                  </div>
                ) : (
                  <video ref={partnerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                )}
                
                {/* Always show name badge */}
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-widest">
                  {partner?.name || 'Partner'}
                </div>
                
                {partnerMediaStatus.isMuted && (
                  <div className="absolute top-2 right-2 size-5 bg-red-600 rounded-full flex items-center justify-center border border-white/20">
                    <span className="material-symbols-outlined text-white !text-[12px]">mic_off</span>
                  </div>
                )}
              </div>

              {/* Your Local Video Slot */}
              <div className="w-40 aspect-video bg-black rounded-2xl border-2 border-emerald-500 overflow-hidden relative shadow-glow pointer-events-auto group">
                {isVideoOff ? (
                  <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                     <div className="size-10 rounded-full bg-red-600/10 flex items-center justify-center text-red-500 mb-1 border border-red-500/20">
                        <span className="material-symbols-outlined !text-xl">videocam_off</span>
                     </div>
                     <p className="text-[6px] font-black uppercase text-slate-500 tracking-widest">My Camera Off</p>
                  </div>
                ) : (
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                )}
                <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-widest">You</div>
                {isMuted && (
                  <div className="absolute top-2 right-2 size-5 bg-red-600 rounded-full flex items-center justify-center border border-white/20">
                    <span className="material-symbols-outlined text-white !text-[12px]">mic_off</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Main Lab Controls */}
          <div className="flex justify-center pb-6">
            <div className="flex items-center gap-3 bg-[#1a1d2d]/95 backdrop-blur-xl border border-white/5 p-3 rounded-2xl shadow-2xl">
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className={`size-12 flex items-center justify-center rounded-xl transition-all ${isMuted ? 'bg-red-600 text-white shadow-glow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                <span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span>
              </button>
              <button 
                onClick={() => setIsVideoOff(!isVideoOff)} 
                className={`size-12 flex items-center justify-center rounded-xl transition-all ${isVideoOff ? 'bg-red-600 text-white shadow-glow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
              >
                <span className="material-symbols-outlined">{isVideoOff ? 'videocam_off' : 'videocam'}</span>
              </button>
              <div className="w-px h-6 bg-white/10 mx-1"></div>
              <button 
                onClick={toggleScreenShare} 
                className={`px-6 h-12 flex items-center gap-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${isScreenSharing ? 'bg-primary text-white shadow-glow' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                <span className="material-symbols-outlined text-sm">{isScreenSharing ? 'stop_screen_share' : 'screen_share'}</span>
                {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
              </button>
            </div>
          </div>
        </div>

        {/* Chat Side */}
        <aside className="w-[400px] h-full border-l border-border-dark flex flex-col bg-[#0b0c14]">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
             <h3 className="text-white font-black text-xs uppercase tracking-widest">Session Chat</h3>
             <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Encrypted</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {chatMessages.map((msg, i) => (
              <div key={msg.id || i} className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-[9px] font-black text-slate-500 uppercase">{msg.name}</span>
                <div className={`p-4 rounded-2xl max-w-[85%] text-sm ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none shadow-glow' : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          <div className="p-6 border-t border-white/5 flex gap-2">
            <input 
              type="text" 
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={`Message ${partner?.name?.split(' ')[0] || 'Partner'}...`}
              className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-primary outline-none transition-all"
            />
            <button onClick={sendMessage} className="size-12 bg-primary text-white rounded-xl flex items-center justify-center shadow-glow hover:scale-105 active:scale-95 transition-all">
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default LiveSession;