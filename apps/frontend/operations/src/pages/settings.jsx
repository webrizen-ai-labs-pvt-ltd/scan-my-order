import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startRegistration } from '@simplewebauthn/browser';
import { Button, Input, Label, Skeleton } from '@smo/ui';
import {
  UserIcon, Shield01Icon, Delete01Icon, PlusSignIcon, Loading03Icon,
  FingerPrintIcon, LaptopIcon, WorkflowSquare03Icon, Mail01Icon, Store01Icon,
  Building02Icon, Clock01Icon,
} from 'hugeicons-react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import { MaintenanceJobsManager } from '../components/maintenance/maintenance-jobs-manager';
import { PasswordForm } from '../components/password-section';
import { Notice, Panel, Row, SectionNav, SectionLayout, Stat } from '../components/settings-layout';

const ROLE_LABEL = {
  SUPER_ADMIN: 'Platform admin', TENANT_ADMIN: 'Brand owner', STORE_MANAGER: 'Store manager',
  CASHIER: 'Cashier', WAITER: 'Waiter', KITCHEN_STAFF: 'Kitchen staff',
};

const formatDate = (date, withTime = false) => {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' });
};

const initialsOf = (user) => (user?.name
  ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  : user?.email?.slice(0, 2).toUpperCase() || 'U');

const Avatar = ({ src, user, size = 'size-16', text = 'text-xl' }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  return src && !broken ? (
    <img src={src} alt="" onError={() => setBroken(true)} className={`${size} rounded-full object-cover border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900`} />
  ) : (
    <div className={`${size} ${text} rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold flex items-center justify-center`}>
      {initialsOf(user)}
    </div>
  );
};

/* ---------- Profile ---------- */

const ProfileTab = ({ user, updateUser }) => {
  const [name, setName] = useState(user?.name || '');
  const [photo, setPhoto] = useState(user?.profilePhoto || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });
  const dirty = name.trim() !== (user?.name || '') || photo.trim() !== (user?.profilePhoto || '');

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setMsg({ text: '', error: false });
    try {
      await api.patch(`/users/${user.id}`, { name: name.trim(), profilePhoto: photo.trim() });
      updateUser({ name: name.trim(), profilePhoto: photo.trim() });
      setMsg({ text: 'Profile saved.', error: false });
    } catch (error) {
      setMsg({ text: error.response?.data?.error?.message || 'Could not save your profile', error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save}>
      <Panel
        title="Profile"
        description="How you appear to your team across Scan My Order."
        footer={(
          <>
            {dirty && <span className="text-xs text-zinc-500 mr-auto">Unsaved changes</span>}
            <Button type="button" variant="outline" size="sm" disabled={!dirty || saving} onClick={() => { setName(user?.name || ''); setPhoto(user?.profilePhoto || ''); }}>Discard</Button>
            <Button type="submit" size="sm" disabled={!dirty || saving || !name.trim()}>
              {saving ? <Loading03Icon size={14} className="animate-spin" /> : 'Save changes'}
            </Button>
          </>
        )}
      >
        {msg.text && <div className="px-6 py-3"><Notice msg={msg} /></div>}

        <Row label="Photo" hint="Paste a link to a square image. Initials are shown when it's empty.">
          <div className="flex items-center gap-4">
            <Avatar src={photo.trim()} user={{ ...user, name }} />
            <div className="flex-1 flex flex-col gap-1.5">
              <Input id="photo" aria-label="Photo URL" value={photo} onChange={e => setPhoto(e.target.value)} placeholder="https://example.com/avatar.jpg" />
              {photo && <button type="button" onClick={() => setPhoto('')} className="self-start text-xs text-zinc-500 hover:text-red-600">Remove photo</button>}
            </div>
          </div>
        </Row>

        <Row label="Full name" hint="Shown on orders, audit logs and receipts you handle.">
          <Input id="name" value={name} onChange={e => setName(e.target.value)} maxLength={80} required className="max-w-md" />
        </Row>

        <Row label="Email" hint="Used to sign in. Contact support to change it.">
          <div className="flex items-center gap-2 max-w-md h-10 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-600 dark:text-zinc-400">
            <Mail01Icon size={15} className="text-zinc-400" /> {user?.email}
          </div>
        </Row>
      </Panel>
    </form>
  );
};

/* ---------- Security ---------- */

