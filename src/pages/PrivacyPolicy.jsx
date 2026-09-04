import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

const sections = [
  {
    title: 'Information We Collect',
    body: (
      <span>
        ThousandPost collects account details you provide (name, email), Google sign-in profile information, connected social channel identifiers, media assets you upload, post captions, scheduled publication timestamps, and performance metrics (views, likes, comments) fetched from authorized platform APIs.
      </span>
    ),
  },
  {
    title: 'How We Use Information',
    body: (
      <span>
        We use your information to authenticate workspace users, link social channels upon request, schedule and publish media to authorized destinations, aggregate post performance insights, maintain account security, and troubleshoot issues. We do not sell your personal information or platform data to third parties, data brokers, or advertising networks.
      </span>
    ),
  },
  {
    title: 'YouTube API Services & Google User Data',
    body: (
      <span>
        ThousandPost uses YouTube API Services to authenticate your channel, upload scheduled video content, and retrieve video engagement statistics. By connecting your YouTube channel, you acknowledge that ThousandPost processes data via YouTube API Services and that your use is subject to the{' '}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 underline hover:text-red-300 font-medium"
        >
          Google Privacy Policy (https://policies.google.com/privacy)
        </a>
        .<br /><br />
        <strong>Revoking Access:</strong> In addition to disconnecting your channel in ThousandPost settings, you can revoke ThousandPost's access to your Google and YouTube data at any time via the{' '}
        <a
          href="https://security.google.com/settings/security/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 underline hover:text-red-300 font-medium"
        >
          Google Security Settings page (https://security.google.com/settings/security/permissions)
        </a>
        .<br /><br />
        <strong>Google Limited Use Disclosure:</strong> ThousandPost's use and transfer to any other app of information received from Google APIs adheres to the{' '}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 underline hover:text-red-300 font-medium"
        >
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.<br /><br />
        <strong>Data Retention:</strong> In compliance with YouTube Developer Policies, numeric YouTube API metric snapshots are retained for no longer than 30 calendar days before being refreshed or purged.
      </span>
    ),
  },
  {
    title: 'Meta Platform Data (Facebook & Instagram)',
    body: (
      <span>
        When you connect a Facebook Page or Instagram Professional account, ThousandPost uses authorized platform permissions (such as <code>pages_show_list</code>, <code>pages_manage_posts</code>, <code>instagram_basic</code>, and <code>instagram_content_publish</code>) solely to publish user-approved content, verify channel ownership, and display feed metrics. We never use Meta user data for surveillance, profiling, or unauthorized targeting. You can disconnect your accounts at any time from ThousandPost or directly within your Meta settings.
      </span>
    ),
  },
  {
    title: 'Data Storage and Security',
    body: (
      <span>
        We implement administrative, technical, and physical safeguards to protect stored data. Access tokens are treated as sensitive credentials, transmission is encrypted via HTTPS/TLS, and access to internal databases is restricted.
      </span>
    ),
  },
  {
    title: 'Data Sharing',
    body: (
      <span>
        We do not sell, rent, or trade your personal information or social platform data. We share data with third-party service providers only when necessary to operate core features (e.g. Cloudflare R2 / AWS S3 for media storage, cloud hosting, and official platform APIs).
      </span>
    ),
  },
  {
    title: 'Your Choices & Revocation',
    body: (
      <span>
        You may stop using ThousandPost at any time, disconnect individual publishing channels, delete your entire workspace data, or revoke platform access through your Facebook, Instagram, or Google account settings.
      </span>
    ),
  },
  {
    title: 'Data Deletion Instructions',
    body: (
      <span>
        We respect your right to have your data erased. You can permanently delete your ThousandPost account and all connected platform data from your account settings, or visit our dedicated{' '}
        <Link to="/data-deletion" className="text-blue-400 underline hover:text-blue-300 font-medium">
          Data Deletion Instructions Page
        </Link>{' '}
        for step-by-step guidance on how to remove permissions and submit manual deletion requests.
      </span>
    ),
  },
  {
    title: "Children's Privacy",
    body: (
      <span>
        ThousandPost is not intended for individuals under 13 years of age. We do not knowingly collect personal information from children under 13.
      </span>
    ),
  },
];

export const PrivacyPolicy = () => (
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
      <h1 className="m-0 mt-3 text-4xl font-black tracking-tight text-white">Privacy Policy</h1>
      <p className="m-0 mt-3 text-sm text-zinc-400">Last updated: June 16, 2026</p>

      <div className="mt-8 rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
        <p className="m-0 text-base leading-7 text-zinc-300">
          This Privacy Policy explains how ThousandPost collects, uses, and protects information when you use the platform to manage social publishing workflows.
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
        For privacy requests, data deletion, or general inquiries, please contact us at{' '}
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

export default PrivacyPolicy;
