import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  user: { email: string } | null;
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null);

  // Check localStorage on mount for existing auth
  useEffect(() => {
    const auth = localStorage.getItem('auth');
    if (auth) {
      try {
        const parsed = JSON.parse(auth);
        if (parsed.isAuthenticated && parsed.email) {
          setIsAuthenticated(true);
          setUser({ email: parsed.email });
        }
      } catch (e) {
        localStorage.removeItem('auth');
      }
    }
  }, []);

  const login = (email: string) => {
    setIsAuthenticated(true);
    setUser({ email });
    localStorage.setItem('auth', JSON.stringify({ email, isAuthenticated: true }));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('auth');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
