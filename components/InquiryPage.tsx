
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface Props {
  onBack: () => void;
}

const InquiryPage: React.FC<Props> = ({ onBack }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry',
    message: ''
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error: submitError } = await supabase
        .from('inquiries')
        .insert({
          ...formData,
          user_id: session?.user?.id || null
        });

      if (submitError) throw submitError;

      setIsSuccess(true);
      setFormData({ name: '', email: '', subject: 'General Inquiry', message: '' });
    } catch (err: any) {
      console.error("Submission error:", err);
      setError(err.message || "Failed to send inquiry. Please check your network connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="min-h-screen flex flex-col font-display bg-background-dark">
      <header className="flex items-center justify-between border-b border-solid border-white/5 px-6 md:px-10 py-4 sticky top-0 bg-background-dark/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={onBack}>
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M24 0.757355L47.2426 24L24 47.2426L0.757355 24L24 0.757355ZM21 35.7574V12.2426L9.24264 24L21 35.7574Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
          </div>
          <h2 className="text-white text-lg font-bold tracking-tight">SkillSwap Support</h2>
        </div>
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
          <span className="material-symbols-outlined text-sm">close</span>
          Back to Home
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 bg-mesh">
        <div className="w-full max-w-[640px] bg-[#161a2d] rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          {isSuccess ? (
            <div className="py-20 px-10 text-center">
              <div className="size-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-6">
                <span className="material-symbols-outlined !text-4xl animate-bounce">check_circle</span>
              </div>
              <h1 className="text-white text-4xl font-black mb-4 uppercase tracking-tighter">Inquiry Received</h1>
              <p className="text-slate-400 font-medium mb-10 max-w-sm mx-auto">
                Thank you for reaching out. Our support team will review your inquiry and get back to you within 24-48 hours.
              </p>
              <button 
                onClick={onBack}
                className="bg-primary text-white font-black px-10 py-4 rounded-xl uppercase tracking-widest shadow-glow hover:scale-105 transition-all"
              >
                Return Home
              </button>
            </div>
          ) : (
            <>
              <div className="pt-12 pb-6 px-10 text-center">
                <h1 className="text-white tracking-tighter text-4xl font-black mb-2 uppercase">Get in Touch</h1>
                <p className="text-slate-500 font-medium">
                  Have questions about SkillSwap? Our network administrators are here to help.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="px-10 pb-12 space-y-6">
                {error && (
                  <div className="bg-red-500/10 text-red-500 border border-red-500/20 p-4 rounded-xl text-xs font-bold text-center">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Full Name</label>
                    <input 
                      className="w-full rounded-xl border border-white/5 bg-black/20 focus:border-primary focus:ring-1 focus:ring-primary h-12 px-4 text-white placeholder:text-slate-700 text-sm font-medium transition-all outline-none" 
                      placeholder="Alex Rivera" 
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Email Address</label>
                    <input 
                      className="w-full rounded-xl border border-white/5 bg-black/20 focus:border-primary focus:ring-1 focus:ring-primary h-12 px-4 text-white placeholder:text-slate-700 text-sm font-medium transition-all outline-none" 
                      placeholder="alex@example.com" 
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Subject</label>
                  <select 
                    className="w-full rounded-xl border border-white/5 bg-black/20 focus:border-primary focus:ring-1 focus:ring-primary h-12 px-4 text-white text-sm font-medium transition-all outline-none"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Billing">Billing / SkillTokens</option>
                    <option value="Abuse Report">Abuse Report</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] ml-1">Your Message</label>
                  <textarea 
                    className="w-full rounded-xl border border-white/5 bg-black/20 focus:border-primary focus:ring-1 focus:ring-primary min-h-[150px] p-4 text-white placeholder:text-slate-700 text-sm font-medium transition-all outline-none resize-none" 
                    placeholder="How can we help you level up today?" 
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required 
                  />
                </div>

                <button 
                  className="w-full flex items-center justify-center rounded-xl h-14 bg-primary text-white text-sm font-black uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all shadow-glow mt-4 disabled:opacity-50" 
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Transmitting...' : 'Dispatch Inquiry'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="py-10 text-center opacity-30">
        <p className="text-slate-600 text-[9px] font-black uppercase tracking-[0.4em]">
          End-to-end encrypted inquiry system. SkillSwap Protocol v2.4
        </p>
      </footer>
    </div>
  );
};

export default InquiryPage;
