
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppView, UserProfile, PortfolioEntry } from './types';
import { supabase } from './services/supabaseClient';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import ProfileSetup from './components/ProfileSetup';
import MatchingPage from './components/MatchingPage';
import MatchFoundPage from './components/MatchFoundPage';
import LiveSession from './components/LiveSession';
import FeedbackPage from './components/FeedbackPage';
import MarketplacePage from './components/MarketplacePage';
import CommunityPage from './components/CommunityPage';
import LeaderboardPage from './components/LeaderboardPage';
import InquiryPage from './components/InquiryPage';
import HistoryPage from './components/HistoryPage';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [session, setSession] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showLoadingFallback, setShowLoadingFallback] = useState(false);
  const [isProfileFetching, setIsProfileFetching] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  
  const initializationRef = useRef(false);

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '', fullName: '', email: '', teaching: [], learning: [], bio: '', tokens: 5, portfolio: [], level: 1, xp: 0, streak: 0, avatarUrl: ''
  });

  const navigate = useCallback((view: AppView) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  }, []);

  const calculateStreak = async (userId: string, currentStreak: number, lastActiveAt: string | null) => {
    const now = new Date();
    const lastActive = lastActiveAt ? new Date(lastActiveAt) : null;
    
    if (!lastActive) {
      supabase.from('profiles').update({ streak: 1, last_active_at: now.toISOString() }).eq('id', userId).then(() => {});
      return 1;
    }

    const diffInMs = now.getTime() - lastActive.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    let newStreak = currentStreak;

    if (diffInHours >= 24 && diffInHours < 48) {
      newStreak += 1;
      supabase.from('profiles').update({ streak: newStreak, last_active_at: now.toISOString() }).eq('id', userId).then(() => {});
    } else if (diffInHours >= 48) {
      newStreak = 1;
      supabase.from('profiles').update({ streak: 1, last_active_at: now.toISOString() }).eq('id', userId).then(() => {});
    } else {
      supabase.from('profiles').update({ last_active_at: now.toISOString() }).eq('id', userId).then(() => {});
    }
    
    return newStreak;
  };

  const fetchProfile = async (userId: string) => {
    if (isProfileFetching) return;
    setIsProfileFetching(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (profileError || !profileData) return;

      const updatedStreak = await calculateStreak(userId, profileData.streak || 0, profileData.last_active_at);

      const { data: skillsData } = await supabase
        .from('skills')
        .select('skill_name, type')
        .eq('user_id', userId);

      const { data: portfolioData } = await supabase
        .from('portfolio')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const mappedPortfolio: PortfolioEntry[] = (portfolioData || []).map(item => ({
        id: item.id,
        skill: item.skill,
        partnerName: item.partner_name,
        type: item.type as 'taught' | 'learned',
        date: new Date(item.created_at).toLocaleDateString(),
        summary: item.summary
      }));

      const fetchedProfile: UserProfile = {
        name: profileData.name || '',
        fullName: profileData.full_name || '',
        email: profileData.email || '',
        bio: profileData.bio || '',
        tokens: profileData.tokens || 0,
        level: profileData.level || 1,
        xp: profileData.xp || 0,
        streak: updatedStreak,
        avatarUrl: profileData.avatar_url || '',
        githubUrl: profileData.github_url || '',
        linkedinUrl: profileData.linkedin_url || '',
        teaching: skillsData?.filter(s => s.type === 'teaching').map(s => s.skill_name) || [],
        learning: skillsData?.filter(s => s.type === 'learning').map(s => s.skill_name) || [],
        portfolio: mappedPortfolio
      };

      setUserProfile(fetchedProfile);
    } catch (e) { 
      console.warn("Profile fetch error:", e);
    } finally {
      setIsProfileFetching(false);
    }
  };

  const handleDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setIsInitialLoading(false);
    const mockUser: UserProfile = {
      name: 'Guest Expert',
      fullName: 'Demo Account',
      email: 'guest@skillswap.io',
      teaching: ['React', 'TypeScript'],
      learning: ['Python'],
      bio: 'Guest expert testing the system.',
      tokens: 10,
      portfolio: [
        { id: '1', skill: 'React', partnerName: 'Saroj', type: 'taught', date: '2/10/2026', summary: 'Architected a state-of-the-art dashboard.' },
        { id: '2', skill: 'Python', partnerName: 'Saroj', type: 'learned', date: '2/11/2026', summary: 'Explored neural networks and AI integration.' },
      ],
      level: 1, xp: 120, streak: 3,
      avatarUrl: '',
      githubUrl: 'https://github.com',
      linkedinUrl: 'https://linkedin.com'
    };
    setUserProfile(mockUser);
    setSession({ user: { id: 'demo-id' } });
    navigate(AppView.LANDING);
  }, [navigate]);

  const handleStartAction = useCallback(() => {
    if (!session && !isDemoMode) {
      navigate(AppView.AUTH);
      return;
    }
    const isProfileIncomplete = userProfile.teaching.length === 0 || userProfile.learning.length === 0;
    if (isProfileIncomplete) {
      navigate(AppView.PROFILE_SETUP);
    } else {
      navigate(AppView.MATCHING);
    }
  }, [session, isDemoMode, userProfile, navigate]);

  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    let mounted = true;
    const fallbackTimer = setTimeout(() => {
      if (mounted) setShowLoadingFallback(true);
    }, 5000);

    const initApp = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(existingSession);
          if (existingSession) {
            await Promise.race([
              fetchProfile(existingSession.user.id),
              new Promise(resolve => setTimeout(resolve, 3000))
            ]);
          }
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        if (mounted) {
          setIsInitialLoading(false);
          clearTimeout(fallbackTimer);
        }
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession && event === 'SIGNED_IN') {
        fetchProfile(newSession.user.id);
        navigate(AppView.LANDING);
      } else if (event === 'SIGNED_OUT') {
        setIsDemoMode(false);
        setUserProfile({ name: '', fullName: '', email: '', teaching: [], learning: [], bio: '', tokens: 5, portfolio: [], level: 1, xp: 0, streak: 0, avatarUrl: '' });
        navigate(AppView.LANDING);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleMatchFound = (partner: UserProfile, matchId: string) => {
    setPartnerProfile(partner);
    setCurrentMatchId(matchId);
    navigate(AppView.MATCH_FOUND);
  };

  const handlePurchaseTokens = async (amount: number) => {
    const newTokens = userProfile.tokens + amount;
    if (isDemoMode) {
      setUserProfile(prev => ({ ...prev, tokens: newTokens }));
      return true;
    }
    try {
      const { error } = await supabase.from('profiles').update({ tokens: newTokens }).eq('id', session?.user?.id);
      if (error) throw error;
      setUserProfile(prev => ({ ...prev, tokens: newTokens }));
      return true;
    } catch (e) { return false; }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080910] p-6 text-center">
        <div className="relative mb-8">
          <div className="loader-ring"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="material-symbols-outlined text-primary/40 animate-pulse">hub</span>
          </div>
        </div>
        <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] animate-pulse mb-2">Establishing Peer Connection...</p>
        
        {showLoadingFallback && (
          <div className="mt-8 p-8 bg-white/5 border border-white/5 rounded-[2rem] max-w-sm animate-in fade-in slide-in-from-bottom-4">
            <p className="text-slate-500 text-xs font-medium mb-6">
              The network is taking longer than expected to respond. This usually happens if the Supabase project is hibernating.
            </p>
            <button 
              onClick={handleDemoMode}
              className="w-full py-4 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-glow hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined !text-sm">rocket_launch</span>
              Launch Demo Mode
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 text-slate-600 text-[9px] font-black uppercase tracking-widest hover:text-white transition-colors"
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case AppView.LANDING:
        return <LandingPage onNavigate={navigate} userProfile={session ? userProfile : undefined} onStart={handleStartAction} onPurchase={handlePurchaseTokens} />;
      case AppView.AUTH:
        return <AuthPage onBack={() => navigate(AppView.LANDING)} onDemoMode={handleDemoMode} />; 
      case AppView.PROFILE_SETUP:
        return <ProfileSetup userProfile={userProfile} setUserProfile={setUserProfile} onComplete={() => navigate(AppView.LANDING)} />;
      case AppView.MATCHING:
        return <MatchingPage onMatchFound={handleMatchFound} />;
      case AppView.MATCH_FOUND:
        return <MatchFoundPage partner={partnerProfile} onJoin={() => navigate(AppView.LIVE_SESSION)} />;
      case AppView.LIVE_SESSION:
        return <LiveSession matchId={currentMatchId} partner={partnerProfile} skill={userProfile.learning[0] || 'Python'} onEnd={() => navigate(AppView.FEEDBACK)} />;
      case AppView.FEEDBACK:
        return <FeedbackPage userProfile={userProfile} setUserProfile={setUserProfile} partner={partnerProfile} onFinish={() => navigate(AppView.LANDING)} />;
      case AppView.MARKETPLACE:
        return <MarketplacePage onNavigate={navigate} onStartMatch={handleStartAction} />;
      case AppView.COMMUNITY:
        return <CommunityPage onNavigate={navigate} />;
      case AppView.LEADERBOARD:
        return <LeaderboardPage onNavigate={navigate} />;
      case AppView.INQUIRY:
        return <InquiryPage onBack={() => navigate(AppView.LANDING)} />;
      case AppView.HISTORY:
        return <HistoryPage userProfile={userProfile} onNavigate={navigate} />;
      default:
        return <LandingPage onNavigate={navigate} userProfile={session ? userProfile : undefined} onStart={handleStartAction} onPurchase={handlePurchaseTokens} />;
    }
  };

  return <div className="min-h-screen bg-background-dark text-white bg-mesh">{renderCurrentView()}</div>;
};

export default App;
