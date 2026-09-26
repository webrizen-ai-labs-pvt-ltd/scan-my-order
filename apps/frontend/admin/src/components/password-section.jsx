import React, { useEffect, useState } from 'react';
import { Card, CardContent, Button, Input, Label } from '@smo/ui';
import { LockPasswordIcon, Loading03Icon, CheckmarkCircle02Icon, AlertCircleIcon, ViewIcon, ViewOffIcon } from 'hugeicons-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

const errorText = (err) => err?.response?.data?.error?.message || err?.message || 'Could not change the password';

/**
 * Change (or first set) the signed-in owner's password. Other staff are told to ask their
 * manager. Other devices are signed out on success; this one stays signed in.
 */
export const PasswordForm = () => {
  const { user, login } = useAuthStore();
  const [status, setStatus] = useState(null); // { canChange, hasPassword }
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });

  useEffect(() => {
    api.get('/auth/password')
      .then(res => setStatus(res.data.data))
      .catch(() => setStatus({ canChange: false, hasPassword: true }));
  }, []);

  const mismatch = confirm.length > 0 && next !== confirm;
  const valid = next.length >= 8 && next === confirm && (!status?.hasPassword || current.length > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setMsg({ text: '', error: false });
    try {
      const res = await api.post('/auth/password', { currentPassword: current || undefined, newPassword: next });
      // The old token was just revoked; keep this device signed in with the new one
      login(res.data.data.user ? { ...user, ...res.data.data.user } : user, res.data.data.token);
      setStatus(prev => ({ ...prev, hasPassword: true }));
      setCurrent('');
      setNext('');
      setConfirm('');
      setMsg({ text: 'Password updated. Your other devices have been signed out.', error: false });
    } catch (err) {
      setMsg({ text: errorText(err), error: true });
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return <div className="h-16 flex items-center text-zinc-400"><Loading03Icon size={18} className="animate-spin" /></div>;
  }
  if (!status.canChange) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Your password is managed by your manager. Ask them to reset it from Employee Management if you've forgotten it or think someone else knows it.
      </p>
    );
  }

  const type = show ? 'text' : 'password';

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 max-w-md">
      {msg.text && (
        <div role={msg.error ? 'alert' : 'status'} className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 border ${msg.error
          ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
          : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'}`}>
          {msg.error ? <AlertCircleIcon size={16} /> : <CheckmarkCircle02Icon size={16} />}
          {msg.text}
        </div>
      )}

      {status.hasPassword ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pw-current">Current password</Label>
          <Input id="pw-current" type={type} autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
        </div>
      ) : (
        <p className="text-xs text-zinc-500">You sign in with Google. Set a password to also sign in with your email.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pw-new">New password</Label>
          <Input id="pw-new" type={type} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} maxLength={128} />
          <span className={`text-xs ${next && next.length < 8 ? 'text-red-500' : 'text-zinc-500'}`}>At least 8 characters</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pw-confirm">Confirm new password</Label>
          <Input id="pw-confirm" type={type} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} maxLength={128} />
          {mismatch && <span className="text-xs text-red-500">Passwords don't match</span>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setShow(v => !v)} className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 flex items-center gap-1.5">
          {show ? <ViewOffIcon size={14} /> : <ViewIcon size={14} />} {show ? 'Hide' : 'Show'} passwords
        </button>
        <Button type="submit" disabled={!valid || busy} size="sm">
          {busy ? <Loading03Icon size={14} className="animate-spin" /> : status.hasPassword ? 'Change password' : 'Set password'}
        </Button>
      </div>
    </form>
  );
};

/** Stand-alone Settings section (heading + card) around the password form */
export const PasswordSection = ({ index = '03' }) => (
  <section className="space-y-4 pt-4">
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 font-mono">{index}</span>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
        <LockPasswordIcon size={16} className="text-zinc-500" />
        Password
      </h3>
      <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
    </div>
    <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <CardContent className="p-6"><PasswordForm /></CardContent>
    </Card>
  </section>
);
