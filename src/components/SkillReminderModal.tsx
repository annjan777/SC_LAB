import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Award, ArrowRight, Clock, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SkillReminderModal() {
  const { user, skillStatus, dismissSkillReminder } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Do not show if:
  // - User not logged in
  // - Already on profile page looking at skills
  // - showPopup is false
  if (!user || !skillStatus?.showPopup) {
    return null;
  }

  // If the user is currently on the profile page focusing skills, hide the popup
  if (location.pathname === '/profile' && (location.search.includes('focus=skills') || location.hash === '#skills')) {
    return null;
  }

  const handleGoToSkills = () => {
    // Navigate to profile page focusing the skills section
    navigate('/profile?focus=skills#skills');
    dismissSkillReminder();
  };

  const handleSkip = async () => {
    await dismissSkillReminder();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-slate-800 transform transition-all">
        {/* Top decorative gradient bar */}
        <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition"
          aria-label="Close reminder"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-7">
          {/* Icon and Pill */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100/80 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                <Clock className="w-3 h-3" />
                14-Day Profile Check
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-slate-100 mt-1">
                Add Your Skills & Expertise
              </h2>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed mb-4">
            You haven’t added any skills to your profile yet. While skill entry is not mandatory to use the portal, keeping your skills updated is vital for the lab.
          </p>

          {/* Value props */}
          <div className="bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 mb-6 space-y-2 text-xs text-gray-700 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>Helps coordinators allocate matching projects and research duties</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>Showcases your software proficiencies and equipment certifications</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span>Enables seamless collaboration with fellow lab members</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleGoToSkills}
              className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 group"
            >
              <span>Add Skills in Profile</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={handleSkip}
              className="px-4 py-2.5 text-xs sm:text-sm font-medium text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Remind Me in 14 Days
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
