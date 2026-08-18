import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

const sections = [
  {
    title: 'Use of EasyPost',
    body: 'You may use EasyPost to connect supported publishing channels, manage media assets, schedule content, view insights, and moderate comments. You are responsible for ensuring your use complies with applicable laws and platform policies.',
  },
  {
    title: 'Account Access',
    body: 'You are responsible for maintaining access to your Google account and connected publishing channels. Do not share credentials, tokens, or workspace access with unauthorized users.',
  },
  {
    title: 'Connected Social Platforms',
    body: 'Publishing, insights, feed, and comment features depend on third-party platform APIs. Meta, Instagram, Facebook, Google, and other providers may change permissions, limits, review requirements, or API availability.',
  },
  {
    title: 'Content Responsibility',
    body: 'You are responsible for all captions, media, comments, scheduled posts, and other content submitted through EasyPost. Do not upload or publish content that violates rights, laws, or platform rules.',
  },
  {
    title: 'Service Availability',
    body: 'EasyPost is provided as available. Scheduled publishing may be affected by internet connectivity, token expiry, platform API errors, invalid media formats, or service outages.',
  },
  {
    title: 'Limitation of Liability',
    body: 'To the maximum extent allowed by law, EasyPost is not liable for indirect losses, missed publishing times, platform restrictions, account actions, or business losses caused by use of the service.',
  },
];

export const TermsAndConditions = () => (
  <div className="h-screen overflow-y-auto bg-black text-white font-sans selection:bg-[#7831d6] selection:text-white">
    <header className="border-b border-white/10 bg-black/80 backdrop-blur-md px-5 py-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#c4b5fd] transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to EasyPost
        </Link>
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Sparkles className="h-4 w-4 text-[#c4b5fd]" />
          EasyPost
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Legal</p>
      <h1 className="m-0 mt-3 text-4xl font-black tracking-tight text-white">Terms and Conditions</h1>
      <p className="m-0 mt-3 text-sm text-zinc-400">Last updated: June 16, 2026</p>

      <div className="mt-8 rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
        <p className="m-0 text-base leading-7 text-zinc-300">
          These Terms and Conditions govern your use of EasyPost. By accessing the platform, you agree to use it responsibly and only with accounts and content you are authorized to manage.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-md">
            <h2 className="m-0 text-lg font-bold text-white">{section.title}</h2>
            <p className="m-0 mt-3 text-sm leading-7 text-zinc-400">{section.body}</p>
          </section>
        ))}
      </div>

      <p className="m-0 mt-8 text-sm leading-7 text-zinc-400">
        If you do not agree with these terms, do not use EasyPost or connect publishing channels to the workspace.
      </p>
      <p className="m-0 mt-4 text-xs text-zinc-500">
        This product is powered by{' '}
        <a href="https://thethousandways.com/" target="_blank" rel="noopener noreferrer" className="underline text-zinc-400 hover:text-white">
          thousandway to make
        </a>
      </p>
    </main>
  </div>
);

export default TermsAndConditions;
