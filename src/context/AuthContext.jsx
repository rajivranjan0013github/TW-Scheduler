import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { queryClient } from '../lib/queryClient';

const AuthContext = createContext(null);

const getHandlerPreviewContext = () => {
  try {
    return JSON.parse(sessionStorage.getItem('admin_view_context') || 'null');
  } catch {
    return null;
  }
};

const buildPreviewUser = (baseUser, previewContext) => {
  if (!baseUser || !previewContext || previewContext.viewAs !== 'account_handler') {
    return baseUser;
  }

  return {
    ...baseUser,
    _id: previewContext.userId || baseUser._id,
    name: previewContext.userName || baseUser.name,
    email: previewContext.userEmail || baseUser.email,
    avatar: previewContext.userAvatar || baseUser.avatar,
    userType: 'account_handler',
    role: previewContext.userRole || 'editor',
    __previewMode: 'handler',
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tw_token') || null);
  const [loading, setLoading] = useState(true);
  const [previewContextVersion, setPreviewContextVersion] = useState(0);

  const previewContext = getHandlerPreviewContext();
  const effectiveUser = buildPreviewUser(user, previewContext);

  useEffect(() => {
    // Validate local token
    if (token) {
      fetchUserProfile(token);
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async (authToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (credential, accessToken) => {
    setLoading(true);
    try {
      const body = credential ? { credential } : { accessToken };
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        queryClient.clear();
        localStorage.setItem('tw_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return true;
      }
      setLoading(false);
      return false;
    } catch (error) {
      console.error('Authentication request failed:', error);
      setLoading(false);
      return false;
    }
  };

  const facebookLogin = async (code, redirectUri) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/facebook-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, redirectUri }),
      });

      if (response.ok) {
        const data = await response.json();
        queryClient.clear();
        localStorage.setItem('tw_token', data.token);
        setToken(data.token);
        setUser(data.user);
        return true;
      }
      setLoading(false);
      return false;
    } catch (error) {
      console.error('Facebook authentication request failed:', error);
      setLoading(false);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('tw_token');
    queryClient.clear();
    sessionStorage.removeItem('admin_view_context');
    window.dispatchEvent(new CustomEvent('handler-preview-changed'));
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  useEffect(() => {
    const syncPreviewContext = () => {
      setPreviewContextVersion((version) => version + 1);
    };

    window.addEventListener('storage', syncPreviewContext);
    window.addEventListener('handler-preview-changed', syncPreviewContext);
    return () => {
      window.removeEventListener('storage', syncPreviewContext);
      window.removeEventListener('handler-preview-changed', syncPreviewContext);
    };
  }, []);

  const updateProfile = async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      return false;
    }
  };

  const deleteAccount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        logout();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to delete account:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user: effectiveUser, token, loading, login, facebookLogin, logout, updateProfile, deleteAccount, previewContextVersion }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
