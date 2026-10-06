import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { Button, Badge, Card, CardContent } from '@smo/ui';
import { PlusSignIcon, Loading03Icon, Store01Icon, Location01Icon, QrCodeIcon } from 'hugeicons-react';

/** Malls, food courts and cinemas: counters from different brands behind one QR code */
export const Venues = () => {
  const [venues, setVenues] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/venues')
      .then(res => setVenues(res.data.data))
      .catch(err => {
        setVenues([]);
        setError(err?.response?.data?.error?.message || 'Could not load venues');
      });
  }, []);

  if (!venues) {
    return <div className="flex justify-center p-8"><Loading03Icon className="animate-spin text-zinc-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Venues</h2>
          <p className="text-zinc-500 dark:text-zinc-400">Malls, food courts and cinemas: one QR code shows every counter, guests pay on their phone and collect.</p>
        </div>
        <Button onClick={() => navigate('/venues/new')} className="flex shrink-0 items-center gap-2">
          <PlusSignIcon size={16} /> Add venue
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {venues.map(venue => (
          <Card key={venue.id} className="cursor-pointer transition-colors hover:border-zinc-300 dark:hover:border-zinc-700" onClick={() => navigate(`/venues/${venue.id}`)}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <QrCodeIcon size={20} className="text-yellow-600 dark:text-yellow-500" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">{venue.name}</h3>
                    <p className="truncate text-xs text-zinc-500">/v/{venue.slug}</p>
                  </div>
                </div>
                <Badge variant={venue.isActive ? 'default' : 'secondary'}>{venue.isActive ? 'LIVE' : 'HIDDEN'}</Badge>
              </div>
              <div className="mt-5 flex items-center gap-4 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <Store01Icon size={14} className="text-zinc-400" /> {venue.storeCount} {venue.storeCount === 1 ? 'counter' : 'counters'}
                </span>
                {venue.city && (
                  <span className="flex min-w-0 items-center gap-1.5 text-zinc-500">
                    <Location01Icon size={14} className="shrink-0" /> <span className="truncate">{venue.city}</span>
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {venues.length === 0 && !error && (
          <div className="col-span-full rounded-lg border-2 border-dashed border-zinc-200 py-12 text-center dark:border-zinc-800">
            <QrCodeIcon size={32} className="mx-auto mb-3 text-zinc-400" />
            <h3 className="text-lg font-medium">No venues yet</h3>
            <p className="mb-4 text-zinc-500">Add a mall or food court, then add the brands' stores as counters.</p>
            <Button onClick={() => navigate('/venues/new')}>Add venue</Button>
          </div>
        )}
      </div>
    </div>
  );
};
