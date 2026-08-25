import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { Button, Input, Label, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@smo/ui';
import { AnimatedThemeToggler } from '@smo/ui';
import { startAuthentication } from '@simplewebauthn/browser';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data.success) {
        login(response.data.data.user, response.data.data.token);
        navigate('/');
      } else {
        setError(response.data.error?.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Get authentication options from backend (no email needed for discoverable credentials)
      const optionsRes = await api.post('/auth/passkeys/auth-options', { email: email || undefined });
      if (!optionsRes.data.success) {
        throw new Error(optionsRes.data.error?.message || 'Failed to get passkey options');
      }

      // Extract challengeToken to pass back during verification
      const { challengeToken, ...optionsJSON } = optionsRes.data.data;

      // 2. Prompt user to authenticate
      const asseResp = await startAuthentication({ optionsJSON });

      // 3. Verify authentication with backend
      const verifyRes = await api.post('/auth/passkeys/authenticate', {
        response: asseResp,
        challengeToken
      });

      if (verifyRes.data.success) {
        login(verifyRes.data.data.user, verifyRes.data.data.token);
        navigate('/');
      } else {
        throw new Error(verifyRes.data.error?.message || 'Passkey login failed');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error?.message || err.message || 'Passkey authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-zinc-50 dark:bg-zinc-950 font-sans">
      <div className="flex-1 hidden lg:flex flex-col relative overflow-hidden bg-zinc-900">
        <img
          src="https://i.pinimg.com/736x/b0/c9/7b/b0c97b311781a0875920679fd969fd0d.jpg"
          alt="Background"
          className="absolute inset-0 w-full h-full object-cover grayscale opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent" />
        <div className="relative z-10 p-12 mt-auto text-zinc-100">
          <h1 className="text-4xl font-elsie mb-4">Scan My Order</h1>
          <p className="text-lg text-zinc-400 max-w-md">Centralized Control for Restaurant Operations. Manage your multi-location dining ecosystem seamlessly.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center p-8 relative">
        <div className="absolute top-4 right-4"><AnimatedThemeToggler /></div>
        <Card className="w-full max-w-md border-0 shadow-none bg-transparent">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-6 lg:hidden">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-purple-500 rounded-xl blur-lg opacity-20"></div>
                <img src="/logo.png" alt="Logo" className="relative h-14 w-auto dark:invert transition-transform duration-300 hover:scale-105" />
              </div>
            </div>

            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
                Welcome back
              </CardTitle>
              <CardDescription className="text-sm text-zinc-500 dark:text-zinc-400">
                Enter your credentials to access the Admin OS
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-3 p-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg animate-in slide-in-from-top-2 duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col w-full">
                <div className="relative group">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors pointer-events-none">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@scanmyorder.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-4 bg-white/10 rounded-none rounded-t-3xl shadow-none placeholder:text-zinc-400 text-white focus:bg-white/15 transition-colors outline-none"
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="h-px bg-zinc-600" />

                <div className="relative group">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-zinc-300 transition-colors pointer-events-none">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                  </svg>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-4 bg-white/10 rounded-none rounded-b-3xl shadow-none placeholder:text-zinc-400 text-white focus:bg-white/15 transition-colors outline-none"
                    required
                    autoComplete="current-password"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => { setShowPassword(!showPassword) }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>

                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>

                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4 text-yellow-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Sign In with Password
                  </span>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-zinc-950 px-2 text-zinc-500">
                    Or continue with
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="link"
                disabled={loading}
                onClick={handlePasskeyLogin}
                className="w-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" />
                </svg>

                Sign in with Passkey
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};