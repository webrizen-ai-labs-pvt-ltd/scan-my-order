import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Skeleton
} from '@smo/ui';
import {
  Calendar01Icon,
  Clock01Icon,
  UserGroupIcon,
  Call02Icon,
  PlusSignIcon,
  Tick02Icon,
  Cancel01Icon,
  AlertCircleIcon,
  Store01Icon,
  Search01Icon,
  Restaurant01Icon,
  InformationCircleIcon,
  Delete02Icon
} from 'hugeicons-react';

const STATUS_COLORS = {
  CONFIRMED: {
    label: 'Confirmed',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500'
  },
  SEATED: {
    label: 'Seated',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    dot: 'bg-blue-500'
  },
  COMPLETED: {
    label: 'Completed',
    badge: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
    dot: 'bg-zinc-400'
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    dot: 'bg-red-500'
  },
  NO_SHOW: {
    label: 'No Show',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    dot: 'bg-amber-500'
  }
};

export const Reservations = () => {
  const { user, token } = useAuthStore();

  // Stores
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('');

  // Active Date Filter (Default: today in YYYY-MM-DD local format)
  const getTodayStr = () => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  };
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  // Status & Search filters
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Data & Loading
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Reservation Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form inputs
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [bookingDate, setBookingDate] = useState(getTodayStr());
  const [bookingTime, setBookingTime] = useState('19:30');
  const [durationMinutes, setDurationMinutes] = useState('90');
  const [selectedTableId, setSelectedTableId] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  // Table availability
  const [availableTables, setAvailableTables] = useState([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // Fetch stores for multi-store staff
  useEffect(() => {
    const fetchStores = async () => {
      try {
        const res = await api.get('/stores');
        if (res.data.success && res.data.data.length > 0) {
          setStores(res.data.data);
          const initial = user?.storeId || res.data.data[0].id;
          setSelectedStoreId(initial);
        }
      } catch (err) {
        console.error('Failed to load stores:', err);
      }
    };
    fetchStores();
  }, [user]);

  // Check URL parameters (e.g. from floor plan quick-book button)
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const tableIdParam = searchParams.get('tableId');
    const isNew = searchParams.get('new');
    if (tableIdParam || isNew) {
      if (tableIdParam) {
        setSelectedTableId(tableIdParam);
      }
      setIsModalOpen(true);
    }
  }, [searchParams]);

  // Fetch reservations for the selected store and date
  const fetchReservations = useCallback(async (silent = false) => {
    if (!selectedStoreId) return;
    if (!silent) setLoading(true);
    setError('');

    try {
      const res = await api.get(`/stores/${selectedStoreId}/reservations`, {
        params: {
          date: selectedDate
        }
      });
      if (res.data.success) {
        setReservations(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load reservations:', err);
      setError(err.response?.data?.error?.message || 'Failed to load reservations');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedStoreId, selectedDate]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  // Live SSE listener for real-time reservation updates
  useEffect(() => {
    if (!selectedStoreId || !token) return;

    let eventSource;
    try {
      const sseUrl = `${api.defaults.baseURL}/stores/${selectedStoreId}/orders/stream?token=${encodeURIComponent(token)}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (
            payload.type === 'RESERVATION_CREATED' ||
            payload.type === 'RESERVATION_UPDATED' ||
            payload.type === 'RESERVATION_DELETED'
          ) {
            fetchReservations(true);
          }
        } catch {
          // ignore non-json ping messages
        }
      };
    } catch (err) {
      console.error('SSE initialization error in reservations:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [selectedStoreId, token, fetchReservations]);

  // Query table availability whenever booking date, time, duration or store changes
  useEffect(() => {
    if (!isModalOpen || !selectedStoreId || !bookingDate || !bookingTime) return;

    const checkAvailability = async () => {
      setCheckingAvailability(true);
      try {
        const startsAt = new Date(`${bookingDate}T${bookingTime}:00`).toISOString();
        const res = await api.get(`/stores/${selectedStoreId}/reservations/availability`, {
          params: {
            startsAt,
            durationMinutes,
            partySize
          }
        });
        if (res.data.success) {
          setAvailableTables(res.data.data);
          // Auto-select first available table if currently selected is unavailable
          const currentTableValid = res.data.data.find(t => t.tableId === selectedTableId && t.isAvailable);
          if (!currentTableValid) {
            const firstAvailable = res.data.data.find(t => t.isAvailable);
            setSelectedTableId(firstAvailable ? firstAvailable.tableId : '');
          }
        }
      } catch (err) {
        console.error('Failed to check availability:', err);
      } finally {
        setCheckingAvailability(false);
      }
    };

    const timer = setTimeout(checkAvailability, 250);
    return () => clearTimeout(timer);
  }, [isModalOpen, selectedStoreId, bookingDate, bookingTime, durationMinutes, partySize]);

  // Open modal with clean defaults
  const handleOpenModal = () => {
    setGuestName('');
    setGuestPhone('');
    setPartySize('2');
    setBookingDate(selectedDate);
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    setBookingTime(`${hours}:${mins}`);
    setDurationMinutes('90');
    setSelectedTableId('');
    setBookingNotes('');
    setModalError('');
    setIsModalOpen(true);
  };

  // Submit new reservation
  const handleCreateReservation = async (e) => {
    e.preventDefault();
    if (!selectedTableId || !guestName.trim() || !guestPhone.trim()) {
      setModalError('Please enter guest name, phone, and select a table.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      const startsAt = new Date(`${bookingDate}T${bookingTime}:00`).toISOString();
      await api.post(`/stores/${selectedStoreId}/reservations`, {
        tableId: selectedTableId,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        partySize: parseInt(partySize, 10) || 2,
        startsAt,
        durationMinutes: parseInt(durationMinutes, 10) || 90,
        notes: bookingNotes.trim() || null
      });

      setIsModalOpen(false);
      fetchReservations(true);
    } catch (err) {
      setModalError(err.response?.data?.error?.message || 'Failed to create reservation');
    } finally {
      setSubmitting(false);
    }
  };

  // Status updates
  const handleUpdateStatus = async (reservationId, newStatus) => {
    try {
      await api.patch(`/stores/${selectedStoreId}/reservations/${reservationId}`, {
        status: newStatus
      });
      fetchReservations(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to update status');
    }
  };

  // Delete / cancel
  const handleDeleteReservation = async (reservationId) => {
    if (!window.confirm('Are you sure you want to delete this reservation?')) return;
    try {
      await api.delete(`/stores/${selectedStoreId}/reservations/${reservationId}`);
      fetchReservations(true);
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete reservation');
    }
  };

  // Filtered reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter((r) => {
      if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.guestName?.toLowerCase().includes(q);
        const matchesPhone = r.guestPhone?.includes(q);
        const matchesTable = String(r.table?.tableNumber).includes(q);
        if (!matchesName && !matchesPhone && !matchesTable) return false;
      }
      return true;
    });
  }, [reservations, selectedStatus, searchQuery]);

  // Key metrics
  const totalBookings = reservations.length;
  const confirmedCount = reservations.filter((r) => r.status === 'CONFIRMED').length;
  const seatedCount = reservations.filter((r) => r.status === 'SEATED').length;
  const totalGuests = reservations
    .filter((r) => r.status === 'CONFIRMED' || r.status === 'SEATED')
    .reduce((sum, r) => sum + (r.partySize || 2), 0);

  // Quick Date Helpers
  const isToday = selectedDate === getTodayStr();
  const setQuickDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header & Store Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-3">
            Table Reservations
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20">
              <Calendar01Icon size={14} />
              Host Desk
            </span>
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Pre-book tables, check capacity, resolve conflicts, and seat guests.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {stores.length > 1 && (
            <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
              <SelectTrigger className="w-[180px] h-9 text-xs font-medium">
                <Store01Icon size={14} className="mr-1.5 text-zinc-400" />
                <SelectValue placeholder="Select Store" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button onClick={handleOpenModal} className="h-9 gap-1.5 bg-pink-600 hover:bg-pink-700 text-white font-semibold">
            <PlusSignIcon size={16} />
            New Reservation
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">Bookings for Date</span>
          <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50 mt-1">{totalBookings}</div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">{selectedDate}</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Confirmed</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{confirmedCount}</div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Awaiting arrival</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Seated</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{seatedCount}</div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Currently dining</span>
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <span className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wider block">Expected Guests</span>
          <div className="text-2xl font-black text-pink-600 dark:text-pink-400 mt-1">{totalGuests}</div>
          <span className="text-[11px] text-zinc-500 mt-0.5 block">Total covers</span>
        </div>
      </div>

      {/* Date Navigator & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setQuickDate(0)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isToday
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setQuickDate(1)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
          >
            Tomorrow
          </button>
          <div className="flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 bg-white dark:bg-zinc-950">
            <Calendar01Icon size={14} className="text-zinc-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs bg-transparent border-none outline-none text-zinc-800 dark:text-zinc-200 font-medium"
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search01Icon size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <Input
            placeholder="Search name, phone, table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs w-full"
          />
        </div>
      </div>

      {/* Status Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {['ALL', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'].map((statusKey) => {
          const isActive = selectedStatus === statusKey;
          const count = statusKey === 'ALL'
            ? reservations.length
            : reservations.filter((r) => r.status === statusKey).length;

          return (
            <button
              key={statusKey}
              onClick={() => setSelectedStatus(statusKey)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-transparent shadow-sm'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <span>{statusKey === 'ALL' ? 'All Bookings' : STATUS_COLORS[statusKey]?.label || statusKey}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white dark:bg-zinc-900/30 dark:text-zinc-900 font-bold' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center gap-2">
          <AlertCircleIcon size={16} />
          {error}
        </div>
      )}

      {/* Reservations List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredReservations.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/20">
          <Calendar01Icon size={44} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">No reservations found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No bookings match "${searchQuery}".`
              : `No ${selectedStatus === 'ALL' ? '' : selectedStatus.toLowerCase()} reservations recorded for this date.`}
          </p>
          <Button onClick={handleOpenModal} size="sm" className="mt-4 gap-1.5 bg-pink-600 hover:bg-pink-700 text-white">
            <PlusSignIcon size={14} /> Add Reservation
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReservations.map((res) => {
            const statusConfig = STATUS_COLORS[res.status] || STATUS_COLORS.CONFIRMED;
            const startTime = new Date(res.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endTime = new Date(res.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <Card
                key={res.id}
                className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <CardContent className="p-5 space-y-4">
                  {/* Top Bar: Table & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 font-black text-sm flex flex-col items-center justify-center leading-none">
                        <span className="text-[8px] uppercase tracking-wider font-semibold opacity-70">T</span>
                        {res.table?.tableNumber || '?'}
                      </div>
                      <div>
                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          Table {res.table?.tableNumber}
                        </span>
                        <span className="text-[11px] text-zinc-400 block">
                          Capacity: {res.table?.capacity || 4} Seats
                        </span>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Guest Info */}
                  <div className="space-y-1.5 text-xs">
                    <div className="font-extrabold text-base text-zinc-900 dark:text-zinc-100">
                      {res.guestName}
                    </div>
                    <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 flex-wrap">
                      <a
                        href={`tel:${res.guestPhone}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                      >
                        <Call02Icon size={13} />
                        {res.guestPhone}
                      </a>
                      <span className="inline-flex items-center gap-1 font-medium text-zinc-600 dark:text-zinc-300">
                        <UserGroupIcon size={13} />
                        {res.partySize || res.table?.capacity || 2} Guests
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 px-2.5 py-1 rounded-lg font-semibold mt-1">
                      <Clock01Icon size={13} className="text-zinc-400" />
                      <span>{startTime} - {endTime}</span>
                    </div>

                    {res.notes && (
                      <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 italic text-[11px] mt-2">
                        "{res.notes}"
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {res.status === 'CONFIRMED' && (
                        <Button
                          onClick={() => handleUpdateStatus(res.id, 'SEATED')}
                          size="sm"
                          className="h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-700 text-white gap-1"
                        >
                          <Tick02Icon size={13} /> Seat
                        </Button>
                      )}

                      {res.status === 'SEATED' && (
                        <Button
                          onClick={() => handleUpdateStatus(res.id, 'COMPLETED')}
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs px-2.5 gap-1"
                        >
                          <Tick02Icon size={13} /> Finish
                        </Button>
                      )}

                      {res.status === 'CONFIRMED' && (
                        <Button
                          onClick={() => handleUpdateStatus(res.id, 'NO_SHOW')}
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-300"
                        >
                          No Show
                        </Button>
                      )}

                      {(res.status === 'CONFIRMED' || res.status === 'SEATED') && (
                        <Button
                          onClick={() => handleUpdateStatus(res.id, 'CANCELLED')}
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteReservation(res.id)}
                      className="text-zinc-400 hover:text-red-500 p-1.5 rounded transition-colors"
                      title="Delete Record"
                    >
                      <Delete02Icon size={15} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Reservation Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Calendar01Icon size={20} className="text-pink-600" />
              Pre-Book Table
            </DialogTitle>
            <DialogDescription className="text-xs">
              Check real-time table availability and record reservations without double-booking.
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="p-3 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
              <AlertCircleIcon size={16} className="shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <form onSubmit={handleCreateReservation} className="space-y-4 pt-2">
            {/* Guest Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Guest Full Name *</Label>
                <Input
                  required
                  placeholder="e.g. John Doe"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Contact Phone *</Label>
                <Input
                  required
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Date, Time & Duration */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Date *</Label>
                <Input
                  required
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Time *</Label>
                <Input
                  required
                  type="time"
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Duration</Label>
                <Select value={durationMinutes} onValueChange={setDurationMinutes}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 Hour</SelectItem>
                    <SelectItem value="90">1.5 Hours</SelectItem>
                    <SelectItem value="120">2 Hours</SelectItem>
                    <SelectItem value="150">2.5 Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Party Size & Table Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Guests / Covers *</Label>
                <Input
                  type="number"
                  min="1"
                  max="40"
                  required
                  value={partySize}
                  onChange={(e) => setPartySize(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Select Table *</Label>
                  {checkingAvailability && (
                    <span className="text-[10px] text-zinc-400">Checking...</span>
                  )}
                </div>
                <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTables.map((tbl) => {
                      const isAvail = tbl.isAvailable;
                      return (
                        <SelectItem
                          key={tbl.tableId}
                          value={tbl.tableId}
                          disabled={!isAvail}
                          className={!isAvail ? 'opacity-50' : ''}
                        >
                          Table {tbl.tableNumber} ({tbl.capacity} seats) {isAvail ? '✓ Available' : '⚠️ Booked'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table conflict notice if table is conflicted */}
            {selectedTableId && availableTables.find(t => t.tableId === selectedTableId && !t.isAvailable) && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <InformationCircleIcon size={16} className="shrink-0" />
                <span>Selected table already has an active booking in this time frame. Please pick another table.</span>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Special Notes / Dietary Requests</Label>
              <Input
                placeholder="e.g. Window booth preferred, Birthday celebration"
                value={bookingNotes}
                onChange={(e) => setBookingNotes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !selectedTableId}
                className="bg-pink-600 hover:bg-pink-700 text-white font-semibold"
              >
                {submitting ? 'Confirming...' : 'Confirm Reservation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reservations;
