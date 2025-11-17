import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Users,
  DollarSign,
  Eye,
  Calendar,
  MapPin,
  Edit,
  MoreVertical,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new Error(data?.error || data?.message || res.statusText);
  return data as T;
}

/* Charts data unchanged (demo visuals) */
const revenueData = [
  { month: 'Jul', revenue: 45000 },
  { month: 'Aug', revenue: 62000 },
  { month: 'Sep', revenue: 78000 },
  { month: 'Oct', revenue: 95000 },
  { month: 'Nov', revenue: 120000 },
];

const bookingsData = [
  { week: 'Week 1', bookings: 12 },
  { week: 'Week 2', bookings: 18 },
  { week: 'Week 3', bookings: 25 },
  { week: 'Week 4', bookings: 32 },
];

const statusColors: Record<string, string> = {
  live: 'bg-accent',
  upcoming: 'bg-secondary',
  ended: 'bg-neutral-400',
  confirmed: 'bg-accent',
  pending: 'bg-warning',
  paid: 'bg-accent',
  cancelled: 'bg-error',
};

type EventCard = {
  id: string;
  name: string;
  date: string;
  location: string;
  status: 'live' | 'upcoming' | 'ended';
  stallsSold: number;
  stallsTotal: number;
  revenue: number;
  views: number;
};

type OrgBookingRow = {
  id: string;
  creatorName: string;
  eventTitle: string;
  tier: string;
  amount: number;
  status: string;     // ui-friendly (lowercase)
  rawStatus: string;  // backend value (PENDING/PAID/CANCELLED/...)
  date: string;
};

type StallRow = {
  id: string;
  name: string;
  tier: string;
  price: number;
  qtyTotal: number;
  qtyLeft: number;
  specs?: string | null;
};

function formatDateRange(startAt: string, endAt: string) {
  try {
    const s = new Date(startAt);
    const e = new Date(endAt);
    const sStr = s.toLocaleDateString();
    const eStr = e.toLocaleDateString();
    return sStr === eStr ? sStr : `${sStr} - ${eStr}`;
  } catch {
    return `${startAt} - ${endAt}`;
  }
}

function normalizeStatus(s?: string): 'live' | 'upcoming' | 'ended' {
  const v = (s || '').toLowerCase();
  if (v.includes('up')) return 'upcoming';
  if (v.includes('end')) return 'ended';
  return 'live';
}

