import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('tw_token') || null);
  const [loading, setLoading] = useState(true);

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
      const response = await fetch('http://localhost:5001/api/auth/me', {
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
      const response = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
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
      const response = await fetch('http://localhost:5001/api/auth/facebook-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, redirectUri }),
      });

      if (response.ok) {
        const data = await response.json();
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
    setToken(null);
    setUser(null);
    setLoading(false);
  };

  const updateProfile = async (userData) => {
    try {
      const response = await fetch('http://localhost:5001/api/auth/me', {
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
      const response = await fetch('http://localhost:5001/api/auth/me', {
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
    <AuthContext.Provider value={{ user, token, loading, login, facebookLogin, logout, updateProfile, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
