import React, { useState, useEffect, useRef } from 'react';
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
  'python': `# Lesson 1: Data Structures\ndef main():\n    items = ["Apple", "Banana", "Cherry"]\n    for item in items:\n        print(f"I like {item}")`,
  'javascript': `const greet = (name) => {\n  console.log(\`Hello, \${name}!\`);\n};`
};

const LiveSession: React.FC<Props> = ({ matchId, partner, skill = 'Python', onEnd }) => {
  const [code, setCode] = useState<string>(DEFAULT_CODE_TEMPLATES['python']);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);
    };
    getSession();
  }, []);

  // Real-time Chat Logic
  useEffect(() => {
    if (!matchId || !currentUserId) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });
      
      if (data) {
        setChatMessages(data.map(m => ({
          id: m.id,
          sender: m.sender_id === currentUserId ? 'user' : 'partner',
          name: m.sender_id === currentUserId ? 'Me' : (partner?.name || 'Partner'),
          text: m.content,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        })));
      }
    };
    fetchMessages();

    const channel = supabase
      .channel(`match:${matchId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `match_id=eq.${matchId}` 
      }, (payload) => {
        const newMessage = payload.new;
        setChatMessages(prev => {
          // Prevent duplicates from own inserts
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

    return () => { supabase.removeChannel(channel); };
  }, [matchId, partner, currentUserId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!messageInput.trim() || !matchId || !currentUserId) return;

    const { data, error } = await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: currentUserId,
      content: messageInput
    }).select().single();

    if (!error && data) {
      // Optimistic update handled by Subscription
      setMessageInput('');
    }
  };

  useEffect(() => {
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsConnected(true);
      } catch (e) { console.warn("Media failed", e); }
    };
    initMedia();
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-background-dark overflow-hidden font-display relative">
      <header className="flex items-center justify-between border-b border-border-dark px-6 py-3 bg-background-dark/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="size-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
          </div>
          <div>
            <h2 className="text-white text-md font-bold leading-tight uppercase tracking-tight">SkillSwap Live</h2>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Session with {partner?.name || 'Alex Rivera'}</p>
            </div>
          </div>
        </div>
        <button onClick={onEnd} className="bg-red-600/20 text-red-500 text-[10px] font-black h-9 px-6 rounded-lg hover:bg-red-600 hover:text-white transition-all uppercase tracking-[0.2em]">Complete Session</button>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 flex flex-col p-4 gap-4 bg-background-dark relative">
          <div className="flex-1 relative rounded-3xl overflow-hidden bg-[#0d0f1a] border border-border-dark flex flex-col shadow-2xl">
            <div className="flex-1 p-8 font-mono text-slate-300 whitespace-pre overflow-auto custom-scrollbar" style={{ fontFamily: MONO_FONT }}>
              {code}
            </div>
            <div className="absolute bottom-6 left-6 flex gap-4">
              <div className="w-40 aspect-video bg-black rounded-2xl border-2 border-primary overflow-hidden relative shadow-glow">
                <video ref={videoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'opacity-0' : 'opacity-100'}`} />
              </div>
            </div>
          </div>
          
          <div className="flex justify-center -mt-10 pb-6">
            <div className="flex items-center gap-3 bg-[#1a1d2d]/95 backdrop-blur-xl border border-white/5 p-3 rounded-2xl shadow-2xl">
              <button onClick={() => setIsMuted(!isMuted)} className={`size-12 flex items-center justify-center rounded-xl ${isMuted ? 'bg-red-500' : 'bg-slate-800'}`}><span className="material-symbols-outlined">{isMuted ? 'mic_off' : 'mic'}</span></button>
              <button onClick={() => setIsVideoOff(!isVideoOff)} className={`size-12 flex items-center justify-center rounded-xl ${isVideoOff ? 'bg-red-500' : 'bg-slate-800'}`}><span className="material-symbols-outlined">{isVideoOff ? 'videocam_off' : 'videocam'}</span></button>
            </div>
          </div>
        </div>

        <aside className="w-[400px] h-full border-l border-border-dark flex flex-col bg-[#0b0c14]">
          <div className="p-6 border-b border-white/5">
             <h3 className="text-white font-black text-xs uppercase tracking-widest">Real-time Peer Chat</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {chatMessages.map((msg, i) => (
              <div key={msg.id || i} className={`flex flex-col gap-1 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-[9px] font-black text-slate-500 uppercase">{msg.name} • {msg.timestamp}</span>
                <div className={`p-4 rounded-2xl max-w-[85%] text-sm ${msg.sender === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'}`}>
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="p-6 border-t border-white/5 flex gap-2">
            <input 
              type="text" 
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={`Send a message to ${partner?.name?.split(' ')[0] || 'Alex'}...`}
              className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
            />
            <button onClick={sendMessage} className="size-12 bg-primary text-white rounded-xl flex items-center justify-center shadow-glow">
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default LiveSession;