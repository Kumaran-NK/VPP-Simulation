'use client';

import React from 'react';

export default function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[10px] text-slate-600">
        <span>⚡</span>
        <span className="font-medium text-slate-500">VPP SIMULATOR</span>
        <span className="text-slate-700">·</span>
        <span>Clean Energy</span>
        <span className="text-slate-700">·</span>
        <span>Smarter Grids</span>
        <span className="text-slate-700">·</span>
        <span>AI Control</span>
      </div>
      <div className="text-[10px] text-slate-600">
        Powered by Reinforcement Learning
      </div>
    </footer>
  );
}
