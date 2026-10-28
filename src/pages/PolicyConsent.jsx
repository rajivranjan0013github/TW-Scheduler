import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LEGAL_POLICY_UPDATED_LABEL } from '../utils/legalPolicy';

export default function PolicyConsent() {
  const { acceptPolicies, logout } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    if (!accepted || saving) return;
    setSaving(true);
    setError('');
    try {
      await acceptPolicies();
    } catch (failure) {
      setError(failure.message);
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#0c0c0e] px-5 py-10 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-9">
        <ShieldCheck className="h-8 w-8 text-purple-300" aria-hidden="true" />
        <p className="mb-0 mt-5 text-xs font-semibold uppercase tracking-wider text-zinc-400">ThousandPost · {LEGAL_POLICY_UPDATED_LABEL}</p>
        <h1 className="mb-0 mt-3 text-2xl font-bold tracking-tight">Review our updated policies</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-300">We’ve added comment replies, automatic private replies, and an Inbox. Please review how these features use data before continuing.</p>
        <div className="my-5 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="m-0 flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4" aria-hidden="true" /> What’s changed</p>
          <ul className="mb-0 mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-400">
            <li>We read and store comments, messages, participant details, and delivery records for your connected accounts.</li>
            <li>YouTube supports public comment replies. Instagram and Facebook also support eligible private replies and Inbox messages.</li>
            <li>Enabled rules can send your configured replies while you’re offline. You can pause or delete them at any time.</li>
            <li>The policies explain retention, access revocation, and how to delete your data.</li>
          </ul>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-purple-200 underline">Privacy Policy</Link>
          <Link to="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-purple-200 underline">Terms and Conditions</Link>
          <Link to="/data-deletion" target="_blank" rel="noopener noreferrer" className="text-purple-200 underline">Data Deletion</Link>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-zinc-300">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={saving} className="mt-1 h-4 w-4 shrink-0 accent-purple-500" />
            <span>I have reviewed and agree to the updated Privacy Policy and Terms and Conditions.</span>
          </label>
          {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
          <button type="submit" disabled={!accepted || saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : 'Accept and continue'}
          </button>
        </form>
        <p className="mb-0 mt-5 text-xs leading-6 text-zinc-400">You can <Link to="/channels" className="text-zinc-200 underline">disconnect channels</Link> or <Link to="/settings" className="text-zinc-200 underline">manage or delete your account</Link> without accepting, or <button type="button" onClick={logout} className="text-zinc-200 underline">sign out</button>.</p>
      </section>
    </main>
  );
}