const SecurityTab = () => {
  const [passkeys, setPasskeys] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });

  const load = useCallback(async () => {
    try {
      const res = await api.get('/auth/passkeys');
      setPasskeys(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      setPasskeys([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const register = async () => {
    setRegistering(true);
    setMsg({ text: '', error: false });
    try {
      const options = (await api.get('/auth/passkeys/register-options')).data.data;
      let attestation;
      try {
        attestation = await startRegistration({ optionsJSON: options });
      } catch (error) {
        setMsg({ text: error.name === 'InvalidStateError' ? 'This device already has a passkey.' : `Passkey not added: ${error.message}`, error: true });
        return;
      }
      await api.post('/auth/passkeys/register', attestation);
      setMsg({ text: 'Passkey added.', error: false });
      load();
    } catch (error) {
      setMsg({ text: error.response?.data?.error?.message || 'Could not add the passkey', error: true });
    } finally {
      setRegistering(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this passkey? You can add it again later.')) return;
    try {
      await api.delete(`/auth/passkeys/${id}`);
      setPasskeys(prev => prev.filter(p => p.id !== id));
      setMsg({ text: 'Passkey removed.', error: false });
    } catch {
      setMsg({ text: 'Could not remove the passkey.', error: true });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Password" description="Changing your password signs you out on every other device.">
        <Row label="Sign-in password" hint="Brand owners manage their own password. Staff passwords are reset by their manager.">
          <PasswordForm />
        </Row>
      </Panel>

      <Panel title="Passkeys" description="Sign in with Touch ID, Face ID or Windows Hello instead of typing a password.">
        {msg.text && <div className="px-6 py-3"><Notice msg={msg} /></div>}
        <Row
          label="Your passkeys"
          hint="Add one on each device you use. Passkeys can't be phished or reused on other sites."
        >
          <div className="flex flex-col gap-3">
            {passkeys === null ? (
              <Skeleton className="h-14 w-full" />
            ) : passkeys.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-4 py-4">
                <FingerPrintIcon size={20} className="text-zinc-400 shrink-0" />
                <p className="text-sm text-zinc-500">No passkeys yet.</p>
              </div>
            ) : (
              <ul className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
                {passkeys.map(pk => (
                  <li key={pk.id} className="flex items-center gap-3 px-4 py-3">
                    <LaptopIcon size={18} className="text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Added {formatDate(pk.createdAt)}</p>
                      <p className="text-xs text-zinc-500">Last used {pk.lastUsedAt ? formatDate(pk.lastUsedAt, true) : 'never'}</p>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Remove passkey" onClick={() => remove(pk.id)} className="text-zinc-400 hover:text-red-600">
                      <Delete01Icon size={16} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={register} disabled={registering}>
                {registering ? <Loading03Icon size={14} className="animate-spin" /> : <PlusSignIcon size={14} />}
                <span className="ml-1.5">Add passkey</span>
              </Button>
            </div>
          </div>
        </Row>
      </Panel>
    </div>
  );
};

/* ---------- Page ---------- */

export const Settings = () => {
  const { user, updateUser } = useAuthStore();
  const [params, setParams] = useSearchParams();
  const canAutomate = ['SUPER_ADMIN', 'TENANT_ADMIN', 'STORE_MANAGER'].includes(user?.role);

  const tabs = [
    { id: 'profile', label: 'Profile', hint: 'Name, photo, email', icon: UserIcon },
    { id: 'security', label: 'Security', hint: 'Password, passkeys', icon: Shield01Icon },
    ...(canAutomate ? [{ id: 'automation', label: 'Automation', hint: 'Scheduled jobs', icon: WorkflowSquare03Icon }] : []),
  ];
  const active = tabs.some(t => t.id === params.get('tab')) ? params.get('tab') : 'profile';
  const setTab = (id) => setParams(id === 'profile' ? {} : { tab: id }, { replace: true });

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Account summary */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-6 py-5">
        <Avatar src={user?.profilePhoto} user={user} size="size-14" text="text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 truncate">{user?.name || user?.email}</h1>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
              {ROLE_LABEL[user?.role] || user?.role}
            </span>
          </div>
          <p className="text-sm text-zinc-500 truncate">{user?.email}</p>
        </div>
        <dl className="grid grid-cols-2 sm:flex gap-x-8 gap-y-2 text-sm">
          {user?.tenant?.name && (
            <Stat icon={Building02Icon} label="Brand">{user.tenant.name}</Stat>
          )}
          <Stat icon={Store01Icon} label="Store">{user?.store?.name || 'All stores'}</Stat>
          <Stat icon={Clock01Icon} label="Member since">{formatDate(user?.createdAt)}</Stat>
        </dl>
      </div>

      <SectionLayout nav={<SectionNav tabs={tabs} active={active} onChange={setTab} label="Settings sections" />}>
        {active === 'profile' && <ProfileTab key={user?.id} user={user} updateUser={updateUser} />}
        {active === 'security' && <SecurityTab />}
        {active === 'automation' && canAutomate && (
          <Panel title="Automation" description="Recurring jobs that keep tables, inventory and data tidy. Schedules and thresholds apply per store.">
            <div className="px-6 py-5"><MaintenanceJobsManager embedded /></div>
          </Panel>
        )}
      </SectionLayout>
    </div>
  );
};
