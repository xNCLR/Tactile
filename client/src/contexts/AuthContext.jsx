import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount, try to fetch current user info from cookies
    api.getMe()
      .then((data) => {
        setUser(data.user);
        setTeacherProfile(data.teacherProfile);
      })
      .catch(() => {
        // User is not authenticated (no valid cookie)
        setUser(null);
        setTeacherProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    // Cookies are set by the server, just update local state
    setUser(data.user);
    setTeacherProfile(data.teacherProfile || null);
    return data;
  };

  const register = async (formData) => {
    const data = await api.register(formData);
    // Cookies are set by the server, just update local state
    setUser(data.user);
    setTeacherProfile(data.teacherProfile || null);
    return data;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      // Log error but clear local state anyway
      console.error('Logout error:', err);
    }
    // Clear local state
    setUser(null);
    setTeacherProfile(null);
  };

  const refreshUser = async () => {
    const data = await api.getMe();
    setUser(data.user);
    setTeacherProfile(data.teacherProfile);
  };

  return (
    <AuthContext.Provider value={{ user, teacherProfile, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
