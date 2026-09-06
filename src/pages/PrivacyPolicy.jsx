import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

const sections = [
  {
    title: 'Information We Collect',
    body: (
      <span>
        ThousandPost collects account details you provide (name and email), Google sign-in profile information, connected social channel identifiers and profile details, OAuth authorization credentials, media assets you upload, post titles and captions, publication settings and timestamps, and performance metrics (views, likes, and comment counts) fetched from authorized platform APIs. We also process basic security and diagnostic information such as IP address, browser type, request time, and error logs. The web app stores your signed-in session and interface preferences in browser storage.
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
        ThousandPost uses YouTube API Services to authenticate your channel, upload scheduled video content, and retrieve video engagement statistics. By connecting your YouTube channel or using features that interact with YouTube, you acknowledge and agree to be bound by the{' '}
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 underline hover:text-red-300 font-medium"
        >
          YouTube Terms of Service (https://www.youtube.com/t/terms)
        </a>
        {' '}and acknowledge that your use is subject to the{' '}
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
        <strong>Data Retention:</strong> YouTube channel profile data, video records, and metrics obtained from YouTube API Services are refreshed from YouTube or deleted within 30 calendar days. Completed scheduled-post records have YouTube video identifiers removed after 30 days. OAuth credentials are retained only while your channel remains connected. Disconnecting the channel or deleting your ThousandPost account removes locally stored YouTube Authorized Data and initiates revocation of the applicable provider authorization.
      </span>
    ),
  },
  {
    title: 'Meta Platform Data (Facebook & Instagram)',
    body: (
      <span>
        When you connect a Facebook Page or Instagram Professional account to ThousandPost, we request only the minimal permissions required to deliver scheduling, publishing, and analytics services:
        <br /><br />
        <strong>Facebook Page Permissions:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1.5 pl-2 text-zinc-300">
          <li>
            <code>pages_show_list</code>: Allows you to view and select which Facebook Pages you manage so you can connect them to your ThousandPost workspace.
          </li>
          <li>
            <code>pages_read_engagement</code>: Enables ThousandPost to retrieve post-level engagement metrics (such as reactions, likes, comment counts, and views) so you can review content performance in your unified analytics dashboard.
          </li>
          <li>
            <code>pages_manage_posts</code>: Grants ThousandPost the ability to publish text, photos, and videos to your selected Facebook Pages upon your explicit direction.
          </li>
        </ul>
        <br />
        <strong>Instagram Professional Account Permissions:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1.5 pl-2 text-zinc-300">
          <li>
            <code>instagram_business_basic</code>: Allows ThousandPost to read your Instagram Professional profile info (username, account ID, profile picture) and verify account ownership.
          </li>
          <li>
            <code>instagram_business_content_publish</code>: Enables ThousandPost to upload, schedule, and publish media containers (single images, reels, and carousels) directly to your Instagram Professional account.
          </li>
          <li>
            <code>instagram_business_manage_insights</code>: Allows ThousandPost to retrieve performance analytics (reach, impressions, views, likes, and comment counts) for media published through the platform.
          </li>
        </ul>
        <br />
        <strong>Data Protection & Platform Compliance:</strong>
        <br />
        We never use Meta user data for surveillance, profiling, ad retargeting, or data brokering. All access tokens are securely handled and never exposed to client-side code. You may disconnect your accounts at any time from ThousandPost settings, through your Meta Account Settings under <em>Apps and Websites</em>, or via our{' '}
        <Link to="/data-deletion" className="text-blue-400 underline hover:text-blue-300 font-medium">
          Data Deletion Instructions Page
        </Link>.
      </span>
    ),
  },
  {
    title: 'Data Storage and Security',
    body: (
      <span>
        We implement administrative and technical safeguards to protect stored data. OAuth access and refresh tokens are encrypted at rest using authenticated encryption, transmission is encrypted via HTTPS/TLS, tokens are excluded from API responses and client-side code, and access to internal databases is restricted by role and operational need. No internet service can guarantee absolute security.
      </span>
    ),
  },
  {
    title: 'Data Sharing',
    body: (
      <span>
        We do not sell, rent, trade, advertise with, or broker your personal information or platform data. We disclose data only as needed to provide user-requested features: Cloudflare R2-compatible storage processes uploaded media; our database and hosting providers process application records and operational logs; Meta and Google/YouTube receive content and settings when you direct us to publish or retrieve analytics; and Google Gemini processes media or prompts only when you choose an AI analysis or generation feature. Service providers are contractually or technically limited to providing these functions.
      </span>
    ),
  },
  {
    title: 'AI-Assisted Features',
    body: (
      <span>
        If you choose an AI-assisted media analysis, caption, or creative feature, the selected media, file name, prompt, and related instructions may be sent to Google Gemini solely to produce the requested result. Temporary provider files are deleted after processing where the provider API supports deletion. We do not use Google or Meta platform data to train general-purpose AI models or for advertising.
      </span>
    ),
  },
  {
    title: 'Retention, Transfers, and Your Rights',
    body: (
      <span>
        Account records, uploaded media, and scheduled-post data are kept while your account is active or until you delete them. Connected-platform credentials are kept only while the connection is active. Cached YouTube Authorized Data follows the 30-day refresh-or-delete cycle described above. Deletion requests remove applicable database records and stored media objects; limited security records may be retained only where required by law or necessary to investigate abuse. Our providers may process data in countries outside your own using their applicable transfer safeguards. Depending on your location, you may request access, correction, export, restriction, objection, or deletion by contacting us.
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
      <p className="m-0 mt-3 text-sm text-zinc-400">Last updated: September 6, 2026</p>

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
