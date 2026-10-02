import re

with open('src/pages/CompleteProfilePage.tsx', 'r') as f:
    content = f.read()

replacements = [
    (r'min-h-screen bg-slate-900 text-slate-100', r'min-h-screen bg-gray-50 text-gray-900'),
    (r'border-b border-slate-800', r'border-b border-gray-200'),
    (r'text-xl font-bold text-white', r'text-xl font-bold text-gray-900'),
    (r'text-xs text-slate-400', r'text-xs text-gray-500'),
    (r'text-sm text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border-slate-700/60', r'text-sm text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 border-gray-200'),
    (r'text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-3\.5 py-2 rounded-lg border border-slate-700/60', r'text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 px-3.5 py-2 rounded-lg border border-gray-200'),
    (r'bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/30 rounded-2xl p-6 mb-8 shadow-xl', r'bg-white border border-gray-200 rounded-2xl p-6 mb-8 shadow-sm'),
    (r'text-blue-400', r'text-blue-600'),
    (r'bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400', r'bg-blue-50 border border-blue-100 rounded-xl text-blue-600'),
    (r'text-slate-300 text-sm', r'text-gray-600 text-sm'),
    (r'text-white', r'text-gray-900'), # This one is tricky, let's be careful. Let's do specific ones instead.
]

content = content.replace('min-h-screen bg-slate-900 text-slate-100', 'min-h-screen bg-gray-50 text-gray-900')
content = content.replace('border-b border-slate-800', 'border-b border-gray-200')
content = content.replace('text-xl font-bold text-white', 'text-xl font-bold text-gray-900')
content = content.replace('text-xs text-slate-400', 'text-xs text-gray-500')
content = content.replace('text-sm text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 px-3.5 py-2 rounded-lg border border-slate-700/60', 'text-sm text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-50 px-3.5 py-2 rounded-lg border border-gray-200')
content = content.replace('bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border border-blue-500/30 rounded-2xl p-6 mb-8 shadow-xl', 'bg-blue-50/50 border border-blue-100 rounded-2xl p-6 mb-8 shadow-sm')
content = content.replace('Sparkles className="w-32 h-32 text-blue-400"', 'Sparkles className="w-32 h-32 text-blue-100"')
content = content.replace('bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-400', 'bg-white border border-blue-200 rounded-xl text-blue-600')
content = content.replace('text-xl font-bold text-white mb-1', 'text-xl font-bold text-gray-900 mb-1')
content = content.replace('text-slate-300 text-sm leading-relaxed max-w-2xl', 'text-gray-600 text-sm leading-relaxed max-w-2xl')
content = content.replace('<strong className="text-white">', '<strong className="text-gray-900">')
content = content.replace('bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 sm:p-7 shadow-lg backdrop-blur-sm', 'bg-white border border-gray-200 rounded-2xl p-6 sm:p-7 shadow-sm')
content = content.replace('border-b border-slate-700/50', 'border-b border-gray-100')
content = content.replace('Building2 className="w-5 h-5 text-blue-400"', 'Building2 className="w-5 h-5 text-blue-600"')
content = content.replace('Briefcase className="w-5 h-5 text-indigo-400"', 'Briefcase className="w-5 h-5 text-indigo-600"')
content = content.replace('Clock className="w-5 h-5 text-emerald-400"', 'Clock className="w-5 h-5 text-emerald-600"')
content = content.replace('text-lg font-semibold text-white', 'text-lg font-semibold text-gray-900')
content = content.replace('text-sm font-medium text-slate-300 mb-2', 'text-sm font-medium text-gray-700 mb-2')
content = content.replace('bg-slate-900/90 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500', 'bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm')
content = content.replace('pointer-events-none text-slate-500', 'pointer-events-none text-gray-400')
content = content.replace('bg-slate-900/90 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-slate-500', 'bg-white border border-gray-300 rounded-lg pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 shadow-sm')
content = content.replace('text-xs text-slate-400 ml-2 font-normal', 'text-xs text-gray-500 ml-2 font-normal')
content = content.replace('bg-slate-900/90 border border-slate-700 rounded-lg px-4 py-2.5 text-white', 'bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 shadow-sm')

with open('src/pages/CompleteProfilePage.tsx', 'w') as f:
    f.write(content)
