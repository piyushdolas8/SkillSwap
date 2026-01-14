import React, { useState, useEffect } from 'react';
import { UserProfile, PortfolioEntry } from '../types';
import { supabase } from '../services/supabaseClient';

interface Props {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  partner: UserProfile | null;
  onFinish: () => void;
}

const FeedbackPage: React.FC<Props> = ({ userProfile, setUserProfile, partner, onFinish }) => {
  const [rating, setRating] = useState(0);
  const [minting, setMinting] = useState(true);

  useEffect(() => {
    const completeSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("No session");

        const userId = session.user.id;
        const skill = userProfile.learning[0] || 'Skill Mastery';
        const partnerName = partner?.name || 'Expert Peer';
        const summary = `Mastered ${skill} core logic and collaborative coding with mentor ${partnerName}. Verified via Live Session.`;

        // 1. Save to portfolio table with dynamic partner name
        const { error: portfolioError } = await supabase
          .from('portfolio')
          .insert({
            user_id: userId,
            skill: skill,
            partner_name: partnerName,
            type: 'learned',
            summary: summary
          });

        if (portfolioError) throw portfolioError;

        // 2. Award tokens
        const newTokens = userProfile.tokens + 1;
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ tokens: newTokens })
          .eq('id', userId);

        if (profileError) throw profileError;

        // Update local state
        setUserProfile(prev => ({
          ...prev,
          tokens: newTokens,
          portfolio: [{
            id: Date.now().toString(),
            skill,
            partnerName,
            type: 'learned',
            date: new Date().toLocaleDateString(),
            summary
          }, ...prev.portfolio]
        }));
      } catch (err) {
        console.error("Error finalizing session:", err);
      } finally {
        // Minimum delay for cool animation effect
        setTimeout(() => setMinting(false), 2000);
      }
    };

    completeSession();
  }, [partner, userProfile.learning, setUserProfile, userProfile.tokens]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 min-h-screen bg-background-dark">
      <div className="max-w-[700px] w-full flex flex-col items-center">
        {minting ? (
          <div className="flex flex-col items-center py-20">
            <div className="size-20 rounded-full border-4 border-primary border-t-transparent animate-spin mb-8"></div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Minting Proof of Skill...</h2>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs text-glow-primary">Authenticating swap on decentralized network</p>
          </div>
        ) : (
          <>
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest mb-4">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                Proof of Skill Verified
              </div>
              <h1 className="text-5xl font-black text-white tracking-tighter mb-2 uppercase">SESSION COMPLETE</h1>
              <p className="text-slate-400 text-lg font-medium">You've successfully leveled up with {partner?.name || 'your mentor'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-10">
              <div className="bg-[#1a1d2e] rounded-3xl p-8 border border-white/5 relative overflow-hidden group hover:border-primary/50 transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                  <span className="material-symbols-outlined !text-[80px]">token</span>
                </div>
                <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Skill Economy Reward</h3>
                <div className="flex items-center gap-4">
                  <div className="text-5xl font-black text-white">+1</div>
                  <div>
                    <p className="text-primary font-bold text-xl uppercase tracking-tighter">SkillToken</p>
                    <p className="text-slate-500 text-xs font-bold">Balance: {userProfile.tokens} ST</p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 rounded-3xl p-8 border border-primary/20 relative overflow-hidden">
                <h3 className="text-primary text-[10px] font-black uppercase tracking-[0.2em] mb-4">Portfolio Badge Earned</h3>
                <div className="flex items-center gap-4">
                  <div className="size-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-glow">
                    <span className="material-symbols-outlined !text-4xl">verified</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-xl uppercase tracking-tighter">Mastery Lvl {userProfile.level}</p>
                    <p className="text-slate-400 text-xs font-bold">Endorsed by {partner?.name.split(' ')[0] || 'Mentor'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full bg-[#111218] border border-white/5 rounded-3xl p-8 mb-10 shadow-2xl">
              <h3 className="text-white text-xl font-bold mb-6 font-display uppercase tracking-tighter">Rate your mentor</h3>
              <div className="flex gap-4 mb-8 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star}
                    onClick={() => setRating(star)}
                    className={`material-symbols-outlined !text-5xl transition-all hover:scale-110 ${rating >= star ? 'text-primary' : 'text-slate-800'}`}
                    style={{ fontVariationSettings: `'FILL' ${rating >= star ? 1 : 0}` }}
                  >
                    star
                  </button>
                ))}
              </div>
              <textarea 
                className="w-full h-32 p-6 bg-[#1b1d27] border border-white/5 rounded-2xl text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-sm font-medium" 
                placeholder={`Write a peer recommendation for ${partner?.name || 'your mentor'}...`}
              ></textarea>
            </div>

            <button 
              onClick={onFinish}
              className="w-full bg-white text-black font-black py-6 rounded-2xl transition-all shadow-glow flex items-center justify-center gap-3 text-lg uppercase tracking-widest hover:bg-primary hover:text-white"
            >
              Update My Dashboard
              <span className="material-symbols-outlined">dashboard</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default FeedbackPage;