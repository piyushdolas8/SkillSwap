import React, { useState, useMemo, useRef } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';

interface Props {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onComplete: () => void;
}

const PREDEFINED_SKILLS = [
  { name: 'Python', category: 'Tech & Dev' },
  { name: 'JavaScript (React, Angular, Vue)', category: 'Tech & Dev' },
  { name: 'Java', category: 'Tech & Dev' },
  { name: 'SQL (MySQL, PostgreSQL)', category: 'Tech & Dev' },
  { name: 'HTML/CSS', category: 'Tech & Dev' },
  { name: 'Graphic Design (Photoshop)', category: 'Creative & Design' },
  { name: 'UI/UX Design', category: 'Creative & Design' },
  { name: 'Project Management', category: 'Professional & Business' },
  { name: 'Digital Marketing', category: 'Professional & Business' },
];

const ProfileSetup: React.FC<Props> = ({ userProfile, setUserProfile, onComplete }) => {
  const [skillInput, setSkillInput] = useState('');
  const [learningInput, setLearningInput] = useState('');
  const [showTeachingSuggestions, setShowTeachingSuggestions] = useState(false);
  const [showLearningSuggestions, setShowLearningSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Local draft state to prevent "vanishing" UI during async jumps
  const [avatarDraftUrl, setAvatarDraftUrl] = useState<string>(userProfile.avatarUrl || '');

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediate preview for better UX
    const localPreview = URL.createObjectURL(file);
    setAvatarDraftUrl(localPreview);
    setIsUploading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session found");

      const userId = session.user.id;
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `public/${userId}/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // 3. Persist immediately to database so re-fetches don't wipe it
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);

      // 4. Sync states
      setAvatarDraftUrl(publicUrl);
      setUserProfile(prev => ({ ...prev, avatarUrl: publicUrl }));
      
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert("Error uploading image: " + err.message);
      setAvatarDraftUrl(userProfile.avatarUrl || ''); // Revert on error
    } finally {
      setIsUploading(false);
    }
  };

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
      if (suggestions[selectedIndex]) addSkill(suggestions[selectedIndex].name, type);
    }
  };

  const handleSaveAndComplete = async () => {
    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No active session");

      const userId = session.user.id;
      
      // Update the main profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name: userProfile.name || session.user.email?.split('@')[0],
          full_name: userProfile.fullName,
          email: session.user.email,
          tokens: userProfile.tokens || 5,
          avatar_url: avatarDraftUrl, // Use the most recent URL (draft or public)
          bio: userProfile.bio
        });

      if (profileError) throw profileError;

      // Update skills in separate table
      await supabase.from('skills').delete().eq('user_id', userId);
      const skillsToInsert = [
        ...userProfile.teaching.map(s => ({ user_id: userId, skill_name: s, type: 'teaching' })),
        ...userProfile.learning.map(s => ({ user_id: userId, skill_name: s, type: 'learning' }))
      ];
      if (skillsToInsert.length > 0) {
        await supabase.from('skills').insert(skillsToInsert);
      }

      // Important: Sync the final state back to App.tsx before completing
      setUserProfile(prev => ({ ...prev, avatarUrl: avatarDraftUrl }));
      onComplete();
    } catch (err: any) {
      console.error("Save error:", err);
      alert("Failed to save: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark font-display">
      <header className="flex items-center justify-between border-b border-white/5 px-10 py-4 sticky top-0 bg-background-dark/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-4">
          <div className="size-8 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path></svg>
          </div>
          <h2 className="text-white text-2xl font-bold tracking-tight">SkillSwap</h2>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto px-6 py-12">
        <div className="mb-12 text-center">
          <h1 className="text-white text-5xl font-black mb-4 uppercase tracking-tighter">Your Expert Identity</h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium">Build your profile and start trading expertise.</p>
        </div>

        <div className="bg-card-dark border border-border-dark rounded-[2.5rem] p-10 mb-8 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row gap-10 items-start">
            <div className="relative group self-center md:self-start">
              <div 
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="size-40 rounded-[2rem] bg-black/40 border-2 border-dashed border-white/10 flex items-center justify-center cursor-pointer hover:border-primary transition-all overflow-hidden relative shadow-glow-primary"
              >
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <div className="size-8 border-2 border-primary border-t-transparent animate-spin rounded-full mb-2"></div>
                    <p className="text-[10px] font-black text-primary uppercase">Syncing...</p>
                  </div>
                ) : avatarDraftUrl ? (
                  <img src={avatarDraftUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <span className="material-symbols-outlined text-slate-500 !text-4xl mb-2">add_a_photo</span>
                    <p className="text-[10px] font-black text-slate-500 uppercase">Upload Photo</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-primary/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                   <span className="material-symbols-outlined text-white">edit_square</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
            </div>

            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Display Name</label>
                <input 
                  type="text" 
                  value={userProfile.name}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Username"
                  className="w-full bg-background-dark border border-white/5 rounded-xl text-white px-4 py-3 outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Full Legal Name</label>
                <input 
                  type="text" 
                  value={userProfile.fullName}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="Your Name"
                  className="w-full bg-background-dark border border-white/5 rounded-xl text-white px-4 py-3 outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="space-1 md:col-span-2">
                <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Bio</label>
                <textarea 
                  value={userProfile.bio}
                  onChange={(e) => setUserProfile(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us what you're passionate about..."
                  className="w-full bg-background-dark border border-white/5 rounded-xl text-white px-4 py-3 outline-none h-20 resize-none focus:border-primary transition-colors"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-card-dark border border-border-dark rounded-2xl p-8 shadow-xl">
            <h2 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">school</span>
              Skills I can teach
            </h2>
            <div className="relative mb-6">
              <input 
                type="text" 
                value={skillInput}
                onFocus={() => setShowTeachingSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTeachingSuggestions(false), 200)}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'teaching')}
                placeholder="Search techniques..."
                className="w-full bg-background-dark border border-border-dark rounded-xl text-white px-5 py-3 outline-none focus:border-primary"
              />
              {showTeachingSuggestions && teachingSuggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-2 bg-[#1b1d27] border border-border-dark rounded-xl z-20 max-h-60 overflow-y-auto shadow-2xl">
                  {teachingSuggestions.map((s, idx) => (
                    <button key={s.name} onClick={() => addSkill(s.name, 'teaching')} className={`w-full text-left px-5 py-3 text-sm border-b border-white/5 ${selectedIndex === idx ? 'bg-primary text-white' : 'text-slate-300'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {userProfile.teaching.map(skill => (
                <div key={skill} className="flex items-center gap-2 bg-primary text-white px-3 py-1.5 rounded-lg animate-in fade-in zoom-in-95">
                  <span className="text-sm font-bold">{skill}</span>
                  <button onClick={() => removeSkill(skill, 'teaching')} className="material-symbols-outlined text-sm">close</button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card-dark border border-border-dark rounded-2xl p-8 shadow-xl">
            <h2 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-500">auto_stories</span>
              Skills I want to learn
            </h2>
            <div className="relative mb-6">
              <input 
                type="text" 
                value={learningInput}
                onFocus={() => setShowLearningSuggestions(true)}
                onBlur={() => setTimeout(() => setShowLearningSuggestions(false), 200)}
                onChange={(e) => setLearningInput(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'learning')}
                placeholder="Search goals..."
                className="w-full bg-background-dark border border-border-dark rounded-xl text-white px-5 py-3 outline-none focus:border-primary"
              />
              {showLearningSuggestions && learningSuggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-2 bg-[#1b1d27] border border-border-dark rounded-xl z-20 max-h-60 overflow-y-auto shadow-2xl">
                  {learningSuggestions.map((s, idx) => (
                    <button key={s.name} onClick={() => addSkill(s.name, 'learning')} className={`w-full text-left px-5 py-3 text-sm border-b border-white/5 ${selectedIndex === idx ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 min-h-[40px]">
              {userProfile.learning.map(skill => (
                <div key={skill} className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg animate-in fade-in zoom-in-95">
                  <span className="text-sm font-bold">{skill}</span>
                  <button onClick={() => removeSkill(skill, 'learning')} className="material-symbols-outlined text-sm">close</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex justify-center">
          <button 
            onClick={handleSaveAndComplete}
            disabled={userProfile.teaching.length === 0 || userProfile.learning.length === 0 || !userProfile.name || isSaving || isUploading}
            className="bg-primary text-white font-black px-12 py-4 rounded-2xl shadow-glow-primary uppercase tracking-widest disabled:opacity-30 transition-all hover:scale-105 active:scale-95"
          >
            {isSaving ? 'Finalizing Profile...' : 'Confirm My Identity'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default ProfileSetup;