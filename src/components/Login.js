import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase/config';
import { Activity, Mail, Lock, AlertCircle } from 'lucide-react';
import { DesignTokens, combineClasses } from '../design/designTokens';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Create new user
        await createUserWithEmailAndPassword(auth, email, password);
        // User is automatically signed in after creation
      } else {
        // Sign in existing user
        await signInWithEmailAndPassword(auth, email, password);
      }
      // onLoginSuccess will be called automatically via auth state change
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onLoginSuccess will be called automatically via auth state change
    } catch (err) {
      setError(err.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-medical-primary-50 to-medical-secondary-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md animate-fade-scale">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-medical-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Activity className="w-8 h-8 text-medical-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-medical-neutral-900">CancerCare</h1>
          <p className="text-sm text-medical-neutral-600 mt-2">
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className={combineClasses('mb-4 p-3 rounded-lg flex items-start gap-2', DesignTokens.components.alert.error, DesignTokens.borders.radius.md)}>
            <AlertCircle className={combineClasses('w-5 h-5 flex-shrink-0 mt-0.5', DesignTokens.components.alert.text.error.replace('text-', 'text-').replace('800', '600'))} />
            <p className={combineClasses('text-sm', DesignTokens.components.alert.text.error)}>{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-medical-neutral-700 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-medical-neutral-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={combineClasses(DesignTokens.components.input.base, 'pl-10')}
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-medical-neutral-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-medical-neutral-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className={combineClasses(DesignTokens.components.input.base, 'pl-10')}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
            {isSignUp && (
              <p className="text-xs text-medical-neutral-500 mt-1">
                Password must be at least 6 characters
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={combineClasses(DesignTokens.components.button.primary, 'w-full shadow-sm')}
          >
            {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className={combineClasses('w-full border-t', DesignTokens.colors.neutral.border[200])}></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className={combineClasses('px-2 bg-white', DesignTokens.colors.neutral.text[500])}>Or continue with</span>
          </div>
        </div>

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className={combineClasses('w-full flex items-center justify-center gap-3 bg-white border-2 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.colors.neutral.border[200], DesignTokens.colors.neutral.text[700], `hover:${DesignTokens.colors.neutral[50]}`, `hover:${DesignTokens.colors.neutral.border[300]}`)}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        {/* Toggle Sign Up/Sign In */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            className="text-sm text-medical-primary-600 hover:text-medical-primary-700 font-medium"
            disabled={loading}
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>

        {/* Info Note */}
        <div className="mt-6 p-3 bg-medical-primary-50 border border-medical-primary-200 rounded-lg">
          <p className="text-xs text-medical-primary-700">
            <strong>Note:</strong> For first-time use, create an account. Your email will be used as your patient ID.
          </p>
        </div>
      </div>
    </div>
  );
}

