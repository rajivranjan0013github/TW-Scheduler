import React from 'react';
import { useAuth } from '../context/AuthContext';
import { GoogleLogin } from '@react-oauth/google';
import { Lock } from 'lucide-react';

export const Login = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center font-sans p-6 text-[#1d1d1f]">
      
      <div className="w-full max-w-sm space-y-8">
        
        {/* Simple typography title */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-black m-0">Creator Suite</h2>
          <p className="text-[#8e8e93] text-xs mt-1.5 font-normal">Campaign Coordination Hub</p>
        </div>

        {/* App Store Connect style white card */}
        <div className="bg-white border border-[#d2d2d7] rounded-xl p-6 space-y-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 pb-3 border-b border-[#e5e5ea]">
            <Lock className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-black">Sign in to Workspace</h3>
          </div>

          <div className="text-center py-2 space-y-4 flex flex-col items-center">
            <p className="text-xs text-gray-500 leading-relaxed m-0">
              Authenticate via Google to access connected channels, schedule campaign assets, and moderate user feedback.
            </p>

            <div className="w-full flex justify-center pt-2">
              <GoogleLogin
                onSuccess={async (credentialResponse) => {
                  const success = await login(credentialResponse.credential);
                  if (!success) {
                    alert('🔒 Workspace authentication failed. Please verify database connection or credentials.');
                  }
                }}
                onError={() => {
                  alert('🔒 Google Authentication Failed');
                }}
                useOneTap
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
export default Login;
