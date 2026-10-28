import { LEGAL_POLICY_UPDATED_LABEL } from '../utils/legalPolicy';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

const sections = [
  {
    title: 'Information We Collect',
    body: (
      <div>
        ThousandPost collects account details you provide (name and email), Google sign-in profile information, connected social channel identifiers and profile details, OAuth authorization credentials, media assets you upload, post titles and captions, publication settings and timestamps, and performance metrics (views, likes, and comment counts) fetched from authorized platform APIs. When you use comment management, automation, or the Inbox, we also process comment and message text, platform and participant identifiers, names and usernames, available profile pictures, attachment types and URLs, timestamps, conversation read status, automation rules, and delivery or error records. This includes information about people who interact with your connected accounts, even if they do not have a ThousandPost account. We record the policy version you accept and the time of your acceptance. We also process basic security and diagnostic information such as IP address, browser type, request time, and error logs. The web app stores your signed-in session and interface preferences in browser storage.
      </div>
    ),
  },
  {
    title: 'How We Use Information',
    body: (
      <div>
        We use your information to sign you in, link social channels upon request, schedule and publish media to authorized destinations, aggregate post performance insights, display and answer comments and messages, and run the comment reply and DM rules you enable. We use automation records to show outcomes and avoid duplicate actions, and operational information to maintain security and troubleshoot issues. We do not sell your personal information or platform data to third parties, data brokers, or advertising networks, and we do not use Google or Meta platform data to train general-purpose AI models or for advertising.
      </div>
    ),
  },
  {
    title: 'YouTube API Services & Google User Data',
    body: (
      <div>
        ThousandPost uses YouTube API Services to authenticate your channel, upload scheduled video content, retrieve video engagement statistics, read comments and commenter details on your channel, and post public replies that you submit manually or authorize through enabled automation rules. Comment access uses the youtube.force-ssl permission. YouTube does not support DMs through ThousandPost. By connecting your YouTube channel or using features that interact with YouTube, you acknowledge and agree to be bound by the{' '}
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
        <strong>Revocation Cleanup:</strong> We check connected YouTube authorizations regularly. If Google reports that authorization can no longer be refreshed, we disable the connection and queue deletion of its stored credentials, profile, cached API data, comments, and automation records. Failed deletions are retried. Data associated with access revoked through Google settings is deleted as soon as possible and within 30 calendar days of revocation.<br /><br />
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
        <strong>Data Retention:</strong> YouTube channel profile data, video records, and metrics obtained from YouTube API Services are refreshed from YouTube or deleted within 30 calendar days. Stored YouTube comments, commenter details, locally stored replies, and automation activity records expire 30 days after collection or creation; viewing them or changing their read status does not extend that period. Completed scheduled-post records have YouTube video identifiers removed after 30 days. OAuth credentials are retained only while your channel remains connected. Disconnecting the channel or deleting your ThousandPost account removes locally stored YouTube Authorized Data and initiates revocation of the applicable provider authorization. You may also request deletion by email; applicable YouTube user data is deleted as soon as possible and within seven calendar days of your request. Deleting our local copies does not delete content held by YouTube.
      </div>
    ),
  },
  {
    title: 'Meta Platform Data (Facebook & Instagram)',
    body: (
      <div>
        When you connect a Facebook Page or Instagram Professional account to ThousandPost, we request only the minimal permissions required to deliver scheduling, publishing, analytics, and comment and message automation services:
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
          <li>
            <code>pages_manage_metadata</code>: Allows ThousandPost to subscribe your connected Facebook Page to comment and message webhooks so new comments and messages reach your Automations page.
          </li>
          <li>
            <code>pages_manage_engagement</code>: Enables ThousandPost to post public replies to comments on your Page's posts, either when you reply manually or when an automation you created matches a comment.
          </li>
          <li>
            <code>pages_read_user_content</code>: Allows ThousandPost to read comments and commenter names on your Page's posts so you can see and answer them, and so your keyword automations can respond.
          </li>
          <li>
            <code>pages_messaging</code>: Enables comment-specific private replies and lets you read and answer Messenger conversations from your Page in the Inbox, subject to the separate eligibility and messaging windows described below.
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
          <li>
            <code>instagram_business_manage_comments</code>: Allows ThousandPost to read comments on your Instagram posts, post public replies to them, and power the keyword auto-replies you set up.
          </li>
          <li>
            <code>instagram_business_manage_messages</code>: Enables comment-specific private replies and lets you read and answer direct-message conversations in the Inbox, subject to the separate eligibility and messaging windows described below.
          </li>
        </ul>
        <br />
        <strong>Comment and Message Data:</strong>
        <br />
        When you use comment automation, the comment feed, or the Inbox, ThousandPost stores comments and commenter details, incoming and outgoing conversations and messages, available participant profiles and attachment URLs, and automation activity (which rule matched, the public reply text, and delivery outcomes). We obtain this information through authorized platform APIs and webhooks so you can manage interactions on your connected accounts. Meta comment, conversation, message, and automation records are kept while the account remains connected, unless you request deletion sooner. Disconnecting the account or deleting your ThousandPost account removes these local records and associated queued automation work. People who comment or message a connected account can contact us about their information using the address below; we may need information to identify the relevant account and records.
        <br /><br />
        <strong>Private Replies and Inbox Messages:</strong>
        <br />
        Our comment-to-DM feature supports one private reply per eligible comment within seven days of the comment, subject to the platform's eligibility rules and any shorter limits. Sending that private reply does not by itself permit ongoing messages. Inbox replies require a message from the person within the preceding 24 hours. We do not use these features to send unsolicited messages to people who have neither commented on the connected account's posts nor messaged it. Platform restrictions may prevent delivery even within these periods.
        <br /><br />
        <strong>Data Protection & Platform Compliance:</strong>
        <br />
        We never use Meta user data for surveillance, profiling, ad retargeting, or data brokering. All access tokens are securely handled and never exposed to client-side code. You may disconnect your accounts at any time from ThousandPost settings, through your Meta Account Settings under <em>Apps and Websites</em>, or via our{' '}
        <Link to="/data-deletion" className="text-blue-400 underline hover:text-blue-300 font-medium">
          Data Deletion Instructions Page
        </Link>.
      </div>
    ),
  },
  {
    title: 'Data Storage and Security',
    body: (
      <div>
        We implement technical and organizational safeguards to protect stored data. OAuth access and refresh tokens are encrypted at rest using authenticated encryption, transmission is encrypted via HTTPS/TLS, tokens are excluded from API responses and client-side code, and access to internal systems is limited to authorized ThousandPost team members with an operational need. No internet service can guarantee absolute security.
      </div>
    ),
  },
  {
    title: 'Data Sharing',
    body: (
      <div>
        We do not sell, rent, trade, advertise with, or broker your personal information or platform data. We disclose data as needed to provide user-requested features: Cloudflare R2-compatible storage processes uploaded media; database, hosting, and queue providers process application records and operational work; Meta and Google/YouTube receive content, relevant identifiers, and settings when you publish, retrieve data, reply to comments, or send messages manually or through enabled rules. Public replies are visible to the audience allowed by the social platform; private messages are delivered to the intended recipient through that platform, under its own privacy practices. If you take part in a campaign on ThousandPost, the campaign team can see the channels you link to that campaign, the posts scheduled for it, and their performance. Authorized ThousandPost team members may also access account data when needed to provide support, investigate abuse, or maintain security. Service providers are contractually or technically limited to providing these functions.
      </div>
    ),
  },
  {
    title: 'Retention, Transfers, and Your Rights',
    body: (
      <div>
        Account records, uploaded media, and scheduled-post data are kept while your account is active or until you delete them. Connected-platform credentials are kept only while the connection is active. YouTube data and Meta interaction records follow the retention periods above. New comment automation queue jobs contain references to locally stored records rather than copies of comment text or profiles, and are removed when they complete or finally fail. Disconnecting a channel or deleting your account disables its connection, clears its queued automation work, and removes applicable database records and stored media objects. Work already in progress may need to finish before deletion completes; a failed deletion can be retried. Deletion from ThousandPost does not remove public replies, DMs, or copies held by social platforms or recipients. Limited security records may be retained only where required by law or necessary to investigate abuse. Our providers may process data in countries outside your own using their applicable transfer safeguards. Depending on your location, you may request access, correction, export, restriction, objection, or deletion by contacting us.
      </div>
    ),
  },
  {
    title: 'Your Choices & Revocation',
    body: (
      <div>
        You may stop using ThousandPost at any time, disconnect individual publishing channels, delete your account and its data, or revoke platform access through your Facebook, Instagram, or Google account settings.
      </div>
    ),
  },
  {
    title: 'Data Deletion Instructions',
    body: (
      <div>
        We respect your right to have your data erased. You can permanently delete your ThousandPost account and all connected platform data from your account settings, or visit our dedicated{' '}
        <Link to="/data-deletion" className="text-blue-400 underline hover:text-blue-300 font-medium">
          Data Deletion Instructions Page
        </Link>{' '}
        for step-by-step guidance on how to remove permissions and submit manual deletion requests.
      </div>
    ),
  },
  {
    title: 'Policy Updates and Your Acceptance',
    body: (
      <div>
        Before connecting a channel or using the new comment and messaging features, we ask you to review and accept this Privacy Policy and our Terms and Conditions. Existing channel owners must accept the current version before background comment collection and message processing begin or resume. If we introduce a new use of Google user data that was not covered by your earlier acceptance, we will explain the change and ask you to accept the updated policy before using that data in the new way. You can review the policies, disconnect channels, request deletion, delete your account, or sign out without accepting the update.
      </div>
    ),
  },
  {
    title: "Children's Privacy",
    body: (
      <div>
        ThousandPost is not intended for individuals under 13 years of age. We do not knowingly collect personal information from children under 13.
      </div>
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
      <p className="m-0 mt-3 text-sm text-zinc-400">Last updated: {LEGAL_POLICY_UPDATED_LABEL}</p>

      <div className="mt-8 rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
        <p className="m-0 text-base leading-7 text-zinc-300">
          This Privacy Policy explains how ThousandPost collects, uses, and protects information for social publishing, analytics, comment management, automated replies and DMs, and the messaging Inbox.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-md">
            <h2 className="m-0 text-lg font-bold text-white">{section.title}</h2>
            <div className="m-0 mt-3 text-sm leading-7 text-zinc-400">{section.body}</div>
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
