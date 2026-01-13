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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isProfileFetching, setIsProfileFetching] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  
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
    console.log(`Navigating to: ${view}`);
    setCurrentView(view);
    window.scrollTo(0, 0);
  }, []);

  const fetchProfile = async (userId: string) => {
    if (isProfileFetching) return;
    setIsProfileFetching(true);
    try {
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
      
      if (profileError || !profileData) {
        // Logged in but no profile record - needs setup
        navigate(AppView.PROFILE_SETUP);
        return;
      }

      const { data: skillsData } = await supabase.from('skills').select('skill_name, type').eq('user_id', userId);

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
      console.warn("Profile fetch error:", e);
    } finally {
      setIsProfileFetching(false);
    }
  };

  // Centralized "Start" action
  const handleStartAction = useCallback(() => {
    if (!session && !isDemoMode) {
      navigate(AppView.AUTH);
    } else if (userProfile.teaching.length === 0 || userProfile.learning.length === 0) {
      navigate(AppView.PROFILE_SETUP);
    } else {
      navigate(AppView.MATCHING);
    }
  }, [session, isDemoMode, userProfile, navigate]);

  const handleDemoMode = useCallback(() => {
    setIsDemoMode(true);
    setIsInitialLoading(false);
    
    const mockUser = {
      name: 'Guest Expert',
      fullName: 'Demo Account',
      email: 'guest@skillswap.io',
      teaching: ['React', 'TypeScript'],
      learning: ['Python'],
      bio: 'Guest expert testing the system.',
      tokens: 10,
      portfolio: [],
      level: 1, xp: 120, streak: 3
    };
    setUserProfile(mockUser);
    setSession({ user: { id: 'demo-id' } });
    navigate(AppView.LANDING);
  }, [navigate]);

  useEffect(() => {
    let mounted = true;

    const initApp = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(existingSession);
          setIsInitialLoading(false);
          if (existingSession) {
            await fetchProfile(existingSession.user.id);
          }
        }
      } catch (err) {
        if (mounted) setIsInitialLoading(false);
      }
    };

    initApp();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      
      console.log(`Auth event: ${event}`);
      setSession(newSession);
      
      if (newSession) {
        fetchProfile(newSession.user.id);
        // Reactive navigation away from Auth view
        if (currentView === AppView.AUTH) {
          navigate(AppView.LANDING);
        }
      } else if (event === 'SIGNED_OUT') {
        setIsDemoMode(false);
        setUserProfile({ name: '', fullName: '', email: '', teaching: [], learning: [], bio: '', tokens: 5, portfolio: [], level: 1, xp: 0, streak: 0 });
        navigate(AppView.LANDING);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [currentView, navigate]);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080910]">
        <div className="loader-ring mb-4"></div>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Initializing SkillSwap...</p>
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
        return <FeedbackPage userProfile={userProfile} setUserProfile={setUserProfile} onFinish={() => navigate(AppView.LANDING)} />;
      case AppView.MARKETPLACE:
        return <MarketplacePage onNavigate={navigate} onStartMatch={handleStartAction} />;
      case AppView.COMMUNITY:
        return <CommunityPage onNavigate={navigate} />;
      case AppView.LEADERBOARD:
        return <LeaderboardPage onNavigate={navigate} />;
      case AppView.INQUIRY:
        return <InquiryPage onBack={() => navigate(AppView.LANDING)} />;
      default:
        return <LandingPage onNavigate={navigate} userProfile={session ? userProfile : undefined} onStart={handleStartAction} onPurchase={handlePurchaseTokens} />;
    }
  };

  return <div className="min-h-screen bg-background-dark text-white bg-mesh">{renderCurrentView()}</div>;
};

export default App;