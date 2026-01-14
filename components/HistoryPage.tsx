
import React, { useState } from 'react';
import { UserProfile, AppView } from '../types';

interface Props {
  userProfile: UserProfile;
  onNavigate: (view: AppView) => void;
}

const HistoryPage: React.FC<Props> = ({ userProfile, onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'taught' | 'learned'>('all');

  const filteredPortfolio = userProfile.portfolio.filter(entry => {
    const matchesSearch = entry.skill.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          entry.partnerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' || entry.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: userProfile.portfolio.length,
    taught: userProfile.portfolio.filter(p => p.type === 'taught').length,
    learned: userProfile.portfolio.filter(p => p.type === 'learned').length,
  };

  return (
    <div className="min-h-screen bg-background-dark pt-24 pb-20 px-6">
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
          <button onClick={() => onNavigate(AppView.LANDING)} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
            <span className="material-symbols-outlined text-sm">arrow_back</span> Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto mt-12">
        <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <h1 className="text-white text-5xl font-black uppercase tracking-tighter mb-2">Swap History</h1>
            <p className="text-slate-400 text-lg font-medium">Archived logs of your peer-to-peer network growth.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center min-w-[100px]">
              <p className="text-2xl font-black text-white">{stats.total}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Swaps</p>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center min-w-[100px]">
              <p className="text-2xl font-black text-primary">{stats.taught}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expertised</p>
            </div>
            <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-center min-w-[100px]">
              <p className="text-2xl font-black text-emerald-500">{stats.learned}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mastered</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6 mb-10 items-center justify-between bg-[#111218] p-6 rounded-[2rem] border border-white/5">
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by skill or partner name..."
              className="w-full bg-black/20 border border-white/10 rounded-xl h-12 pl-12 pr-4 text-white placeholder:text-slate-700 outline-none focus:border-primary transition-all"
            />
          </div>
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'all' ? 'bg-primary text-white' : 'text-slate-500'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilterType('taught')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'taught' ? 'bg-primary text-white' : 'text-slate-500'}`}
            >
              Taught
            </button>
            <button 
              onClick={() => setFilterType('learned')}
              className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === 'learned' ? 'bg-primary text-white' : 'text-slate-500'}`}
            >
              Learned
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredPortfolio.length > 0 ? filteredPortfolio.map((entry, idx) => (
            <div key={entry.id} className="bg-card-dark border border-border-dark p-8 rounded-[2.5rem] flex flex-col md:flex-row gap-8 hover:border-primary/50 transition-all group animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
              <div className={`size-20 rounded-2xl flex items-center justify-center transition-all shrink-0 ${entry.type === 'taught' ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white' : 'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white'}`}>
                <span className="material-symbols-outlined !text-4xl">{entry.type === 'taught' ? 'school' : 'auto_awesome'}</span>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <h3 className="text-2xl font-black text-white">{entry.skill}</h3>
                  <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${entry.type === 'taught' ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'}`}>
                    {entry.type === 'taught' ? 'Expertise Taught' : 'Skill Mastery'}
                  </span>
                </div>
                <p className="text-slate-400 text-base leading-relaxed mb-6">{entry.summary}</p>
                <div className="flex flex-wrap items-center gap-8 text-[11px] font-black uppercase tracking-widest text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">person_pin</span>
                    Partner: <span className="text-white">{entry.partnerName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    Verified on: <span className="text-white">{entry.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">shield_check</span>
                    Status: <span className="text-emerald-500">Authenticated</span>
                  </div>
                </div>
              </div>
            </div>
          )) : (
            <div className="text-center py-32 bg-[#111218] rounded-[3rem] border border-dashed border-white/5">
              <span className="material-symbols-outlined text-slate-800 !text-7xl mb-6">history_edu</span>
              <p className="text-slate-500 text-lg font-bold uppercase tracking-widest">No matching records found</p>
              <p className="text-slate-700 text-sm mt-2">Adjust your search or filters to see more.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default HistoryPage;
