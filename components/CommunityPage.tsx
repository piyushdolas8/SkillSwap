
import React from 'react';
import { AppView } from '../types';

interface Props {
  onNavigate: (view: AppView) => void;
}

const CommunityPage: React.FC<Props> = ({ onNavigate }) => {
  const activities = [
    { id: 1, user: 'Sarah C.', partner: 'Alex R.', skill: 'Python', time: '2m ago', type: 'swap' },
    { id: 2, user: 'Marcus T.', skill: 'Unity 3D', time: '15m ago', type: 'badge' },
    { id: 3, user: 'Julia V.', partner: 'David K.', skill: 'SEO', time: '1h ago', type: 'swap' },
    { id: 4, user: 'Sam O.', skill: 'SQL Mastery', time: '3h ago', type: 'badge' },
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
            <button onClick={() => onNavigate(AppView.COMMUNITY)} className="text-sm font-bold text-white border-b-2 border-primary pb-1">Community</button>
            <button onClick={() => onNavigate(AppView.LEADERBOARD)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Leaderboard</button>
          </nav>
          <div>
            <button onClick={() => onNavigate(AppView.AUTH)} className="bg-primary text-white text-xs font-bold px-5 py-2 rounded-lg">Get Started</button>
          </div>
        </div>
      </header>

      <div className="max-w-[800px] mx-auto">
        <div className="mb-12 text-center">
          <h1 className="text-white text-5xl font-black mb-4 tracking-tight uppercase">Platform Pulse</h1>
          <p className="text-slate-400 text-lg font-medium">Real-time proofs of peer mastery and community verified growth.</p>
        </div>

        <div className="space-y-6">
          {activities.map(activity => (
            <div key={activity.id} className="bg-card-dark border border-border-dark p-6 rounded-[2rem] flex items-center gap-6 group hover:border-primary/30 transition-all">
              <div className={`size-16 rounded-2xl flex items-center justify-center text-2xl ${activity.type === 'swap' ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-500'}`}>
                <span className="material-symbols-outlined !text-3xl">{activity.type === 'swap' ? 'handshake' : 'verified'}</span>
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-lg">
                  {activity.type === 'swap' ? (
                    <>
                      <span className="text-primary">{activity.user}</span> swapped <span className="underline decoration-primary/50 underline-offset-4">{activity.skill}</span> with <span className="text-slate-300">{activity.partner}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-emerald-500">{activity.user}</span> earned the <span className="text-white font-black uppercase tracking-tighter">{activity.skill}</span> Mastery Badge
                    </>
                  )}
                </p>
                <p className="text-slate-600 text-xs font-black uppercase tracking-[0.2em] mt-1">{activity.time}</p>
              </div>
              <div className="hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="text-slate-500 hover:text-primary"><span className="material-symbols-outlined">favorite</span></button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 p-12 bg-primary/5 border border-primary/10 rounded-[3rem] text-center">
           <h2 className="text-white text-3xl font-black mb-4">Want to lead a workshop?</h2>
           <p className="text-slate-400 mb-8 max-w-sm mx-auto">Group sessions are now live. Teach up to 5 peers at once and earn 5x SkillTokens.</p>
           <button className="bg-primary text-white font-black px-10 py-4 rounded-2xl uppercase tracking-[0.2em] shadow-glow hover:scale-105 transition-all">Create Event</button>
        </div>
      </div>
    </div>
  );
};

export default CommunityPage;
