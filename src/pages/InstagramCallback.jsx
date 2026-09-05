import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { withHandlerPreviewHeaders } from '../utils/handlerPreview';
import PlatformIcon from '../components/PlatformIcon';
import { AccountAvatar } from '../components/adminDashboard/DashboardPresentation';
import { formatHandle } from '../utils/channelOAuth';

export const InstagramCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const errorParam = searchParams.get('error') || searchParams.get('error_description');
  const exchangeStartedRef = useRef(false);

  const [status, setStatus] = useState('processing'); // 'processing' | 'success' | 'error'
  const [statusMessage, setStatusMessage] = useState('Securely exchanging credentials with Instagram to connect your account...');
  const [connectedAccount, setConnectedAccount] = useState(null);

  const navigateAfterConnect = useCallback((options = {}) => {
    const toastInfo = options?.toastInfo || (options?.type ? options : null);
    const account = options?.connectedAccount || null;
    const storedCampaignId = sessionStorage.getItem('connect_campaign_id') || '';
    const returnPath = sessionStorage.getItem('connect_return_path') || '';
    sessionStorage.removeItem('connect_return_path');
    sessionStorage.removeItem('reauthorize_account_id');
    sessionStorage.removeItem('instagram_oauth_redirect_uri');

    const navState = {
      ...(storedCampaignId ? { campaignId: storedCampaignId } : {}),
      ...(toastInfo ? { channelToast: toastInfo } : {}),
      ...(account ? { connectedAccount: account } : {}),
    };

    if (returnPath) {
      navigate(returnPath, { state: navState });
      return;
    }

    navigate('/channels', { state: navState });
  }, [navigate]);

  const exchangeToken = useCallback(async () => {
    try {
      const token = localStorage.getItem('tw_token');
      if (!token) {
        sessionStorage.setItem('pending_instagram_code', code);
        setStatus('error');
        setStatusMessage('Please sign in first, then return to finish connecting Instagram.');
        return;
      }

      const apiBaseUrl = API_BASE_URL;
      const campaignId = sessionStorage.getItem('connect_campaign_id') || localStorage.getItem('active-campaign-id') || '';
      const reauthorizeAccountId = sessionStorage.getItem('reauthorize_account_id') || '';
      const redirectUri = sessionStorage.getItem('instagram_oauth_redirect_uri')
        || `${window.location.origin}/auth/instagram/callback`
        || import.meta.env.VITE_INSTAGRAM_REDIRECT_URI;

      const response = await fetch(`${apiBaseUrl}/api/accounts/instagram-callback`, {
        method: 'POST',
        headers: withHandlerPreviewHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }),
        body: JSON.stringify({ code, state, redirectUri, campaignId, reauthorizeAccountId }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const successMsg = data.message || 'Your Instagram account is linked successfully.';
        const account = data.account || null;
        setConnectedAccount(account);
        setStatus('success');
        setStatusMessage(successMsg);
        setTimeout(() => {
          navigateAfterConnect({
            toastInfo: { type: 'success', message: `Connected! ${successMsg}` },
            connectedAccount: account,
          });
        }, 1800);
      } else {
        setStatus('error');
        setStatusMessage(data.message || 'Instagram authorization failed.');
      }
    } catch (error) {
      console.error('Error in Instagram OAuth token exchange:', error);
      setStatus('error');
      setStatusMessage('Network error completing Instagram authentication flow.');
    }
  }, [code, state, navigateAfterConnect]);

  useEffect(() => {
    if (errorParam) {
      setStatus('error');
      setStatusMessage(`Instagram authorization was cancelled or failed: ${errorParam}`);
      return;
    }

    if (code) {
      if (exchangeStartedRef.current) return;
      const codeKey = `instagram_oauth_code_${code}`;
      if (sessionStorage.getItem(codeKey)) return;
      sessionStorage.setItem(codeKey, 'processing');
      exchangeStartedRef.current = true;
      exchangeToken();
    } else {
      navigateAfterConnect();
    }
  }, [code, errorParam, exchangeToken, navigateAfterConnect]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans p-6 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c0e] p-6 shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {status === 'success' && connectedAccount ? (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-center">
              <div className="relative">
                <AccountAvatar
                  account={connectedAccount}
                  className="h-20 w-20 rounded-full border-2 border-emerald-500/50 object-cover shadow-xl"
                />
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-black bg-[#141417] shadow-md">
                  <PlatformIcon platform="instagram" className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>This channel is connected</span>
              </div>
              <h3 className="text-base font-bold tracking-tight text-white m-0 truncate">
                {connectedAccount.name || connectedAccount.displayName || 'Instagram Channel'}
              </h3>
              {Boolean(connectedAccount.username || connectedAccount.handle) && (
                <p className="mt-1 text-xs font-mono text-zinc-400 m-0 truncate">
                  {formatHandle(connectedAccount.username || connectedAccount.handle)}
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed m-0">
                {statusMessage}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 shadow-lg">
                  <PlatformIcon platform="instagram" className="h-7 w-7 text-white" />
                </div>
                {status === 'processing' && (
                  <span className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin rounded-full border-2 border-[#7831d6] border-t-transparent bg-black" />
                )}
                {status === 'success' && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-black shadow-md animate-in zoom-in">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                )}
                {status === 'error' && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-md animate-in zoom-in">
                    <AlertCircle className="h-3.5 w-3.5" />
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-base font-bold tracking-tight text-white m-0">
                {status === 'processing' && 'Connecting Instagram...'}
                {status === 'success' && 'Instagram Connected!'}
                {status === 'error' && 'Connection Failed'}
              </h3>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed m-0">
                {statusMessage}
              </p>
            </div>
          </>
        )}

        {status === 'processing' && (
          <div className="flex justify-center pt-1">
            <span className="text-[11px] font-medium text-zinc-500">Exchanging authorization tokens...</span>
          </div>
        )}

        {status === 'success' && (
          <button
            type="button"
            onClick={() => navigateAfterConnect({ type: 'success', message: statusMessage })}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-black transition hover:bg-emerald-400 active:scale-95 shadow-lg shadow-emerald-500/20"
          >
            <span>Continue to Channels</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}

        {status === 'error' && (
          <button
            type="button"
            onClick={() => navigateAfterConnect({ type: 'error', message: statusMessage })}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15 active:scale-95 shadow-sm"
          >
            <span>Back to Channels</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default InstagramCallback;
