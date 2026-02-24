import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('tactile_token');
    if (token) {
      api.getMe()
        .then((data) => {
          setUser(data.user);
          setTeacherProfile(data.teacherProfile);
        })
        .catch(() => {
          localStorage.removeItem('tactile_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('tactile_token', data.token);
    setUser(data.user);
    return data;
  };

  const register = async (formData) => {
    const data = await api.register(formData);
    localStorage.setItem('tactile_token', data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('tactile_token');
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