export function OrganizerDashboard() {
  // create-event dialog inputs
  const [open, setOpen] = useState(false);
  const [evName, setEvName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [venueName, setVenueName] = useState('');
  const [desc, setDesc] = useState('');
  const [cityId, setCityId] = useState('');
  const [tagsCsv, setTagsCsv] = useState('');
  const [creating, setCreating] = useState(false);

  // events
  const [loading, setLoading] = useState(true);
  const [myEvents, setMyEvents] = useState<EventCard[]>([]);
  const hasEvents = myEvents.length > 0;

  // bookings
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [orgBookings, setOrgBookings] = useState<OrgBookingRow[]>([]);
  const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);

  // KPIs (live from API, fallback to derived/demo if API not available)
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState<{
    revenue: string;
    sold: string;
    active: number;
    views: string;
  }>({
    revenue: '₹7,56,000',
    sold: '87 / 110',
    active: 3,
    views: '4,240',
  });

  // ====== STALLS STATE (per-event manage dialog) ======
  const [stallsDialogOpen, setStallsDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  const [stallsLoading, setStallsLoading] = useState(false);
  const [stalls, setStalls] = useState<StallRow[]>([]);
  const [stallSaving, setStallSaving] = useState(false);
  const [editingStallId, setEditingStallId] = useState<string | null>(null);
  const [stallName, setStallName] = useState('');
  const [stallTier, setStallTier] = useState('');
  const [stallPrice, setStallPrice] = useState('');
  const [stallQtyTotal, setStallQtyTotal] = useState('');
  const [stallSpecs, setStallSpecs] = useState('');

  // ====== BROADCAST STATE ======
  const [broadcastDialogOpen, setBroadcastDialogOpen] = useState(false);
  const [broadcastEventId, setBroadcastEventId] = useState<string | null>(null);
  const [broadcastEventName, setBroadcastEventName] = useState<string>('');
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);

  // ====== ROSTER EXPORT STATE ======
  const [rosterExportEventId, setRosterExportEventId] = useState<string | null>(null);

  const resetStallForm = () => {
    setEditingStallId(null);
    setStallName('');
    setStallTier('');
    setStallPrice('');
    setStallQtyTotal('');
    setStallSpecs('');
  };

  const derivedIfNeeded = useMemo(() => {
    if (!hasEvents) return stats;
    const revenueSum = myEvents.reduce((a, e) => a + (e.revenue || 0), 0);
    const stallsSold = myEvents.reduce((a, e) => a + (e.stallsSold || 0), 0);
    const stallsTotal = myEvents.reduce((a, e) => a + (e.stallsTotal || 0), 0) || 1;
    const views = myEvents.reduce((a, e) => a + (e.views || 0), 0);
    const active = myEvents.filter((e) => e.status !== 'ended').length;
    return {
      revenue: `₹${revenueSum.toLocaleString()}`,
      sold: `${stallsSold} / ${stallsTotal}`,
      active,
      views: views.toLocaleString(),
    };
  }, [myEvents, hasEvents, stats]);

  // Load events
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('jwt') || '';
        if (!token) {
          setLoading(false);
          return;
        }

        const resp = await jsonFetch<any>(`${API}/organizers/me/events?page=1&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const list: any[] = Array.isArray(resp) ? resp : resp?.items ?? [];

        const cards: EventCard[] = (list || []).map((e) => ({
          id: e.id,
          name: e.title,
          date: formatDateRange(e.startAt, e.endAt),
          location: e.venueName ? `${e.venueName}, ${e.cityId}` : `${e.cityId || ''}`.trim(),
          status: normalizeStatus(e.status),
          stallsSold: 0,
          stallsTotal: 0,
          revenue: 0,
          views: 0,
        }));

        setMyEvents(cards);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load events');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load bookings
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('jwt') || '';
        if (!token) {
          setBookingsLoading(false);
          return;
        }

        const resp = await jsonFetch<any>(`${API}/organizers/me/bookings?page=1&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const rows: any[] = resp?.items ?? resp ?? [];

        const mapped: OrgBookingRow[] = rows.map((r) => {
          const rawStatus = String(r.status || '');
          return {
            id: r.id,
            creatorName: r.creator?.name || r.creator?.email || 'Creator',
            eventTitle: r.event?.title || '—',
            tier: r.stall?.tier || r.stall?.name || '—',
            amount: r.amount ?? r.stall?.price ?? 0,
            status: rawStatus.toLowerCase(),
            rawStatus,
            date: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
          };
        });

        setOrgBookings(mapped);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load bookings');
      } finally {
        setBookingsLoading(false);
      }
    })();
  }, []);

  // Load stats
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('jwt') || '';
        if (!token) {
          setStatsLoading(false);
          return;
        }

        const resp = await jsonFetch<any>(`${API}/organizers/me/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp?.ok) {
          setStats({
            revenue: `₹${(resp.totalRevenue || 0).toLocaleString()}`,
            sold: `${resp.stallsSold || 0} / ${resp.stallsTotal || 0}`,
            active: resp.activeEvents || 0,
            views: '4,240', // no views metric in API yet; keep demo for now
          });
        }
      } catch (err: any) {
        // keep defaults
      } finally {
        setStatsLoading(false);
      }
    })();
  }, []);

  async function handleCreate() {
    if (!evName || !startDate || !endDate || !cityId) {
      toast.error('Please fill Event Name, Start, End, City');
      return;
    }
    setCreating(true);
    try {
      const token = localStorage.getItem('jwt') || '';
      const resp = await jsonFetch<{ ok: true; event: any }>(`${API}/events`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: evName,
          description: desc || '',
          startDate, // yyyy-mm-dd
          endDate,
          location: location || '',
          venueName: venueName || '',
          cityId,
          tags: tagsCsv.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });

      const e = resp.event;
      const newCard: EventCard = {
        id: e.id,
        name: e.title,
        date: formatDateRange(e.startAt, e.endAt),
        location: e.venueName ? `${e.venueName}, ${e.cityId}` : `${e.cityId || ''}`.trim(),
        status: normalizeStatus(e.status),
        stallsSold: 0,
        stallsTotal: 0,
        revenue: 0,
        views: 0,
      };
      setMyEvents((prev) => [newCard, ...prev]);

      toast.success('Event created successfully!');
      setOpen(false);
      setEvName('');
      setStartDate('');
      setEndDate('');
      setLocation('');
      setVenueName('');
      setDesc('');
      setCityId('');
      setTagsCsv('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  }

  const kpis = statsLoading
    ? { revenue: '—', sold: '—', active: '—' as any, views: '—' }
    : derivedIfNeeded;

  // ====== STALLS HELPERS ======

  async function refreshStalls(eventId: string) {
    setStallsLoading(true);
    try {
      const token = localStorage.getItem('jwt') || '';
      // list stalls (public endpoint)
      const data = await jsonFetch<StallRow[]>(`${API}/events/${eventId}/stalls`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setStalls(data || []);

      // recompute stallsSold / stallsTotal / revenue for that event card
      const total = data.reduce((sum, s) => sum + (s.qtyTotal || 0), 0);
      const sold = data.reduce(
        (sum, s) => sum + Math.max(0, (s.qtyTotal || 0) - (s.qtyLeft || 0)),
        0,
      );
      const revenue = data.reduce(
        (sum, s) =>
          sum + (s.price || 0) * Math.max(0, (s.qtyTotal || 0) - (s.qtyLeft || 0)),
        0,
      );

      setMyEvents((prev) =>
        prev.map((ev) =>
          ev.id === eventId
            ? { ...ev, stallsTotal: total, stallsSold: sold, revenue }
            : ev,
        ),
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load stalls');
    } finally {
      setStallsLoading(false);
    }
  }

  function openStallsManager(eventId: string, name: string) {
    setSelectedEventId(eventId);
    setSelectedEventName(name);
    resetStallForm();
    setStallsDialogOpen(true);
    void refreshStalls(eventId);
  }

  function startEditStall(stall: StallRow) {
    setEditingStallId(stall.id);
    setStallName(stall.name || '');
    setStallTier(stall.tier || '');
    setStallPrice(String(stall.price ?? ''));
    setStallQtyTotal(String(stall.qtyTotal ?? ''));
    setStallSpecs(stall.specs || '');
  }

  async function handleSaveStall() {
    if (!selectedEventId) return;
    if (!stallName || !stallPrice || !stallQtyTotal) {
      toast.error('Please fill Name, Price and Quantity');
      return;
    }

    const priceNum = Number(stallPrice);
    const qtyNum = Number(stallQtyTotal);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      toast.error('Invalid price');
      return;
    }
    if (!Number.isInteger(qtyNum) || qtyNum <= 0) {
      toast.error('Invalid quantity');
      return;
    }

    setStallSaving(true);
    try {
      const token = localStorage.getItem('jwt') || '';

      if (editingStallId) {
        // PATCH /stalls/stalls/:id  (router mounted at /stalls)
        await jsonFetch(`${API}/stalls/stalls/${editingStallId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: stallName,
            tier: stallTier || undefined,
            price: priceNum,
            qtyTotal: qtyNum,
            specs: stallSpecs || undefined,
          }),
        });
        toast.success('Stall updated');
      } else {
        // POST /stalls/events/:eventId/stalls
        await jsonFetch(`${API}/stalls/events/${selectedEventId}/stalls`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: stallName,
            tier: stallTier || undefined,
            price: priceNum,
            qtyTotal: qtyNum,
            specs: stallSpecs || undefined,
          }),
        });
        toast.success('Stall created');
      }

      resetStallForm();
      await refreshStalls(selectedEventId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save stall');
    } finally {
      setStallSaving(false);
    }
  }

  async function handleDeleteStall(id: string) {
    if (!selectedEventId) return;
    if (!confirm('Delete this stall? This cannot be undone.')) return;
    try {
      const token = localStorage.getItem('jwt') || '';
      // DELETE /stalls/stalls/:id
      await jsonFetch(`${API}/stalls/stalls/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Stall deleted');
      await refreshStalls(selectedEventId);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete stall');
    }
  }

  async function updateBookingStatus(id: string, newStatus: 'PENDING' | 'PAID' | 'CANCELLED') {
    try {
      setUpdatingBookingId(id);
      const token = localStorage.getItem('jwt') || '';
      await jsonFetch(`${API}/organizers/me/bookings/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus }),
      });

      setOrgBookings((rows) =>
        rows.map((b) =>
          b.id === id
            ? { ...b, rawStatus: newStatus, status: newStatus.toLowerCase() }
            : b,
        ),
      );
      toast.success(`Booking marked as ${newStatus.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update booking status');
    } finally {
      setUpdatingBookingId(null);
    }
  }

  // ====== ROSTER EXPORT ======
  async function exportRoster(eventId: string, eventName: string) {
    try {
      setRosterExportEventId(eventId);
      const token = localStorage.getItem('jwt') || '';
      const resp = await jsonFetch<any>(
        `${API}/organizers/me/events/${eventId}/roster`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const rows: any[] = resp?.rows ?? [];

      if (!rows.length) {
        toast.info('No bookings found for this event yet.');
        return;
      }

      const headers = [
        'bookingId',
        'status',
        'amount',
        'createdAt',
        'stallName',
        'stallTier',
        'creatorId',
        'creatorName',
        'creatorEmail',
      ];
      const csvLines = [
        headers.join(','),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const raw = row[h] ?? '';
              const val = String(raw).replace(/"/g, '""');
              return `"${val}"`;
            })
            .join(','),
        ),
      ];
      const csv = csvLines.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${eventName || 'event'}-roster.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Roster exported');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export roster');
    } finally {
      setRosterExportEventId(null);
    }
  }

  // ====== BROADCAST HELPERS ======
  function openBroadcastDialog(eventId: string, eventName: string) {
    setBroadcastEventId(eventId);
    setBroadcastEventName(eventName);
    setBroadcastSubject('');
    setBroadcastMessage('');
    setBroadcastDialogOpen(true);
  }

  async function handleSendBroadcast() {
    if (!broadcastEventId) return;
    if (!broadcastMessage.trim()) {
      toast.error('Message cannot be empty');
      return;
    }

    setBroadcastSending(true);
    try {
      const token = localStorage.getItem('jwt') || '';
      const resp = await jsonFetch<any>(
        `${API}/organizers/me/events/${broadcastEventId}/broadcast`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            subject: broadcastSubject || undefined,
            message: broadcastMessage.trim(),
          }),
        },
      );

      const count = resp?.recipientCount ?? 0;
      toast.success(
        count
          ? `Broadcast sent to ${count} creators (mock).`
          : 'Broadcast processed (no recipients yet).',
      );
      setBroadcastDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send broadcast');
    } finally {
      setBroadcastSending(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-neutral-900 mb-2">Organizer Dashboard</h1>
          <p className="text-neutral-600">Manage your events and track performance</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={18} />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>
                Fill in the details to create your event
              </DialogDescription>
            </DialogHeader>

            {/* same layout, now wired */}
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <Label htmlFor="event-name">Event Name</Label>
                <Input
                  id="event-name"
                  placeholder="e.g., Delhi Handmade Crafts Fair"
                  value={evName}
                  onChange={(e) => setEvName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="e.g., Delhi"
                    value={cityId}
                    onChange={(e) => setCityId(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="venue">Venue (optional)</Label>
                  <Input
                    id="venue"
                    placeholder="Venue name"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Venue name and address"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="Tell creators about your event..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma separated)</Label>
                <Input
                  id="tags"
                  placeholder="art, handmade, food"
                  value={tagsCsv}
                  onChange={(e) => setTagsCsv(e.target.value)}
                />
              </div>

              <Button className="w-full" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating…' : 'Create Event'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-accent/10 rounded-xl">
              <DollarSign className="text-accent" size={24} />
            </div>
            <Badge className="bg-accent/10 text-accent">+12%</Badge>
          </div>
          <p className="text-neutral-600 mb-1">Total Revenue</p>
          <div className="text-neutral-900">{kpis.revenue}</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-secondary/10 rounded-xl">
              <Users className="text-secondary" size={24} />
            </div>
            <Badge className="bg-secondary/10 text-secondary">+8%</Badge>
          </div>
          <p className="text-neutral-600 mb-1">Stalls Sold</p>
          <div className="text-neutral-900">{kpis.sold}</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <Calendar className="text-primary" size={24} />
            </div>
            <Badge className="bg-primary/10 text-primary">Active</Badge>
          </div>
          <p className="text-neutral-600 mb-1">Active Events</p>
          <div className="text-neutral-900">{kpis.active}</div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 bg-neutral-100 rounded-xl">
              <Eye className="text-neutral-700" size={24} />
            </div>
            <Badge className="bg-neutral-100 text-neutral-700">+18%</Badge>
          </div>
          <p className="text-neutral-600 mb-1">Total Views</p>
          <div className="text-neutral-900">{kpis.views}</div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-neutral-900 mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => `₹${value.toLocaleString()}`}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#F05A28"
                fill="#F05A28"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-neutral-900 mb-4">Bookings This Month</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={bookingsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="week" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="bookings" fill="#2EC4B6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Events & Bookings */}
      <Tabs defaultValue="events" className="w-full">
        <TabsList>
          <TabsTrigger value="events">My Events</TabsTrigger>
          <TabsTrigger value="bookings">Recent Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4 mt-6">
          {loading ? (
            <Card className="p-6 text-neutral-600">Loading events…</Card>
          ) : !hasEvents ? (
            <Card className="p-6 text-neutral-600">No events yet. Create your first event!</Card>
          ) : (
            <div className="space-y-4">
              {myEvents.map((event) => (
                <Card key={event.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-neutral-900">{event.name}</h4>
                        <Badge className={statusColors[event.status]}>
                          {event.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-neutral-600 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar size={16} />
                          <span>{event.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={16} />
                          <span>{event.location || '—'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Eye size={16} />
                          <span>{event.views} views</span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical size={18} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            openStallsManager(event.id, event.name)
                          }
                        >
                          Manage Stalls
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toast.info('Opening event editor...')}
                        >
                          <Edit size={16} className="mr-2" />
                          Edit Event
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toast.info('Opening analytics dashboard...')
                          }
                        >
                          View Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            exportRoster(event.id, event.name)
                          }
                          disabled={rosterExportEventId === event.id}
                        >
                          {rosterExportEventId === event.id
                            ? 'Exporting...'
                            : 'Export Roster'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            openBroadcastDialog(event.id, event.name)
                          }
                        >
                          Broadcast Message
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-error"
                          onClick={() =>
                            toast.error('Event cancellation requested')
                          }
                        >
                          Cancel Event
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-neutral-50 rounded-xl">
                      <p className="text-neutral-600 text-sm mb-1">Stalls Sold</p>
                      <div className="text-neutral-900">
                        {event.stallsSold}/{event.stallsTotal}
                      </div>
                      <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{
                            width: `${(event.stallsSold / Math.max(1, event.stallsTotal)) * 100}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    <div className="p-4 bg-neutral-50 rounded-xl">
                      <p className="text-neutral-600 text-sm mb-1">Revenue</p>
                      <div className="text-primary">
                        ₹{event.revenue.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-4 bg-neutral-50 rounded-xl">
                      <p className="text-neutral-600 text-sm mb-1">Fill Rate</p>
                      <div className="text-neutral-900">
                        {Math.round(
                          (event.stallsSold / Math.max(1, event.stallsTotal)) *
                            100,
                        )}
                        %
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bookings" className="mt-6">
          {bookingsLoading ? (
            <Card className="p-6 text-neutral-600">Loading bookings…</Card>
          ) : orgBookings.length === 0 ? (
            <Card className="p-6 text-neutral-600">No bookings yet.</Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.id}</TableCell>
                      <TableCell>{b.creatorName}</TableCell>
                      <TableCell>{b.eventTitle}</TableCell>
                      <TableCell>{b.tier}</TableCell>
                      <TableCell className="text-primary">
                        ₹{(b.amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[b.status] || 'bg-neutral-300'
                          }
                        >
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-neutral-600">
                        {b.date}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={updatingBookingId === b.id}
                            >
                              {updatingBookingId === b.id ? 'Updating…' : 'Update'}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => updateBookingStatus(b.id, 'PAID')}
                            >
                              Mark as Paid
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => updateBookingStatus(b.id, 'PENDING')}
                            >
                              Mark as Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-error"
                              onClick={() => updateBookingStatus(b.id, 'CANCELLED')}
                            >
                              Cancel Booking
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* BROADCAST DIALOG */}
      <Dialog open={broadcastDialogOpen} onOpenChange={setBroadcastDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Broadcast Message</DialogTitle>
            <DialogDescription>
              Send an update to all creators who have booked stalls for{' '}
              {broadcastEventName ? `"${broadcastEventName}"` : 'this event'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="broadcast-subject">Subject (optional)</Label>
              <Input
                id="broadcast-subject"
                placeholder="Schedule update, parking info, etc."
                value={broadcastSubject}
                onChange={(e) => setBroadcastSubject(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="broadcast-message">Message</Label>
              <Textarea
                id="broadcast-message"
                rows={5}
                placeholder="Write your message for booked creators..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSendBroadcast}
              disabled={broadcastSending}
            >
              {broadcastSending ? 'Sending…' : 'Send Broadcast'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* STALLS MANAGEMENT DIALOG */}
      <Dialog open={stallsDialogOpen} onOpenChange={setStallsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Stalls</DialogTitle>
            <DialogDescription>
              {selectedEventName
                ? `Configure stalls for "${selectedEventName}".`
                : 'Configure stalls for this event.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 max-h-[70vh] overflow-y-auto py-2">
            {/* Stall list */}
            <div>
              <h3 className="font-medium mb-3">Existing Stalls</h3>
              {stallsLoading ? (
                <Card className="p-4 text-neutral-600">Loading stalls…</Card>
              ) : stalls.length === 0 ? (
                <Card className="p-4 text-neutral-600">
                  No stalls configured yet. Add your first stall below.
                </Card>
              ) : (
                <Card className="p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Tier</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Left</TableHead>
                        <TableHead>Sold</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stalls.map((s) => {
                        const sold = Math.max(
                          0,
                          (s.qtyTotal || 0) - (s.qtyLeft || 0),
                        );
                        return (
                          <TableRow key={s.id}>
                            <TableCell>{s.name}</TableCell>
                            <TableCell>{s.tier}</TableCell>
                            <TableCell>
                              ₹{(s.price || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>{s.qtyTotal}</TableCell>
                            <TableCell>{s.qtyLeft}</TableCell>
                            <TableCell>{sold}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditStall(s)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-error"
                                onClick={() => handleDeleteStall(s.id)}
                              >
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </div>

            {/* Stall form */}
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-medium">
                {editingStallId ? 'Edit Stall' : 'Add New Stall'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="stall-name">Name</Label>
                  <Input
                    id="stall-name"
                    value={stallName}
                    onChange={(e) => setStallName(e.target.value)}
                    placeholder="Premium Stall"
                  />
                </div>
                <div>
                  <Label htmlFor="stall-tier">Tier</Label>
                  <Input
                    id="stall-tier"
                    value={stallTier}
                    onChange={(e) => setStallTier(e.target.value)}
                    placeholder="SILVER / GOLD / VIP"
                  />
                </div>
                <div>
                  <Label htmlFor="stall-price">Price (₹)</Label>
                  <Input
                    id="stall-price"
                    type="number"
                    value={stallPrice}
                    onChange={(e) => setStallPrice(e.target.value)}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label htmlFor="stall-qty">Total Quantity</Label>
                  <Input
                    id="stall-qty"
                    type="number"
                    value={stallQtyTotal}
                    onChange={(e) => setStallQtyTotal(e.target.value)}
                    placeholder="10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="stall-specs">Specs / Notes</Label>
                <Textarea
                  id="stall-specs"
                  rows={3}
                  value={stallSpecs}
                  onChange={(e) => setStallSpecs(e.target.value)}
                  placeholder="Table + chair included, corner stall, power backup…"
                />
              </div>
              <div className="flex justify-end gap-2">
                {editingStallId && (
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={resetStallForm}
                  >
                    Cancel edit
                  </Button>
                )}
                <Button onClick={handleSaveStall} disabled={stallSaving}>
                  {stallSaving
                    ? editingStallId
                      ? 'Saving…'
                      : 'Creating…'
                    : editingStallId
                    ? 'Save Changes'
                    : 'Add Stall'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
