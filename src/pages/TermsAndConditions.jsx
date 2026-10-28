import { LEGAL_POLICY_UPDATED_LABEL } from '../utils/legalPolicy';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

const sections = [
  {
    title: 'Use of ThousandPost',
    body: (
      <div>
        You may use ThousandPost to connect supported social channels, manage media assets, schedule and publish content, view performance insights, manage comments and conversations, and configure automatic comment replies and DMs. Instagram and Facebook support eligible comment-to-DM and Inbox features; YouTube supports public comment replies only. You are responsible for ensuring your use complies with applicable laws and third-party platform policies.
      </div>
    ),
  },
  {
    title: 'Acceptance and Updates',
    body: (
      <div>
        To continue into the app and connect channels or use comment and messaging features, you must expressly accept the current Terms and Conditions and Privacy Policy. We record the accepted version and time. We will present material changes for renewed acceptance before enabling newly disclosed data uses. You can decline by signing out; account settings, channel disconnection, and deletion remain available without acceptance. Accepting these policies does not enable an automation: you must separately create and enable each rule you want to run.
      </div>
    ),
  },
  {
    title: 'Account Access',
    body: (
      <div>
        You are responsible for maintaining access to your Google account and connected social channels. Do not share your login, credentials, or tokens with anyone. Only connect social channels that you own or are authorized to manage, and disconnect any channel you no longer manage.
      </div>
    ),
  },
  {
    title: 'YouTube Terms of Service & Google Policies',
    body: (
      <div>
        ThousandPost integrates with YouTube API Services. By connecting a YouTube channel or using ThousandPost features that interact with YouTube, you agree to be bound by the{' '}
        <a
          href="https://www.youtube.com/t/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 underline hover:text-red-300 font-medium"
        >
          YouTube Terms of Service (https://www.youtube.com/t/terms)
        </a>{' '}
        and acknowledge that your use is subject to the{' '}
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 underline hover:text-red-300 font-medium"
        >
          Google Privacy Policy (https://policies.google.com/privacy)
        </a>
        . You may revoke ThousandPost's access to your Google and YouTube data at any time via the{' '}
        <a
          href="https://security.google.com/settings/security/permissions"
          target="_blank"
          rel="noopener noreferrer"
          className="text-red-400 underline hover:text-red-300 font-medium"
        >
          Google Security Settings page
        </a>
        . Please review these policies carefully before connecting your channel.
      </div>
    ),
  },
  {
    title: 'Connected Social Platforms & Meta Platform Terms',
    body: (
      <div>
        Publishing, insights, comments, automation, and messaging features depend on third-party platform APIs. By connecting Facebook or Instagram accounts, you agree to comply with all applicable{' '}
        <a
          href="https://developers.facebook.com/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-300 font-medium"
        >
          Meta Platform Terms
        </a>{' '}
        and Developer Policies. Meta, Instagram, Facebook, Google, and other providers may change permissions, limits, review requirements, or API availability at any time.
      </div>
    ),
  },
  {
    title: 'Comment Replies, DMs, and Automation Authorization',
    body: (
      <div>
        When you save an enabled automation, you authorize ThousandPost to monitor comments on the selected connected account and send the public replies and, where supported, private replies specified by that rule when its triggers match. Review the selected account, posts, keywords, reply variants, personalization, and DM text before enabling the rule. Enabled rules may run while you are offline. When multiple rules match, only the first matching enabled rule for the account is applied.
        <br /><br />
        You can edit, pause, or delete rules from the Automations page, or disconnect the channel to stop future work. An action already in progress may finish. Pausing or deleting a rule does not retract content already sent. You remain responsible for your configured messages, links, offers, and any necessary notices, permissions, or marketing consent. A person's comment is not blanket permission for ongoing promotional messages. Do not use automations or the Inbox for spam, harassment, impersonation, deceptive offers, unlawful content, or attempts to bypass platform limits or a person's request to stop receiving messages. We may restrict abusive use.
        <br /><br />
        Comment-specific private replies and ordinary Inbox messages have separate eligibility and time limits. A private reply does not itself authorize follow-up messages. You must respect the recipient's choices and the platform rules described in our{' '}
        <Link to="/privacy-policy" className="text-blue-400 underline hover:text-blue-300 font-medium">Privacy Policy</Link>.
      </div>
    ),
  },
  {
    title: 'Content Responsibility & Rights Certification',
    body: (
      <div>
        You are responsible for all captions, media assets, scheduled posts, public replies, private messages, automation templates, and other content you submit or authorize through ThousandPost. By uploading, scheduling, sending, or enabling rules for content, you certify and warrant that:
        <br /><br />
        <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-300">
          <li>You own all intellectual property rights in the content or have secured all necessary licenses, releases, and permissions to distribute it.</li>
          <li>The content does not infringe copyright, trademark, privacy, publicity, or other rights of any third party.</li>
          <li>The content complies with Meta Community Standards and Instagram Community Guidelines.</li>
          <li>
            Content uploaded to YouTube complies with the{' '}
            <a href="https://www.youtube.com/howyoutubeworks/policies/community-guidelines/" target="_blank" rel="noopener noreferrer" className="text-red-400 underline hover:text-red-300 font-medium">
              YouTube Community Guidelines
            </a>. You must select the video title, description, visibility, audience designation, and applicable altered-content disclosure before an API upload.
          </li>
          <li>For sponsored, paid partnership, gifted, or affiliate posts, you must comply with Meta's Branded Content Policies and applicable consumer disclosure laws (e.g. FTC guidelines) using native platform disclosure tools.</li>
        </ul>
      </div>
    ),
  },
  {
    title: 'Service Availability',
    body: (
      <div>
        ThousandPost is provided on an as-available basis. Publishing, comment synchronization, automated replies, DMs, and Inbox delivery may be delayed or fail because of connectivity, token expiry, missing permissions, platform review status, API errors, recipient settings, messaging windows, rate limits, or outages. We do not guarantee that every comment will be detected or that every reply or message will be delivered. Review activity and delivery errors, and use the social platform directly when timely communication is essential.
      </div>
    ),
  },
  {
    title: 'Privacy and Deleting Connected Data',
    body: (
      <div>
        Our{' '}
        <Link to="/privacy-policy" className="text-blue-400 underline hover:text-blue-300 font-medium">Privacy Policy</Link>{' '}
        explains how we process comments, messages, participant information, and automation records. Disconnecting a channel or deleting your ThousandPost account removes applicable locally stored interaction records and queued automation work. It does not delete comments, replies, messages, or copies already held by social platforms or recipients. Use the social platform's own controls for content held there. Follow our{' '}
        <Link to="/data-deletion" className="text-blue-400 underline hover:text-blue-300 font-medium">Data Deletion Instructions</Link>{' '}
        to request deletion of data held by ThousandPost.
      </div>
    ),
  },
  {
    title: 'Limitation of Liability',
    body: (
      <div>
        To the maximum extent allowed by law, ThousandPost is not liable for indirect losses, missed publishing times, platform restrictions, account suspensions, or business losses caused by use of the service.
      </div>
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
      <p className="m-0 mt-3 text-sm text-zinc-400">Last updated: {LEGAL_POLICY_UPDATED_LABEL}</p>

      <div className="mt-8 rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl">
        <p className="m-0 text-base leading-7 text-zinc-300">
          These Terms and Conditions govern your use of ThousandPost. By accessing the platform, you agree to use it responsibly and only with accounts and content you are authorized to manage.
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
