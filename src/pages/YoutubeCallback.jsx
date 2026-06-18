import { useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

export const YoutubeCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  const exchangeToken = useCallback(async () => {
    try {
      const token = localStorage.getItem('tw_token');
      const response = await fetch('http://localhost:5001/api/accounts/youtube-callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Connected! ${data.account?.name || 'Your YouTube channel'} is ready for scheduled uploads.`);
      } else {
        alert(`YouTube OAuth failed: ${data.message || 'Authorization failed'}`);
      }
    } catch (err) {
      console.error('Error in YouTube OAuth token exchange:', err);
      alert('Error completing YouTube authentication flow.');
    } finally {
      navigate('/channels');
    }
  }, [code, navigate]);

  useEffect(() => {
    if (error) {
      alert(`YouTube authorization was cancelled or failed: ${error}`);
      navigate('/channels');
      return;
    }

    if (code) {
      exchangeToken();
    } else {
      navigate('/channels');
    }
  }, [code, error, exchangeToken, navigate]);

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center font-sans p-6 text-[#1d1d1f]">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <h3 className="text-sm font-semibold text-black tracking-tight mt-2">Connecting YouTube...</h3>
          <p className="text-[#8e8e93] text-[11px] leading-relaxed max-w-xs">
            We are securely exchanging your authorization code so scheduled uploads can run in the background.
          </p>
        </div>
      </div>
    </div>
  );
};

export default YoutubeCallback;
