import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

const sections = [
  {
    title: 'Information We Collect',
    body: 'EasyPost may collect account details you provide, Google sign-in profile information, connected social account metadata, media assets, captions, scheduled post data, comments, and usage activity needed to operate the workspace.',
  },
  {
    title: 'How We Use Information',
    body: 'We use your information to authenticate users, connect social channels, schedule and publish content, fetch insights, manage comments, maintain security, troubleshoot issues, and improve the product experience.',
  },
  {
    title: 'Social Platform Data',
    body: 'When you connect Facebook or Instagram, EasyPost uses authorized platform permissions to access only the data required for publishing, insights, feed display, and comment workflows. You can disconnect accounts from the app or from the social platform settings.',
  },
  {
    title: 'Data Storage and Security',
    body: 'We use reasonable technical safeguards to protect stored data. Access tokens, uploaded media, and workspace records should be treated as sensitive operational data and protected from unauthorized access.',
  },
  {
    title: 'Data Sharing',
    body: 'We do not sell your personal information. We may share data with service providers only when needed to operate core product features such as authentication, hosting, storage, analytics, or platform API integrations.',
  },
  {
    title: 'Your Choices',
    body: 'You may stop using EasyPost, disconnect social accounts, request deletion of workspace data, or revoke platform permissions through Facebook, Instagram, or Google account settings.',
  },
  {
    title: 'Data Deletion Instructions',
    body: 'If you wish to delete your EasyPost account and associated social profile metadata, you can delete your account from your profile dashboard, or contact us at support@easypost.com to request complete removal. To revoke Facebook/Instagram API permissions, go to your Facebook account Settings & Privacy > Settings > Business Integrations, select EasyPost, and click Remove.',
  },
  {
    title: "Children's Privacy",
    body: 'EasyPost does not knowingly collect or solicit personal information from children under 13. If we learn we have collected info from a child under 13, we will delete it promptly.',
  },
];

export const PrivacyPolicy = () => (
  <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans">
    <header className="border-b border-[#d2d2d7] bg-white px-5 py-4">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#3478f6]">
          <ArrowLeft className="h-4 w-4" />
          Back to EasyPost
        </Link>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-[#3478f6]" />
          EasyPost
        </div>
      </div>
    </header>

    <main className="mx-auto max-w-4xl px-5 py-12">
      <p className="m-0 text-xs font-semibold uppercase tracking-wider text-[#6e6e73]">Legal</p>
      <h1 className="m-0 mt-3 text-4xl font-semibold tracking-tight text-[#1d1d1f]">Privacy Policy</h1>
      <p className="m-0 mt-3 text-sm text-[#6e6e73]">Last updated: June 16, 2026</p>

      <div className="mt-8 rounded-lg border border-[#d2d2d7] bg-white p-6">
        <p className="m-0 text-base leading-7 text-[#515154]">
          This Privacy Policy explains how EasyPost collects, uses, and protects information when you use the platform to manage social publishing workflows.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-lg border border-[#e5e5ea] bg-white p-6">
            <h2 className="m-0 text-lg font-semibold text-[#1d1d1f]">{section.title}</h2>
            <p className="m-0 mt-3 text-sm leading-7 text-[#515154]">{section.body}</p>
          </section>
        ))}
      </div>

      <p className="m-0 mt-8 text-sm leading-7 text-[#6e6e73]">
        For privacy requests, data deletion, or general inquiries, please contact us at support@easypost.com.
      </p>
      <p className="m-0 mt-4 text-xs text-[#8e8e93]">
        This product is powered by{' '}
        <a href="https://thethousandways.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#3478f6]">
          thousandway to make
        </a>
      </p>
    </main>
  </div>
);

export default PrivacyPolicy;
