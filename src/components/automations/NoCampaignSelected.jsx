import { Link } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { primaryButton } from './styles';

// Admin automation pages work on the active campaign, like the rest of the admin panel
export const NoCampaignSelected = ({ title = 'Automations' }) => (
  <div className="min-h-screen w-full space-y-6 bg-[#0c0c0e] p-4 font-sans text-white antialiased lg:p-6">
    <h2 className="m-0 text-xl font-bold tracking-tight text-white">{title}</h2>
    <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7831d6]/20 text-[#c4b5fd]">
        <Bot className="h-6 w-6" />
      </span>
      <p className="m-0 text-base font-semibold text-white">No campaign workspace selected</p>
      <p className="m-0 max-w-sm text-xs text-zinc-400">Select a campaign to see and manage the automations on its accounts.</p>
      <Link to="/campaigns" className={`${primaryButton} mt-2 text-xs`}>Go to Campaign Selector</Link>
    </div>
  </div>
);
