import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUser({ ...session.user, ...userData });
        }
      } catch (e) {
        console.error('❌ Session error:', e);
      } finally {
        setLoading(false);
      }
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        setUser({ ...session.user, ...userData });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, fullName, phone, role) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone, role },
      },
    });
    if (error) {
      console.error('❌ signUp error:', error);
      throw error;
    }
    if (data.user) {
      const { error: insertError } = await supabase
        .from('users')
        .insert([{ id: data.user.id, email, full_name: fullName, phone, role }]);
      if (insertError) {
        console.error('❌ insert error:', insertError);
        throw insertError;
      }
    }
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};