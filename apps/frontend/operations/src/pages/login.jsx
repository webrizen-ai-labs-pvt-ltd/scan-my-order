import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { Input, Button, AnimatedThemeToggler } from '@smo/ui';
import { startAuthentication } from '@simplewebauthn/browser';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [touched, setTouched] = useState({ email: false, password: false });
  
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  // Auto-dismiss error/success messages
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 8000);
      return () => clearTimeout(timer);
    }
    if (success) {
      const timer = setTimeout(() => setSuccess(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Validation
  const validateField = (field, value) => {
    if (field === 'email') {
      if (!value) return 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
    }
    if (field === 'password') {
      if (!value) return 'Password is required';
      if (value.length < 6) return 'Password must be at least 6 characters';
    }
    return '';
  };

  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const error = validateField(field, field === 'email' ? email : password);
    setFieldErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleFieldChange = (field, value) => {
    if (field === 'email') setEmail(value);
    else setPassword(value);
    
    // Clear error on change
    setError('');
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateForm = () => {
    const emailError = validateField('email', email);
    const passwordError = validateField('password', password);
    setFieldErrors({ email: emailError, password: passwordError });
    setTouched({ email: true, password: true });
    return !emailError && !passwordError;
  };

  const handleLogin = async (e) => {
    // Prevent default form submission and page reload
    e.preventDefault();
    e.stopPropagation();
    
    // Clear previous messages
    setError('');
    setSuccess('');
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password,
      });

      if (response.data.success) {
        setSuccess('Login successful! Redirecting...');
        login(response.data.data.user, response.data.data.token);
        // Use navigate with replace to prevent back button issues
        setTimeout(() => navigate('/', { replace: true }), 500);
      } else {
        setError(response.data.error?.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      // Handle specific error cases
      if (err.code === 'ERR_NETWORK') {
        setError('Network error. Please check your internet connection.');
      } else if (err.response) {
        // The request was made and the server responded with a status code
        const status = err.response.status;
        const message = err.response.data?.error?.message;
        
        if (status === 401) {
          setError('Invalid email or password. Please check your credentials.');
        } else if (status === 403) {
          setError('Your account has been locked. Please contact support.');
        } else if (status === 429) {
          setError('Too many login attempts. Please try again later.');
        } else if (status === 500) {
          setError('Server error. Please try again later.');
        } else {
          setError(message || 'Login failed. Please try again.');
        }
      } else if (err.request) {
        // The request was made but no response was received
        setError('No response from server. Please check your connection.');
      } else {
        // Something happened in setting up the request
        setError(err.message || 'An unexpected error occurred.');
      }
      
      // Log error for debugging (but don't show to user)
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    // Clear previous messages
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const optionsRes = await api.post('/auth/passkeys/auth-options', { 
        email: email.trim() || undefined 
      });
      
      if (!optionsRes.data.success) {
        throw new Error(optionsRes.data.error?.message || 'Failed to get passkey options');
      }

      const { challengeToken, ...optionsJSON } = optionsRes.data.data;
      const asseResp = await startAuthentication({ optionsJSON });

      const verifyRes = await api.post('/auth/passkeys/authenticate', {
        response: asseResp,
        challengeToken
      });

      if (verifyRes.data.success) {
        setSuccess('Passkey authentication successful!');
        login(verifyRes.data.data.user, verifyRes.data.data.token);
        setTimeout(() => navigate('/', { replace: true }), 500);
      } else {
        throw new Error(verifyRes.data.error?.message || 'Passkey login failed');
      }
    } catch (err) {
      console.error('Passkey error:', err);
      
      // Handle specific passkey errors
      if (err.name === 'NotSupportedError') {
        setError('Your browser does not support passkeys. Please use a modern browser.');
      } else if (err.name === 'AbortError') {
        setError('Passkey authentication was cancelled.');
      } else if (err.name === 'SecurityError') {
        setError('Security error. Please ensure you are using HTTPS.');
      } else if (err.name === 'InvalidStateError') {
        setError('Passkey already used. Please try again.');
      } else if (err.code === 'ERR_NETWORK') {
        setError('Network error. Please check your connection.');
      } else {
        setError(err.message || err.response?.data?.error?.message || 'Passkey authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Toast notification component
  const Notification = ({ type, message, onClose }) => {
    const bgColor = type === 'error' 
      ? 'bg-red-500/10 border-red-500/20 text-red-400 dark:bg-red-500/20 dark:border-red-500/30' 
      : 'bg-green-500/10 border-green-500/20 text-green-400 dark:bg-green-500/20 dark:border-green-500/30';
    
    const icon = type === 'error' ? (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
    ) : (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
      </svg>
    );

    return (
      <div className={`mb-6 p-4 border rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 ${bgColor}`}>
        {icon}
        <span className="flex-1 text-sm">{message}</span>
        <button
          onClick={onClose}
          className="shrink-0 opacity-50 hover:opacity-100 transition-opacity focus:outline-none"
          aria-label="Dismiss notification"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className="h-screen bg-white dark:bg-zinc-950 grid md:grid-cols-[0.6fr_1fr] p-4 relative transition-colors duration-300">
      {/* Left Panel */}
      <div className="bg-zinc-50 dark:bg-zinc-800 rounded-l-3xl border-y-2 border-l-2 border-zinc-200 dark:border-zinc-700 flex justify-center items-center transition-colors duration-300 overflow-y-auto">
        <div className="max-w-xl mx-auto p-8 w-full">
          {/* Header */}
          <div className="space-y-2 mb-6">
            <Link to="/" className="py-3.5 flex flex-row items-center gap-3 group">
              <img 
                src="/logo.png" 
                alt="Scan My Order" 
                className="h-8 w-auto object-contain dark:invert" 
              />
              <div className="flex flex-col overflow-hidden">
                <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-colors">
                  Scan My Order
                </span>
                <span className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                  Operations OS
                </span>
              </div>
            </Link>

            <div className="pt-4">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white tracking-tight mb-2 transition-colors duration-300">
                Welcome Back
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Enter your credentials to access the administrative dashboard.
              </p>
            </div>
          </div>

          {/* Notifications */}
          {error && (
            <Notification 
              type="error" 
              message={error} 
              onClose={() => setError('')} 
            />
          )}
          {success && (
            <Notification 
              type="success" 
              message={success} 
              onClose={() => setSuccess('')} 
            />
          )}

          {/* Login Form */}
          <div className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              {/* Email Field */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors duration-300">
                  Email Address
                </label>
                <div>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    placeholder="Enter your email"
                    required
                    disabled={loading}
                    autoComplete="email"
                    className={`w-full bg-white dark:bg-zinc-950/50 border-zinc-300 dark:border-zinc-800 
                      focus-visible:ring-yellow-500/50 h-11 transition-all duration-200
                      ${touched.email && fieldErrors.email 
                        ? 'border-red-500 dark:border-red-500 focus-visible:ring-red-500/50' 
                        : 'hover:border-zinc-400 dark:hover:border-zinc-700'
                      }`}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  />
                  {touched.email && fieldErrors.email && (
                    <p id="email-error" className="mt-1 text-xs text-red-500 animate-in slide-in-from-top-1 duration-200">
                      {fieldErrors.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 transition-colors duration-300">
                    Password
                  </label>
                  <Link 
                    to="https://scanmyorder.com/support/forgot-password" 
                    className="text-sm text-yellow-600 dark:text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-400 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => handleFieldChange('password', e.target.value)}
                      onBlur={() => handleFieldBlur('password')}
                      placeholder="Enter your password"
                      required
                      disabled={loading}
                      autoComplete="current-password"
                      className={`w-full bg-white dark:bg-zinc-950/50 border-zinc-300 dark:border-zinc-800 
                        focus-visible:ring-yellow-500/50 h-11 pr-10 transition-all duration-200
                        ${touched.password && fieldErrors.password 
                          ? 'border-red-500 dark:border-red-500 focus-visible:ring-red-500/50' 
                          : 'hover:border-zinc-400 dark:hover:border-zinc-700'
                        }`}
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? "password-error" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors focus:outline-none p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {touched.password && fieldErrors.password && (
                    <p id="password-error" className="mt-1 text-xs text-red-500 animate-in slide-in-from-top-1 duration-200">
                      {fieldErrors.password}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="grid md:grid-cols-2 gap-3 pt-6">
                <Button
                  type="submit"
                  disabled={loading}
                  size="lg"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing In...
                    </span>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="link"
                  size="lg"
                  disabled={loading}
                  onClick={handlePasskeyLogin}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" />
                  </svg>
                  Continue with Passkey
                </Button>
              </div>
            </form>
          </div>

          {/* Security notice */}
          <div className="mt-6 p-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0 mt-0.5 text-yellow-500 dark:text-yellow-400">
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1zm3 8V5.5a3 3 0 1 0-6 0V9h6z" clipRule="evenodd" />
              </svg>
              <span>
                <b>Secure access:</b> This is a restricted system. Unauthorized access is prohibited and monitored.
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="bg-zinc-100 dark:bg-zinc-900 rounded-r-3xl border-y-2 border-r-2 border-zinc-200 dark:border-zinc-700 overflow-hidden relative h-full transition-colors duration-300">
        <img 
          src="https://i.pinimg.com/1200x/20/16/57/201657f3c93339ccb3f6b69a3a5091c6.jpg" 
          alt="Authentication" 
          className="w-full h-full object-cover object-bottom" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/50 via-transparent to-transparent" />
        <AnimatedThemeToggler className="absolute top-4 right-4" />
      </div>
    </div>
  );
};