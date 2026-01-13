
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';

interface Props {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onComplete: () => void;
}

const PREDEFINED_SKILLS = [
  // Tech & Dev
  { name: 'Python', category: 'Tech & Dev' },
  { name: 'JavaScript (React, Angular, Vue)', category: 'Tech & Dev' },
  { name: 'Java', category: 'Tech & Dev' },
  { name: 'SQL (MySQL, PostgreSQL)', category: 'Tech & Dev' },
  { name: 'HTML/CSS', category: 'Tech & Dev' },
  { name: 'Machine Learning', category: 'Tech & Dev' },
  { name: 'Data Analysis', category: 'Tech & Dev' },
  { name: 'AWS/GCP/Azure', category: 'Tech & Dev' },
  { name: 'Git/GitHub', category: 'Tech & Dev' },
  { name: 'Docker', category: 'Tech & Dev' },
  { name: 'APIs', category: 'Tech & Dev' },
  { name: 'Node.js', category: 'Tech & Dev' },
  { name: 'C++', category: 'Tech & Dev' },
  { name: 'PHP', category: 'Tech & Dev' },
  { name: 'Ruby', category: 'Tech & Dev' },
  { name: 'NoSQL', category: 'Tech & Dev' },
  { name: 'Tableau/Power BI', category: 'Tech & Dev' },
  { name: 'Cybersecurity', category: 'Tech & Dev' },
  { name: 'Blockchain', category: 'Tech & Dev' },
  { name: 'Unity (Game Dev)', category: 'Tech & Dev' },
  { name: 'Android (Kotlin)', category: 'Tech & Dev' },
  { name: 'iOS (Swift)', category: 'Tech & Dev' },
  { name: 'Selenium (Testing)', category: 'Tech & Dev' },
  { name: 'Hadoop/Spark', category: 'Tech & Dev' },
  { name: 'NLP', category: 'Tech & Dev' },

  // Creative & Design
  { name: 'Graphic Design (Photoshop)', category: 'Creative & Design' },
  { name: 'UI/UX Design', category: 'Creative & Design' },
  { name: 'Video Editing (Premiere Pro)', category: 'Creative & Design' },
  { name: '3D Modeling (Blender)', category: 'Creative & Design' },
  { name: 'Copywriting', category: 'Creative & Design' },
  { name: 'Photography', category: 'Creative & Design' },
  { name: 'Animation', category: 'Creative & Design' },
  { name: 'Illustrator', category: 'Creative & Design' },
  { name: 'Motion Graphics', category: 'Creative & Design' },
  { name: 'Content Creation', category: 'Creative & Design' },
  { name: 'Blogging', category: 'Creative & Design' },
  { name: 'Podcasting', category: 'Creative & Design' },
  { name: 'Digital Art', category: 'Creative & Design' },
  { name: 'SEO', category: 'Creative & Design' },
  { name: 'Social Media Design', category: 'Creative & Design' },

  // Professional & Business
  { name: 'Project Management (Agile/Scrum)', category: 'Professional & Business' },
  { name: 'Digital Marketing', category: 'Professional & Business' },
  { name: 'SEO/SEM', category: 'Professional & Business' },
  { name: 'Google Analytics', category: 'Professional & Business' },
  { name: 'CRM (Salesforce, HubSpot)', category: 'Professional & Business' },
  { name: 'Financial Analysis', category: 'Professional & Business' },
  { name: 'Negotiation', category: 'Professional & Business' },
  { name: 'Public Speaking', category: 'Professional & Business' },
  { name: 'Leadership', category: 'Professional & Business' },
  { name: 'Time Management', category: 'Professional & Business' },
  { name: 'Excel/Google Sheets', category: 'Professional & Business' },
  { name: 'PowerPoint/Google Slides', category: 'Professional & Business' },
  { name: 'Market Research', category: 'Professional & Business' },
  { name: 'Email Marketing (Mailchimp)', category: 'Professional & Business' },
  { name: 'A/B Testing', category: 'Professional & Business' },
  { name: 'Customer Service', category: 'Professional & Business' },
  { name: 'Sales (Lead Generation)', category: 'Professional & Business' },
  { name: 'HR Recruiting', category: 'Professional & Business' },
  { name: 'Event Planning', category: 'Professional & Business' },
  { name: 'Foreign Languages', category: 'Professional & Business' },

  // Soft & Life Skills
  { name: 'Communication', category: 'Soft & Life Skills' },
  { name: 'Problem-Solving', category: 'Soft & Life Skills' },
  { name: 'Teamwork', category: 'Soft & Life Skills' },
  { name: 'Critical Thinking', category: 'Soft & Life Skills' },
  { name: 'Adaptability', category: 'Soft & Life Skills' },
  { name: 'Emotional Intelligence', category: 'Soft & Life Skills' },
  { name: 'Conflict Resolution', category: 'Soft & Life Skills' },
  { name: 'Active Listening', category: 'Soft & Life Skills' },
  { name: 'Multitasking', category: 'Soft & Life Skills' },
  { name: 'Organization', category: 'Soft & Life Skills' },
  { name: 'Creativity', category: 'Soft & Life Skills' },
  { name: 'Empathy', category: 'Soft & Life Skills' },
  { name: 'Networking', category: 'Soft & Life Skills' },
  { name: 'Yoga/Fitness Training', category: 'Soft & Life Skills' },
  { name: 'Cooking', category: 'Soft & Life Skills' },
];

