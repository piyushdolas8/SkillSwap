import React, { useState, useCallback, useEffect } from 'react';
import { AppView, UserProfile } from './types';
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

const DEMO_STORAGE_KEY = 'skillswap_demo_profile';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  const [session, setSession] = useState<any>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isSupabaseDown, setIsSupabaseDown] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [dbNeedsSetup, setDbNeedsSetup] = useState(false);
  
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem(DEMO_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    
    return {
      name: '', fullName: '', email: '', teaching: [], learning: [], bio: '', tokens: 5, portfolio: [], level: 1, xp: 0, streak: 0
    };
  });

  const navigate = useCallback((view: AppView) => {
    setCurrentView(view);
    window.scrollTo(0, 0);
  }, []);

  const handleDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setIsSupabaseDown(false);
    setIsInitialLoading(false);
    
    const saved = localStorage.getItem(DEMO_STORAGE_KEY);
    let mockUser: UserProfile;
    
    if (saved) {
      mockUser = JSON.parse(saved);
    } else {
      mockUser = {
        name: 'Demo Expert',
        fullName: 'Demo Account',
        email: 'guest@skillswap.io',
        teaching: ['React', 'TypeScript'],
        learning: ['Python'],
        bio: 'Guest expert testing the system.',
        tokens: 10,
        portfolio: [],
        level: 1, xp: 120, streak: 3
      };
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(mockUser));
    }
    setUserProfile(mockUser);
    setSession({ user: { id: 'demo-id' } });
    navigate(AppView.LANDING);
  }, [navigate]);

  useEffect(() => {
    let mounted = true;

    // Aggressive failsafe to ensure the app doesn't hang
    const failsafe = setTimeout(() => {
      if (mounted && isInitialLoading) {
        setIsInitialLoading(false);
        // We don't mark as down yet, just stop the spinner to show Landing
      }
    }, 2000);

    const initApp = async () => {
      try {
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted && existingSession) {
          setSession(existingSession);
          // Async profile fetch to avoid blocking render
          fetchProfile(existingSession.user.id);
        }
      } catch (err) {
        console.warn("Auth initialization failed - Backend may be cold-starting");
      } finally {
        if (mounted) {
          setIsInitialLoading(false);
          clearTimeout(failsafe);
        }
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted && newSession) {
        setSession(newSession);
        fetchProfile(newSession.user.id);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(failsafe);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', userId).single();

      if (profileError) {
        if (profileError.code === '42P01') setDbNeedsSetup(true);
        else if (profileError.code === 'PGRST116') navigate(AppView.PROFILE_SETUP);
        return;
      }

      const { data: skillsData } = await supabase
        .from('skills').select('skill_name, type').eq('user_id', userId);

      setUserProfile({
        name: profileData.name || '',
        fullName: profileData.full_name || '',
        email: profileData.email || '',
        bio: profileData.bio || '',
        tokens: profileData.tokens || 0,
        level: profileData.level || 1,
        xp: profileData.xp || 0,
        streak: profileData.streak || 0,
        teaching: skillsData?.filter(s => s.type === 'teaching').map(s => s.skill_name) || [],
        learning: skillsData?.filter(s => s.type === 'learning').map(s => s.skill_name) || [],
        portfolio: []
      });
    } catch (e) {
      console.warn("Profile fetch deferred");
    }
  };

  const handlePurchaseTokens = async (amount: number) => {
    const newTokens = userProfile.tokens + amount;
    if (isDemoMode) {
      setUserProfile(prev => ({ ...prev, tokens: newTokens }));
      return true;
    }
    try {
      await supabase.from('profiles').update({ tokens: newTokens }).eq('id', session?.user?.id);
      setUserProfile(prev => ({ ...prev, tokens: newTokens }));
      return true;
    } catch (e) { return false; }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080910]">
        <div className="loader-ring mb-4"></div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Establishing Peer Network...</p>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case AppView.LANDING:
        return <LandingPage onNavigate={navigate} userProfile={session ? userProfile : undefined} onStart={() => navigate(session ? AppView.MATCHING : AppView.AUTH)} onPurchase={handlePurchaseTokens} />;
      case AppView.AUTH:
        return <AuthPage onBack={() => navigate(AppView.LANDING)} onDemoMode={handleDemoMode} isSupabaseDown={isSupabaseDown} />; 
      case AppView.PROFILE_SETUP:
        return <ProfileSetup userProfile={userProfile} setUserProfile={setUserProfile} onComplete={() => navigate(AppView.LANDING)} />;
      case AppView.MATCHING:
        return <MatchingPage onMatchFound={() => navigate(AppView.MATCH_FOUND)} />;
      case AppView.MATCH_FOUND:
        return <MatchFoundPage onJoin={() => navigate(AppView.LIVE_SESSION)} />;
      case AppView.LIVE_SESSION:
        return <LiveSession skill={userProfile.learning[0] || 'Python'} onEnd={() => navigate(AppView.FEEDBACK)} />;
      case AppView.FEEDBACK:
        return <FeedbackPage userProfile={userProfile} setUserProfile={setUserProfile} onFinish={() => navigate(AppView.LANDING)} />;
      case AppView.MARKETPLACE:
        return <MarketplacePage onNavigate={navigate} onStartMatch={() => navigate(session ? AppView.MATCHING : AppView.AUTH)} />;
      case AppView.COMMUNITY:
        return <CommunityPage onNavigate={navigate} />;
      case AppView.LEADERBOARD:
        return <LeaderboardPage onNavigate={navigate} />;
      case AppView.INQUIRY:
        return <InquiryPage onBack={() => navigate(AppView.LANDING)} />;
      default:
        return <LandingPage onNavigate={navigate} onStart={() => navigate(AppView.MATCHING)} userProfile={session ? userProfile : undefined} onPurchase={handlePurchaseTokens} />;
    }
  };

  return <div className="min-h-screen bg-background-dark text-white bg-mesh">{renderCurrentView()}</div>;
};

export default App;