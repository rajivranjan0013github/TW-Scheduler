import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const FacebookCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code');

  useEffect(() => {
    if (code) {
      exchangeToken();
    } else {
      navigate('/channels');
    }
  }, [code]);

  const exchangeToken = async () => {
    try {
      const token = localStorage.getItem('tw_token');
      const campaignId = sessionStorage.getItem('connect_campaign_id') || localStorage.getItem('active-campaign-id') || '';
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const response = await fetch(`${apiBaseUrl}/api/accounts/facebook-callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code, campaignId }),
      });

      const data = await response.json();
      if (response.ok) {
        alert('🎉 Connected! Your Facebook Pages and Instagram accounts are linked successfully.');
      } else {
        alert(`❌ OAuth Failed: ${data.message || 'Authorization failed'}`);
      }
    } catch (error) {
      console.error('Error in Facebook OAuth token exchange:', error);
      alert('❌ Error completing Facebook authentication flow.');
    } finally {
      navigate('/channels');
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center font-sans p-6 text-[#1d1d1f]">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#0071e3] border-t-transparent rounded-full animate-spin"></div>
          <h3 className="text-sm font-semibold text-black tracking-tight mt-2">Connecting Your Accounts...</h3>
          <p className="text-[#8e8e93] text-[11px] leading-relaxed max-w-xs">
            We are secure-exchanging tokens with Meta to synchronize your selected Facebook pages and linked Instagram accounts.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FacebookCallback;
