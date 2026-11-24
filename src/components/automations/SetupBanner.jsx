import { Link } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { connectInstagramOAuth, connectMetaOAuth } from '../../utils/channelOAuth';
import { AccountAvatar } from '../adminDashboard/DashboardPresentation';
import { accountLabel } from './format';

export const SetupBanner = ({ accounts, onSubscribe, subscribingId }) => (
  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06]">
    <div className="flex items-center gap-2.5 px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
      <p className="m-0 text-sm text-amber-100">
        {accounts.length === 1 ? '1 account needs' : `${accounts.length} accounts need`} one more step before automations can run.
      </p>
    </div>
    <div className="divide-y divide-amber-500/10 border-t border-amber-500/10">
      {accounts.map((account) => (
        <div key={account._id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <AccountAvatar account={account} className="h-7 w-7 shrink-0 rounded-full object-cover" />
            <span className="truncate text-sm font-medium text-white">{accountLabel(account)}</span>
            <span className="hidden truncate text-xs text-amber-200/60 sm:inline">
              {account.hasAutomationScopes ? 'Comment events are off' : account.supportsDm === false ? 'Needs comment access' : 'Needs comment & message access'}
            </span>
          </div>
          {account.hasAutomationScopes ? (
            <button
              type="button"
              onClick={() => onSubscribe(account._id)}
              disabled={Boolean(subscribingId)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60"
            >
              {subscribingId === account._id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Turn on
            </button>
          ) : (
            account.platform === 'youtube' ? (
              // YouTube reconnects go through My Channels, which shows the required YouTube Terms consent first
              <Link
                to="/channels"
                className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300"
              >
                Reconnect
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => (account.platform === 'facebook' ? connectMetaOAuth(null, account._id) : connectInstagramOAuth())}
                className="shrink-0 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-300"
              >
                Reconnect
              </button>
            )
          )}
        </div>
      ))}
    </div>
  </div>
);
