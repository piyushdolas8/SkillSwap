import React from 'react';
import { AppView } from '../types';

interface Props {
  onNavigate: (view: AppView) => void;
}

const LeaderboardPage: React.FC<Props> = ({ onNavigate }) => {
  const topUsers = [
    { rank: 1, name: 'Alex Rivera', taught: 156, learned: 42, tokens: 450, avatar: 'https://picsum.photos/seed/alex/200' },
    { rank: 2, name: 'Sofia Chen', taught: 124, learned: 67, tokens: 380, avatar: 'https://picsum.photos/seed/sofia/200' },
    { rank: 3, name: 'James Wilson', taught: 98, learned: 12, tokens: 310, avatar: 'https://picsum.photos/seed/james/200' },
    { rank: 4, name: 'Elena Rossi', taught: 87, learned: 91, tokens: 295, avatar: 'https://picsum.photos/seed/elena/200' },
    { rank: 5, name: 'David Kim', taught: 76, learned: 34, tokens: 240, avatar: 'https://picsum.photos/seed/david/200' },
  ];

  return (
    <div className="min-h-screen bg-background-dark pt-24 px-6 md:px-12 pb-20">
      <header className="fixed top-0 z-50 w-full border-b border-white/5 bg-background-dark/80 backdrop-blur-md left-0">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate(AppView.LANDING)}>
            <div className="text-primary">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-display">SkillSwap</span>
          </div>
          <nav className="hidden md:flex items-center gap-10">
            <button onClick={() => onNavigate(AppView.MARKETPLACE)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Marketplace</button>
            <button onClick={() => onNavigate(AppView.COMMUNITY)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Community</button>
            <button onClick={() => onNavigate(AppView.LEADERBOARD)} className="text-sm font-bold text-white border-b-2 border-primary pb-1">Leaderboard</button>
          </nav>
          <div>
            <button onClick={() => onNavigate(AppView.AUTH)} className="bg-primary text-white text-xs font-bold px-5 py-2 rounded-lg">Get Started</button>
          </div>
        </div>
      </header>

      <div className="max-w-[1000px] mx-auto">
        <div className="mb-12 text-center relative">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-6 backdrop-blur-md">
            <span className="material-symbols-outlined text-sm">simulation</span>
            Sample Data - Demo Network Participants
          </div>
          <h1 className="text-white text-5xl font-black mb-4 tracking-tight uppercase">Skill Titans</h1>
          <p className="text-slate-400 text-lg font-medium">The top 1% of our decentralized learning economy.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {topUsers.map((user, idx) => (
            <div 
              key={user.rank} 
              className={`bg-card-dark border p-6 rounded-[2.5rem] flex items-center gap-8 group transition-all hover:-translate-y-1 ${idx < 3 ? 'border-primary/40 shadow-[0_10px_30px_-10px_rgba(13,51,242,0.3)]' : 'border-border-dark'}`}
            >
              <div className="w-12 text-center">
                <span className={`text-4xl font-black ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-700' : 'text-slate-700'}`}>
                  #{user.rank}
                </span>
              </div>
              
              <div className="size-20 rounded-3xl overflow-hidden border-2 border-white/5 group-hover:border-primary/50 transition-colors">
                <img src={user.avatar} className="w-full h-full object-cover" alt={user.name} />
              </div>

              <div className="flex-1">
                <h3 className="text-white text-2xl font-black">{user.name}</h3>
                <div className="flex items-center gap-6 mt-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm">school</span>
                    <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">{user.taught} Taught</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500 text-sm">auto_awesome</span>
                    <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">{user.learned} Learned</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-3xl font-black text-white">{user.tokens} <span className="text-xs text-primary">ST</span></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">Lifetime Earnings</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 flex justify-center">
           <div className="flex items-center gap-8 bg-white/5 px-10 py-6 rounded-3xl border border-white/5">
              <div className="text-center">
                <p className="text-white text-xl font-bold">128</p>
                <p className="text-[10px] font-black uppercase text-slate-500">Your Rank</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                <p className="text-white text-xl font-bold">Top 5%</p>
                <p className="text-[10px] font-black uppercase text-slate-500">Tier</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <button onClick={() => onNavigate(AppView.MATCHING)} className="bg-primary text-white text-xs font-black uppercase tracking-widest px-8 py-3 rounded-xl hover:shadow-glow transition-all">Climb Higher</button>
           </div>
        </div>

        <div className="mt-12 text-center text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">
          All peer activity shown above is generated for simulation purposes.
        </div>
      </div>
    </div>
  );
};

export default LeaderboardPage;