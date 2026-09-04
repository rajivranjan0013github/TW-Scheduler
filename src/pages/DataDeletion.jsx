import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Trash2, ShieldCheck, Mail, ExternalLink, RefreshCw } from 'lucide-react';

export const DataDeletion = () => (
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
      <p className="m-0 text-xs font-bold uppercase tracking-wider text-zinc-400">User Rights & Compliance</p>
      <h1 className="m-0 mt-3 text-4xl font-black tracking-tight text-white">User Data Deletion Instructions</h1>
      <p className="m-0 mt-3 text-sm text-zinc-400">Last updated: June 16, 2026</p>

      <div className="mt-8 rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-xl space-y-3">
        <p className="m-0 text-base leading-7 text-zinc-300">
          In accordance with the <strong>Meta Platform Terms</strong>, the <strong>YouTube API Services Terms of Service</strong>, and global privacy regulations (including GDPR and CCPA), ThousandPost provides clear instructions on how you can request and execute the deletion of all data associated with your account and connected social channels.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {/* Method 1: In-App Self-Service Deletion */}
        <section className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-500/10 p-2.5 text-rose-400 border border-rose-500/20">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="m-0 text-lg font-bold text-white">1. Self-Service Account & Data Deletion (Instant)</h2>
              <p className="m-0 text-xs text-zinc-400">Deletes your ThousandPost account and cascades deletion across all stored data</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-zinc-300">
            You can delete your entire ThousandPost workspace directly from inside the application:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-400 pl-2">
            <li>Log in to your ThousandPost dashboard.</li>
            <li>Navigate to <strong>Settings</strong> from the main menu.</li>
            <li>Scroll down to the <strong>Danger Zone</strong>.</li>
            <li>Click <strong>Delete Account</strong> and confirm the prompt.</li>
          </ol>
          <p className="text-xs text-zinc-400 bg-white/[0.03] p-3 rounded-lg border border-white/5">
            <strong>What gets deleted:</strong> Your profile record, access and refresh tokens for all connected channels, uploaded media assets, scheduled posts, published feed records, metric snapshots, and comment records are permanently purged from our databases.
          </p>
        </section>

        {/* Method 2: Disconnecting Channels */}
        <section className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-400 border border-blue-500/20">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="m-0 text-lg font-bold text-white">2. Disconnect Specific Channels without Deleting Account</h2>
              <p className="m-0 text-xs text-zinc-400">Remove access to individual Facebook Pages, Instagram accounts, or YouTube channels</p>
            </div>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-400 pl-2">
            <li>Go to the <strong>Publishing Channels</strong> page in your dashboard.</li>
            <li>Locate the channel you want to disconnect.</li>
            <li>Click the channel options and select <strong>Disconnect / Remove</strong>.</li>
            <li>All access tokens and cached metrics specific to that channel will be immediately invalidated and deleted.</li>
          </ol>
        </section>

        {/* Method 3: Revoking Meta Permissions */}
        <section className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-sky-500/10 p-2.5 text-sky-400 border border-sky-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="m-0 text-lg font-bold text-white">3. Revoking Access via Facebook / Instagram (Meta)</h2>
              <p className="m-0 text-xs text-zinc-400">Remove ThousandPost authorization directly from your Meta settings</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-zinc-300">
            If you want to revoke ThousandPost's access to your Facebook Pages and Instagram accounts:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-400 pl-2">
            <li>Log in to your Facebook account on web or mobile.</li>
            <li>Go to <strong>Settings & Privacy &gt; Settings</strong>.</li>
            <li>In the left sidebar, click <strong>Apps and Websites</strong> (or Business Integrations).</li>
            <li>Find <strong>ThousandPost</strong> in the list of active apps.</li>
            <li>Click <strong>Remove</strong> and confirm.</li>
          </ol>
        </section>

        {/* Method 4: Revoking Google / YouTube Permissions */}
        <section className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2.5 text-red-400 border border-red-500/20">
              <ExternalLink className="h-5 w-5" />
            </div>
            <div>
              <h2 className="m-0 text-lg font-bold text-white">4. Revoking Access via Google Security Settings (YouTube)</h2>
              <p className="m-0 text-xs text-zinc-400">Manage Google third-party app permissions</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-zinc-300">
            To revoke ThousandPost's access to your YouTube channel and Google account:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-sm text-zinc-400 pl-2">
            <li>
              Visit your{' '}
              <a
                href="https://security.google.com/settings/security/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-400 underline hover:text-red-300 font-medium"
              >
                Google Security Settings Page (Third-party apps with account access)
              </a>
              .
            </li>
            <li>Select <strong>ThousandPost</strong> from the list of authorized applications.</li>
            <li>Click <strong>Remove Access</strong> and confirm.</li>
          </ol>
        </section>

        {/* Method 5: Email Request */}
        <section className="rounded-xl border border-white/10 bg-[#0a0a0a] p-6 shadow-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400 border border-emerald-500/20">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="m-0 text-lg font-bold text-white">5. Manual Data Deletion Request (Email Support)</h2>
              <p className="m-0 text-xs text-zinc-400">Request complete data erasure by contacting our privacy team</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-zinc-300">
            If you cannot access your account or wish to verify the total erasure of all records, send an email to:
          </p>
          <div className="bg-white/[0.04] p-4 rounded-xl border border-white/10 flex items-center justify-between">
            <span className="text-sm font-mono text-white">admin@thethousandways.com</span>
            <a
              href="mailto:admin@thethousandways.com?subject=Data%20Deletion%20Request"
              className="text-xs font-semibold text-zinc-300 underline hover:text-white"
            >
              Email Us
            </a>
          </div>
          <p className="text-xs leading-5 text-zinc-400">
            Please include the email address associated with your ThousandPost account and the handles of any connected channels. Our privacy team will process and confirm your deletion request within <strong>48 hours</strong>.
          </p>
        </section>
      </div>

      <div className="mt-10 border-t border-white/[0.08] pt-6 flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-4">
          <Link to="/privacy-policy" className="hover:text-zinc-300 underline">Privacy Policy</Link>
          <Link to="/terms-and-conditions" className="hover:text-zinc-300 underline">Terms and Conditions</Link>
        </div>
        <span>
          © 2026 ThousandPost · Managed by{' '}
          <a
            href="https://thethousandways.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white transition"
          >
            Thousand Ways
          </a>
        </span>
      </div>
    </main>
  </div>
);

export default DataDeletion;
