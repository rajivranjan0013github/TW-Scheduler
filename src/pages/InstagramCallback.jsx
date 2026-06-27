import React, { useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const InstagramCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code');
  const exchangeStartedRef = useRef(false);

  const navigateAfterConnect = () => {
    const storedCampaignId = sessionStorage.getItem('connect_campaign_id') || '';
    const returnPath = sessionStorage.getItem('connect_return_path') || '';
    sessionStorage.removeItem('connect_return_path');

    if (returnPath) {
      navigate(returnPath);
      return;
    }

    navigate('/channels', { state: storedCampaignId ? { campaignId: storedCampaignId } : undefined });
  };

  useEffect(() => {
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
  }, [code]);

  const exchangeToken = async () => {
    try {
      const token = localStorage.getItem('tw_token');
      if (!token) {
        sessionStorage.setItem('pending_instagram_code', code);
        alert('Please sign in with Google first, then return to finish connecting Instagram.');
        navigateAfterConnect();
        return;
      }

      const apiBaseUrl = API_BASE_URL;
      const campaignId = sessionStorage.getItem('connect_campaign_id') || localStorage.getItem('active-campaign-id') || '';
      const redirectUri = sessionStorage.getItem('instagram_oauth_redirect_uri')
        || import.meta.env.VITE_INSTAGRAM_REDIRECT_URI
        || `${window.location.origin}/auth/instagram/callback`;
      const response = await fetch(`${apiBaseUrl}/api/accounts/instagram-callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code, redirectUri, campaignId }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(`🎉 Connected! ${data.message || 'Your Instagram account is linked successfully.'}`);
      } else {
        alert(`❌ Instagram OAuth Failed: ${data.message || 'Authorization failed'}`);
      }
    } catch (error) {
      console.error('Error in Instagram OAuth token exchange:', error);
      alert('❌ Error completing Instagram authentication flow.');
    } finally {
      navigateAfterConnect();
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center font-sans p-6 text-[#1d1d1f]">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
          <h3 className="text-sm font-semibold text-black tracking-tight mt-2">Connecting Instagram...</h3>
          <p className="text-[#8e8e93] text-[11px] leading-relaxed max-w-xs">
            We are secure-exchanging tokens with Instagram to connect your professional account directly.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InstagramCallback;
