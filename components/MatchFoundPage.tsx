import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { safeJsonParse } from '../services/geminiService';
import { UserProfile } from '../types';

interface Props {
  onJoin: () => void;
  partner: UserProfile | null;
}

const MatchFoundPage: React.FC<Props> = ({ onJoin, partner }) => {
  const [matchReason, setMatchReason] = useState('Perfect peer symmetry for a high-impact exchange.');
  const [agenda, setAgenda] = useState<string[]>(['Icebreaker & Goals', 'Deep Dive: Core Concepts', 'Workshop: Practical Exercise']);
  const [loading, setLoading] = useState(true);
  const [isPinged, setIsPinged] = useState(false);

  useEffect(() => {
    if (!partner) return;

    const fetchAIContent = async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `A student wants to learn ${partner.learning.join(', ')} and teaches ${partner.teaching.join(', ')}. 
      Explain why they are a great match for a peer session and create a 3-step agenda.
      Return the response in this JSON format: {"reason": "string", "agenda": ["step 1", "step 2", "step 3"]}`;

      try {
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: { responseMimeType: "application/json", maxOutputTokens: 300 }
        });
        
        const data = safeJsonParse(result.text || '{}');
        if (data) {
          if (data.reason) setMatchReason(data.reason);
          if (data.agenda) setAgenda(data.agenda);
        }
      } catch (e) {
        console.warn("Match AI generation failed", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAIContent();
  }, [partner]);

  if (!partner) return null;

  const handlePing = () => {
    if (isPinged) return;
    setIsPinged(true);
    setTimeout(() => setIsPinged(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden font-display bg-mesh h-screen">
      <div className="max-w-[900px] w-full flex flex-col items-center relative z-10">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-tighter mb-4 animate-bounce">
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
            High Compatibility Match
          </div>
          <h1 className="text-white text-5xl md:text-7xl font-black pb-2 tracking-tighter uppercase">BOOM. MATCHED.</h1>
        </div>

        <div className="w-full bg-[#111218]/90 backdrop-blur-2xl border border-border-dark rounded-[2.5rem] p-8 md:p-12 shadow-[0_40px_100px_-20px_rgba(13,51,242,0.4)] relative overflow-hidden">
          <div className="flex flex-col lg:flex-row gap-12 relative z-10">
            <div className="flex-shrink-0 flex flex-col items-center text-center">
              <div className="h-40 w-40 md:h-52 md:w-52 rounded-[2rem] ring-4 ring-primary ring-offset-8 ring-offset-background-dark overflow-hidden rotate-3 shadow-2xl">
                <img src={partner.avatarUrl || `https://picsum.photos/seed/${partner.name}/500/500`} alt={partner.name} className="w-full h-full object-cover" />
              </div>
              <div className="mt-6">
                <h2 className="text-white text-3xl font-black">{partner.name}</h2>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Available to Swap</p>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="mb-8">
                <h3 className="text-[10px] uppercase font-black tracking-[0.2em] text-primary mb-3">AI Match Insight</h3>
                <p className={`text-white text-2xl font-bold leading-tight transition-opacity duration-500 ${loading ? 'opacity-50' : 'opacity-100'}`}>"{matchReason}"</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <h4 className="text-[10px] uppercase font-black text-slate-500 mb-2">{partner.name} will teach</h4>
                  <p className="text-primary font-bold text-lg">{partner.teaching[0] || 'Expertise'}</p>
                </div>
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
                  <h4 className="text-[10px] uppercase font-black text-slate-500 mb-2">You will teach</h4>
                  <p className="text-emerald-500 font-bold text-lg">{partner.learning[0] || 'New Skill'}</p>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6">
                <h4 className="text-[10px] uppercase font-black text-primary mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">event_note</span>
                  AI Generated Agenda
                </h4>
                <ul className="space-y-3">
                  {agenda.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
                      <span className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">{i+1}</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row gap-4">
            <button onClick={onJoin} className="flex-1 group flex items-center justify-center gap-3 bg-primary hover:bg-white hover:text-primary text-white text-lg font-black py-5 rounded-2xl transition-all shadow-glow uppercase">
              <span className="material-symbols-outlined group-hover:rotate-12">video_call</span>
              ENTER LIVE SESSION
            </button>
            <button 
              onClick={handlePing}
              className={`flex-1 flex items-center justify-center gap-3 text-lg font-black py-5 rounded-2xl transition-all uppercase ${isPinged ? 'bg-emerald-500 text-white shadow-glow animate-pulse' : 'bg-slate-800/50 hover:bg-slate-700 text-white'}`}
            >
              <span className="material-symbols-outlined">{isPinged ? 'check_circle' : 'chat_bubble'}</span>
              {isPinged ? 'PING SENT!' : `PING ${partner.name.split(' ')[0].toUpperCase()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatchFoundPage;