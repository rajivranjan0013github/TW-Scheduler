import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

const sections = [
  {
    title: 'Use of ThousandPost',
    body: (
      <span>
        You may use ThousandPost to connect supported publishing channels, manage media assets, schedule content, view insights, and moderate comments. You are responsible for ensuring your use complies with applicable laws and third-party platform policies.
      </span>
    ),
  },
  {
    title: 'Account Access',
    body: (
      <span>
        You are responsible for maintaining access to your Google account and connected publishing channels. Do not share credentials, tokens, or workspace access with unauthorized users.
      </span>
    ),
  },
  {
    title: 'YouTube Terms of Service',
    body: (
      <span>
        ThousandPost integrates with YouTube API Services. By connecting a YouTube channel or using ThousandPost features that interact with YouTube, you agree to be bound by the{' '}
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 underline hover:text-red-300 font-medium"
        >
          YouTube Terms of Service (https://www.youtube.com/t/terms)
        </a>
        . Please review the YouTube Terms of Service carefully before connecting your channel.
      </span>
    ),
  },
  {
    title: 'Connected Social Platforms & Meta Platform Terms',
    body: (
      <span>
        Publishing, insights, feed, and comment features depend on third-party platform APIs. By connecting Facebook or Instagram accounts, you agree to comply with all applicable{' '}
        <a
          href="https://developers.facebook.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-300 font-medium"
        >
          Meta Platform Terms
        </a>{' '}
        and Developer Policies. Meta, Instagram, Facebook, Google, and other providers may change permissions, limits, review requirements, or API availability at any time.
      </span>
    ),
  },
  {
    title: 'Content Responsibility',
    body: (
      <span>
        You are responsible for all captions, media, comments, scheduled posts, and other content submitted through ThousandPost. Do not upload or publish content that violates copyright, intellectual property, laws, or platform community guidelines.
      </span>
    ),
  },
  {
    title: 'Service Availability',
    body: (
      <span>
        ThousandPost is provided on an as-available basis. Scheduled publishing may be affected by internet connectivity, token expiry, platform API errors, invalid media formats, rate limits, or service outages.
      </span>
    ),
  },
  {
    title: 'Limitation of Liability',
    body: (
      <span>
        To the maximum extent allowed by law, ThousandPost is not liable for indirect losses, missed publishing times, platform restrictions, account suspensions, or business losses caused by use of the service.
      </span>
    ),
  },
];

export const TermsAndConditions = () => (
  <div className="h-screen overflow-y-auto bg-[#0c0c0e] text-white font-sans selection:bg-white selection:text-black">
    <header className="border-b border-white/[0.08] bg-[#0c0c0e]/80 backdrop-blur-xl px-5 py-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to ThousandPost
        </Link>
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <Sparkles className="h-4 w-4 text-white" />
          ThousandPost
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">Legal</p>
      <h1 className="m-0 mt-3 text-4xl font-black tracking-tight text-white">Terms and Conditions</h1>
      <p className="m-0 mt-3 text-sm text-zinc-400">Last updated: June 16, 2026</p>

      <div className="mt-8 rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
        <p className="m-0 text-base leading-7 text-zinc-300">
          These Terms and Conditions govern your use of ThousandPost. By accessing the platform, you agree to use it responsibly and only with accounts and content you are authorized to manage.
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
        If you have questions regarding these Terms or need support, please contact us at{' '}
        <a href="mailto:admin@thethousandways.com" className="text-zinc-300 underline hover:text-white transition">
          admin@thethousandways.com
        </a>
        .
      </p>
      <p className="m-0 mt-4 text-xs text-zinc-500">
        This app is managed by{' '}
        <a href="https://thethousandways.com/" target="_blank" rel="noopener noreferrer" className="underline text-zinc-400 hover:text-white transition">
          Thousand Ways
        </a>
      </p>
    </main>
  </div>
);

export default TermsAndConditions;