const ProfileSetup: React.FC<Props> = ({ userProfile, setUserProfile, onComplete }) => {
  const [skillInput, setSkillInput] = useState('');
  const [learningInput, setLearningInput] = useState('');
  const [showTeachingSuggestions, setShowTeachingSuggestions] = useState(false);
  const [showLearningSuggestions, setShowLearningSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);

  const filterSkills = (input: string, currentList: string[]) => {
    if (!input) return [];
    const search = input.toLowerCase();
    return PREDEFINED_SKILLS.filter(s => 
      (s.name.toLowerCase().includes(search) || s.category.toLowerCase().includes(search)) && 
      !currentList.includes(s.name)
    );
  };

  const teachingSuggestions = useMemo(() => filterSkills(skillInput, userProfile.teaching), [skillInput, userProfile.teaching]);
  const learningSuggestions = useMemo(() => filterSkills(learningInput, userProfile.learning), [learningInput, userProfile.learning]);

  const addSkill = (skill: string, type: 'teaching' | 'learning') => {
    const key = type === 'teaching' ? 'teaching' : 'learning';
    if (skill.trim() && !userProfile[key].includes(skill)) {
      setUserProfile(prev => ({ ...prev, [key]: [...prev[key], skill] }));
      if (type === 'teaching') {
        setSkillInput('');
        setShowTeachingSuggestions(false);
      } else {
        setLearningInput('');
        setShowLearningSuggestions(false);
      }
      setSelectedIndex(0);
    }
  };

  const removeSkill = (skill: string, type: 'teaching' | 'learning') => {
    const key = type === 'teaching' ? 'teaching' : 'learning';
    setUserProfile(prev => ({ ...prev, [key]: prev[key].filter(s => s !== skill) }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: 'teaching' | 'learning') => {
    const suggestions = type === 'teaching' ? teachingSuggestions : learningSuggestions;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[selectedIndex]) {
        addSkill(suggestions[selectedIndex].name, type);
      }
    } else if (e.key === 'Escape') {
      if (type === 'teaching') setShowTeachingSuggestions(false);
      else setShowLearningSuggestions(false);
    }
  };

  // Ensure selected suggestion is in view when using keyboard
  useEffect(() => {
    if (suggestionContainerRef.current) {
      const selectedElement = suggestionContainerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUserProfile(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAndComplete = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session. Please log in again.");

      const userId = session.user.id;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name: userProfile.name || session.user.email?.split('@')[0],
          full_name: userProfile.fullName,
          email: session.user.email,
          tokens: userProfile.tokens || 5,
          github_url: userProfile.githubUrl,
          linkedin_url: userProfile.linkedinUrl,
          avatar_url: userProfile.avatarUrl,
          birthday: userProfile.birthday || null,
          bio: userProfile.bio
        }, { onConflict: 'id' });

      if (profileError) throw profileError;

      await supabase.from('skills').delete().eq('user_id', userId);
      const skillsToInsert = [
        ...userProfile.teaching.map(s => ({ user_id: userId, skill_name: s, type: 'teaching' })),
        ...userProfile.learning.map(s => ({ user_id: userId, skill_name: s, type: 'learning' }))
      ];

      if (skillsToInsert.length > 0) {
        const { error: skillsError } = await supabase.from('skills').insert(skillsToInsert);
        if (skillsError) throw skillsError;
      }

      onComplete();
    } catch (err: any) {
      console.error("Error saving profile:", err.message || err);
      alert(`Failed to save profile: ${err.message || 'Check database tables'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark font-display">
      <header className="flex items-center justify-between border-b border-white/5 px-10 py-4 sticky top-0 bg-background-dark/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <div className="size-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
          </div>
          <h2 className="text-white text-2xl font-bold tracking-tight">SkillSwap</h2>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto px-6 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-white text-5xl font-black mb-4 uppercase tracking-tighter">Your Expert Identity</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium">
            Setup your teaching profile to start earning SkillTokens.
          </p>
        </div>

        {/* Profile Picture & Basic Info */}
        <div className="bg-card-dark border border-border-dark rounded-[2.5rem] p-10 mb-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row gap-10 items-start">
            <div className="relative group self-center md:self-start">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="size-40 rounded-[2rem] bg-black/40 border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-primary transition-all overflow-hidden relative shadow-glow-primary"
              >
                {userProfile.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <span className="material-symbols-outlined text-slate-500 !text-4xl mb-2">add_a_photo</span>
                    <p className="text-[10px] font-black text-slate-500 uppercase">Upload Photo</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                   <span className="material-symbols-outlined text-white">edit</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </div>

            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Display Name (Visible to peers)</label>
                <input 
                  type="text" 
                  value={userProfile.name}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. CodeGuru88"
                  className="w-full bg-background-dark border border-white/5 rounded-xl text-white focus:ring-1 focus:ring-primary px-4 py-3 outline-none transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Full Legal Name</label>
                <input 
                  type="text" 
                  value={userProfile.fullName}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-background-dark border border-white/5 rounded-xl text-white focus:ring-1 focus:ring-primary px-4 py-3 outline-none transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Birthday</label>
                <input 
                  type="date" 
                  value={userProfile.birthday}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, birthday: e.target.value }))}
                  className="w-full bg-background-dark border border-white/5 rounded-xl text-white focus:ring-1 focus:ring-primary px-4 py-3 outline-none transition-all font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Expert Bio</label>
                <textarea 
                  value={userProfile.bio}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about your mastery..."
                  className="w-full bg-background-dark border border-white/5 rounded-xl text-white focus:ring-1 focus:ring-primary px-4 py-3 outline-none transition-all font-medium h-[46px] resize-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <span className="material-symbols-outlined !text-xs">link</span> Github Profile
              </label>
              <input 
                type="url" 
                value={userProfile.githubUrl}
                onChange={(e) => setUserProfile(prev => ({ ...prev, githubUrl: e.target.value }))}
                placeholder="https://github.com/alexrivera"
                className="w-full bg-background-dark border border-white/5 rounded-xl text-white focus:ring-1 focus:ring-primary px-4 py-3 outline-none transition-all font-medium text-xs"
              />
            </div>
            <div className="space-y-2">
              <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                <span className="material-symbols-outlined !text-xs">share</span> LinkedIn Profile
              </label>
              <input 
                type="url" 
                value={userProfile.linkedinUrl}
                onChange={(e) => setUserProfile(prev => ({ ...prev, linkedinUrl: e.target.value }))}
                placeholder="https://linkedin.com/in/alexrivera"
                className="w-full bg-background-dark border border-white/5 rounded-xl text-white focus:ring-1 focus:ring-primary px-4 py-3 outline-none transition-all font-medium text-xs"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Teaching Section */}
          <div className="bg-card-dark border border-border-dark rounded-2xl p-8 relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-primary/10 p-3 rounded-xl text-primary">
                <span className="material-symbols-outlined">school</span>
              </div>
              <div>
                <h2 className="text-white text-xl font-bold">Skills I can teach</h2>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Share your expertise</p>
              </div>
            </div>
            
            <div className="relative mb-6">
              <input 
                type="text" 
                value={skillInput}
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={showTeachingSuggestions && teachingSuggestions.length > 0}
                onFocus={() => { setShowTeachingSuggestions(true); setSelectedIndex(0); }}
                onBlur={() => setTimeout(() => setShowTeachingSuggestions(false), 200)}
                onChange={(e) => { setSkillInput(e.target.value); setSelectedIndex(0); }}
                onKeyDown={(e) => handleKeyDown(e, 'teaching')}
                placeholder="Search skills (Use arrow keys)..."
                className="w-full bg-background-dark border border-border-dark rounded-xl text-white focus:ring-2 focus:ring-primary focus:border-transparent px-5 py-3 outline-none transition-all placeholder:text-slate-600"
              />
              {showTeachingSuggestions && teachingSuggestions.length > 0 && (
                <div 
                  ref={suggestionContainerRef}
                  className="absolute top-full left-0 w-full mt-2 bg-[#1b1d27] border border-border-dark rounded-xl shadow-2xl z-20 max-h-64 overflow-y-auto custom-scrollbar"
                >
                  {teachingSuggestions.map((s, idx) => (
                    <button 
                      key={s.name} 
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => addSkill(s.name, 'teaching')}
                      className={`w-full flex items-center justify-between px-5 py-3 text-left text-sm transition-colors border-b border-white/5 last:border-0 ${selectedIndex === idx ? 'bg-primary text-white' : 'text-slate-300 hover:bg-white/5'}`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${selectedIndex === idx ? 'bg-white/20' : 'bg-white/5 text-slate-500'}`}>{s.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 min-h-[100px] content-start">
              {userProfile.teaching.map(skill => (
                <div key={skill} className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg shadow-glow">
                  <span className="text-sm font-bold tracking-tight">{skill}</span>
                  <button onClick={() => removeSkill(skill, 'teaching')} className="material-symbols-outlined text-sm hover:opacity-70 transition-opacity">close</button>
                </div>
              ))}
            </div>
          </div>

          {/* Learning Section */}
          <div className="bg-card-dark border border-border-dark rounded-2xl p-8 relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-500">
                <span className="material-symbols-outlined">auto_awesome</span>
              </div>
              <div>
                <h2 className="text-white text-xl font-bold">Skills I want to learn</h2>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Master something new</p>
              </div>
            </div>

            <div className="relative mb-6">
              <input 
                type="text" 
                value={learningInput}
                autoComplete="off"
                onFocus={() => { setShowLearningSuggestions(true); setSelectedIndex(0); }}
                onBlur={() => setTimeout(() => setShowLearningSuggestions(false), 200)}
                onChange={(e) => { setLearningInput(e.target.value); setSelectedIndex(0); }}
                onKeyDown={(e) => handleKeyDown(e, 'learning')}
                placeholder="Search skills (Use arrow keys)..."
                className="w-full bg-background-dark border border-border-dark rounded-xl text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent px-5 py-3 outline-none transition-all placeholder:text-slate-600"
              />
              {showLearningSuggestions && learningSuggestions.length > 0 && (
                <div 
                  className="absolute top-full left-0 w-full mt-2 bg-[#1b1d27] border border-border-dark rounded-xl shadow-2xl z-20 max-h-64 overflow-y-auto custom-scrollbar"
                >
                  {learningSuggestions.map((s, idx) => (
                    <button 
                      key={s.name} 
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => addSkill(s.name, 'learning')}
                      className={`w-full flex items-center justify-between px-5 py-3 text-left text-sm transition-colors border-b border-white/5 last:border-0 ${selectedIndex === idx ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${selectedIndex === idx ? 'bg-white/20' : 'bg-white/5 text-slate-500'}`}>{s.category}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 min-h-[100px] content-start">
              {userProfile.learning.map(skill => (
                <div key={skill} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg">
                  <span className="text-sm font-bold tracking-tight">{skill}</span>
                  <button onClick={() => removeSkill(skill, 'learning')} className="material-symbols-outlined text-sm hover:opacity-70 transition-opacity">close</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <button 
            onClick={handleSaveAndComplete}
            disabled={userProfile.teaching.length === 0 || userProfile.learning.length === 0 || !userProfile.name || isSaving}
            className="group relative flex items-center gap-3 bg-primary text-white font-black px-12 py-4 rounded-2xl shadow-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none text-lg uppercase tracking-widest overflow-hidden"
          >
            <span className="relative z-10">{isSaving ? 'Initializing Swap Network...' : 'Confirm Profile'}</span>
            {!isSaving && <span className="material-symbols-outlined relative z-10 group-hover:translate-x-1 transition-transform">rocket_launch</span>}
          </button>
        </div>
      </main>
    </div>
  );
};

export default ProfileSetup;
