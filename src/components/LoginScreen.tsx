import React, { useState } from 'react';
import { getSupabase } from '../lib/supabase';
import { UserProfile } from '../types';
import { ApiService } from '../lib/api';
import {
  Heart,
  Mail,
  Lock,
  User,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Users
} from 'lucide-react';

type AuthMode = 'login' | 'signup' | 'forgot_password';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  onExploreDemo?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onExploreDemo
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const resetFormFeedback = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSwitchMode = (newMode: AuthMode) => {
    resetFormFeedback();
    setMode(newMode);
  };

  // Helper to ensure profile exists and return UserProfile
  const syncProfileAndLogin = async (
    userId: string,
    userEmail: string,
    name?: string
  ): Promise<UserProfile> => {
    const supabase = getSupabase();
    const cleanName = name || userEmail.split('@')[0];
    const capitalizedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    let profileData: UserProfile | null = null;

    if (supabase) {
      try {
        // Check if user has an existing profile in Supabase profiles table
        const { data: existingProf, error: fetchErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (existingProf && !fetchErr) {
          profileData = {
            id: existingProf.id,
            email: existingProf.email || userEmail,
            displayName: existingProf.display_name || capitalizedName,
            username: existingProf.username || cleanName.toLowerCase(),
            avatarUrl:
              existingProf.avatar_url ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            dateOfBirth: existingProf.date_of_birth,
            timezone: existingProf.timezone || 'UTC',
            coupleId: existingProf.couple_id,
            createdAt: existingProf.created_at || new Date().toISOString(),
            updatedAt: existingProf.updated_at || new Date().toISOString()
          };
        } else {
          // Upsert new profile record in Supabase profiles table
          const newProfRecord = {
            id: userId,
            email: userEmail,
            display_name: capitalizedName,
            username: cleanName.toLowerCase().replace(/\s+/g, '') + '_' + userId.substring(0, 4),
            avatar_url:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            timezone: 'UTC',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { data: inserted, error: insertErr } = await supabase
            .from('profiles')
            .upsert(newProfRecord)
            .select()
            .maybeSingle();

          if (inserted && !insertErr) {
            profileData = {
              id: inserted.id,
              email: inserted.email,
              displayName: inserted.display_name,
              username: inserted.username,
              avatarUrl: inserted.avatar_url,
              timezone: inserted.timezone,
              coupleId: inserted.couple_id,
              createdAt: inserted.created_at,
              updatedAt: inserted.updated_at
            };
          }
        }
      } catch (profErr) {
        console.warn('Supabase profiles sync warning:', profErr);
      }
    }

    // Also sync with server-side sanctuary database
    try {
      const serverAuth = await ApiService.login(userEmail, password);
      if (serverAuth?.user) {
        return {
          ...serverAuth.user,
          id: userId || serverAuth.user.id,
          displayName: profileData?.displayName || serverAuth.user.displayName || capitalizedName
        };
      }
    } catch {
      // If server auth is unavailable, fall back to Supabase profile
    }

    if (profileData) {
      return profileData;
    }

    return {
      id: userId,
      email: userEmail,
      displayName: capitalizedName,
      username: cleanName.toLowerCase(),
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      timezone: 'UTC',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  // Submit Sign In
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    const supabase = getSupabase();

    try {
      if (!supabase) {
        throw new Error('Supabase client is not initialized. Please verify configuration.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) {
        // Helpful diagnostic messages for common Supabase auth issues
        if (error.message.toLowerCase().includes('email not confirmed')) {
          setErrorMsg(
            'Your email address has not been confirmed yet. Please check your inbox for the confirmation link from Supabase, or contact support.'
          );
        } else if (error.message.toLowerCase().includes('invalid login credentials')) {
          setErrorMsg('Invalid email or password. Please verify your credentials or create an account.');
        } else {
          setErrorMsg(error.message);
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        const userProfile = await syncProfileAndLogin(
          data.user.id,
          data.user.email || email.trim(),
          data.user.user_metadata?.display_name
        );
        onLoginSuccess(userProfile);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Sign Up
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    if (!email.trim() || !password) {
      setErrorMsg('Please enter an email and password to create an account.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your password.');
      return;
    }

    setIsLoading(true);
    const supabase = getSupabase();

    try {
      if (!supabase) {
        throw new Error('Supabase client is not initialized.');
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanDisplayName =
        displayName.trim() || cleanEmail.split('@')[0].charAt(0).toUpperCase() + cleanEmail.split('@')[0].slice(1);

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: cleanDisplayName
          }
        }
      });

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          setErrorMsg('Supabase email rate limit reached. Please wait a minute before requesting another confirmation.');
        } else {
          setErrorMsg(error.message);
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Upsert the profile into the public.profiles table
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: cleanEmail,
            display_name: cleanDisplayName,
            username: cleanDisplayName.toLowerCase().replace(/\s+/g, '') + '_' + data.user.id.substring(0, 4),
            avatar_url:
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            timezone: 'UTC',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn('Profile record upsert notice:', dbErr);
        }

        // If session exists right away (email confirmation disabled in Supabase project)
        if (data.session) {
          const userProfile = await syncProfileAndLogin(data.user.id, cleanEmail, cleanDisplayName);
          onLoginSuccess(userProfile);
          return;
        }

        // Email confirmation is enabled
        setSuccessMsg(
          `Account created for ${cleanEmail}! Please check your email for the confirmation link to complete registration.`
        );
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      setErrorMsg(err.message || 'An error occurred during account creation.');
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Forgot Password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    resetFormFeedback();

    if (!email.trim()) {
      setErrorMsg('Please enter your email address to receive password reset instructions.');
      return;
    }

    setIsLoading(true);
    const supabase = getSupabase();

    try {
      if (!supabase) {
        throw new Error('Supabase client is not initialized.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: window.location.origin
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg(
          `Password reset link sent to ${email.trim()}! Please check your email inbox to reset your password.`
        );
      }
    } catch (err: any) {
      console.error('Forgot password error:', err);
      setErrorMsg(err.message || 'Failed to send password reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick partner sign-in from Supabase registered profiles
  const handleQuickPartnerLogin = async (partnerKey: 'liam' | 'olivia') => {
    resetFormFeedback();
    setIsLoading(true);

    try {
      const registeredUsers = await ApiService.getAllProfiles();
      const targetUser =
        registeredUsers.find(u =>
          partnerKey === 'liam'
            ? u.displayName.toLowerCase().includes('liam') || u.email?.toLowerCase().includes('liam')
            : u.displayName.toLowerCase().includes('olivia') || u.email?.toLowerCase().includes('olivia')
        ) || registeredUsers[partnerKey === 'liam' ? 0 : 1] || registeredUsers[0];

      if (targetUser) {
        onLoginSuccess(targetUser);
      } else if (onExploreDemo) {
        onExploreDemo();
      }
    } catch (err) {
      console.error('Partner profile login error:', err);
      if (onExploreDemo) onExploreDemo();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-stone-900 flex flex-col justify-center items-center px-4 py-8 selection:bg-rose-100 selection:text-rose-900 font-sans">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-rose-100/80 p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 via-rose-400 to-amber-300 text-white shadow-md shadow-rose-200 mb-1">
            <Heart className="w-7 h-7 fill-white text-white animate-pulse" />
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900">
              My Space
            </h1>
            <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200/60">
              Us
            </span>
          </div>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            Your private couple sanctuary for shared books, cycle tracking, intimate chats, and memories.
          </p>
        </div>

        {/* Tab Switcher (Sign In vs Create Account) */}
        {mode !== 'forgot_password' && (
          <div className="grid grid-cols-2 p-1 bg-stone-100 rounded-2xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleSwitchMode('login')}
              className={`py-2 rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('signup')}
              className={`py-2 rounded-xl transition-all ${
                mode === 'signup'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Status Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{successMsg}</div>
          </div>
        )}

        {/* FORM: Sign In */}
        {mode === 'login' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="partner@myspace.love"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-stone-800 placeholder-stone-400 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('forgot_password')}
                  className="text-[11px] font-medium text-rose-600 hover:text-rose-700 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-stone-800 placeholder-stone-400 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-rose-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Enter Sanctuary</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* FORM: Sign Up */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Display Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Olivia, Liam, or My Love"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-stone-800 placeholder-stone-400 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-stone-800 placeholder-stone-400 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-stone-800 placeholder-stone-400 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-stone-800 placeholder-stone-400 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-700 hover:to-rose-600 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-rose-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create Sanctuary Account</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* FORM: Forgot Password */}
        {mode === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2.5">
              <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Enter your registered email address and we will send you a secure link to reset your sanctuary password.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white text-stone-800 placeholder-stone-400 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-900 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Sending Link...</span>
                </>
              ) : (
                <span>Send Password Reset Link</span>
              )}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => handleSwitchMode('login')}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1"
              >
                <span>Back to Sign In</span>
              </button>
            </div>
          </form>
        )}

        {/* Direct Partner Access from Supabase */}
        <div className="pt-4 border-t border-stone-100 space-y-3">
          <div className="text-center">
            <span className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
              Or Fast Explore with Registered Partners
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickPartnerLogin('liam')}
              className="px-3 py-2 rounded-xl bg-stone-50 hover:bg-rose-50/70 border border-stone-200 hover:border-rose-200 text-stone-700 hover:text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-rose-500" />
              <span>Log in as Liam</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickPartnerLogin('olivia')}
              className="px-3 py-2 rounded-xl bg-stone-50 hover:bg-rose-50/70 border border-stone-200 hover:border-rose-200 text-stone-700 hover:text-rose-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-rose-500" />
              <span>Log in as Olivia</span>
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Secured with Supabase Auth & PostgreSQL Row-Level Security</span>
          </div>
        </div>
      </div>
    </div>
  );
};
