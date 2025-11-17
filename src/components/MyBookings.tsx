import { useEffect, useMemo, useState } from "react";
import { Calendar, MapPin, Download, QrCode, Star, MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Separator } from "./ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

type BookingItem = {
  id: string;
  event: string;
  date?: string;           // human readable (fallback)
  dateStart?: string;      // ISO
  dateEnd?: string;        // ISO
  location?: string;
  tier: string;
  stallNumber?: string;
  amount: number;
  status: "confirmed" | "pending" | "completed" | "cancelled";
  qrCode?: string | null;
  reviewed?: boolean;
  rating?: number;
};

const statusColors: Record<BookingItem["status"], string> = {
  confirmed: "bg-accent",
  pending: "bg-warning",
  completed: "bg-neutral-400",
  cancelled: "bg-error",
};

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/** --- tiny local helpers (no new files) --- */
function getToken(): string | null {
  try {
    // support both keys used elsewhere in the app
    return localStorage.getItem("jwt") || localStorage.getItem("sharthi_token");
  } catch {
    return null;
  }
}
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try { const t = await res.json(); msg = (t?.error || t?.message || msg); } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ---- seed (fallback) ----
const seedUpcoming: BookingItem[] = [
  {
    id: "BK-1234",
    event: "Delhi Handmade Crafts Fair",
    date: "Nov 15-17, 2025",
    location: "Pragati Maidan, Delhi",
    tier: "Premium",
    stallNumber: "#12",
    amount: 8000,
    status: "confirmed",
    qrCode: null,
  },
  {
    id: "BK-1235",
    event: "Mumbai Art Festival",
    date: "Dec 1-5, 2025",
    location: "Nehru Centre, Mumbai",
    tier: "VIP",
    stallNumber: "#5",
    amount: 12000,
    status: "confirmed",
    qrCode: null,
  },
];

const seedPast: BookingItem[] = [
  {
    id: "BK-1122",
    event: "Bangalore Crafts Week",
    date: "Oct 20-22, 2025",
    location: "BIEC, Bangalore",
    tier: "Premium",
    stallNumber: "#18",
    amount: 8000,
    status: "completed",
    reviewed: false,
  },
  {
    id: "BK-1098",
    event: "Ludhiana Fashion Expo",
    date: "Sep 15-17, 2025",
    location: "Ludhiana Exhibition Centre",
    tier: "Basic",
    stallNumber: "#24",
    amount: 5000,
    status: "completed",
    reviewed: true,
    rating: 5,
  },
];

function parseEnd(b: BookingItem): number {
  if (b.dateEnd) return new Date(b.dateEnd).getTime();
  if (b.dateStart) return new Date(b.dateStart).getTime();
  // fallback: treat “completed” as past
  if (b.status === "completed" || b.status === "cancelled") return 0;
  // otherwise future-ish
  return Date.now() + 86400000;
}

export function MyBookings() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from API (auth) + localStorage fallback
  useEffect(() => {
    let cancel = false;

    async function load() {
      setLoading(true);

      // local cache
      const fromLocal = (() => {
        try {
          const raw = localStorage.getItem("sharthi_my_bookings");
          return raw ? (JSON.parse(raw) as BookingItem[]) : [];
        } catch {
          return [];
        }
      })();

      let fromApi: BookingItem[] = [];
      try {
        const token = getToken();
        if (!token) throw new Error("Not signed in");

        // Contract: GET /bookings/my -> [{ id, status, amount, event:{title,cityId,startAt,endAt}, stall:{name,tier,price} }]
        const data: any[] = await api("/bookings/my");

        fromApi = (Array.isArray(data) ? data : []).map((x: any): BookingItem => {
          // map status to UI statuses
          const raw = String(x.status || "").toUpperCase();
          const statusMap: Record<string, BookingItem["status"]> = {
            PAID: "confirmed",
            PENDING: "pending",
            CANCELLED: "cancelled",
            COMPLETED: "completed",
          };
          const status: BookingItem["status"] = statusMap[raw] || "confirmed";

          // tier mapping BRONZE/SILVER/GOLD -> Basic/Premium/VIP
          const tierCsv = String(x?.stall?.tier || "");
          const tierMap: Record<string, string> = { BRONZE: "Basic", SILVER: "Premium", GOLD: "VIP" };
          const tier = tierMap[tierCsv.toUpperCase()] || tierCsv || "";

          return {
            id: String(x.id),
            event: String(x.event?.title ?? "Event"),
            dateStart: x.event?.startAt ?? null,
            dateEnd: x.event?.endAt ?? null,
            location: x.event?.cityId ?? "",
            tier,
            stallNumber: x.stall?.name ?? "",
            amount: Number(x.amount ?? x.stall?.price ?? 0),
            status,
            qrCode: null,
            reviewed: false,
            rating: 0,
          };
        });
      } catch {
        // keep silent; we'll use local + seeds
      }

      const merged = [...fromApi, ...fromLocal];
      if (!merged.length) merged.push(...seedUpcoming, ...seedPast);

      if (!cancel) {
        setBookings(merged);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancel = true;
    };
  }, []);

  // Split upcoming / past
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const u: BookingItem[] = [];
    const p: BookingItem[] = [];
    for (const b of bookings) {
      if (parseEnd(b) >= now && b.status !== "completed" && b.status !== "cancelled") u.push(b);
      else p.push(b);
    }
    return { upcoming: u, past: p };
  }, [bookings]);

  // Helpers
  const downloadTicket = (b: BookingItem) => {
    toast.success(`Downloading ticket for ${b.event}…`);
  };
  const downloadInvoice = (b: BookingItem) => {
    toast.success(`Downloading invoice for ${b.event}…`);
  };
  const contactOrganizer = (b: BookingItem) => {
    toast.info(`Opening chat for ${b.event}…`);
  };
  const markReviewed = async (id: string, rating?: number) => {
    try {
      await api(`/bookings/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ rating: rating ?? 5 }),
      });

      setBookings((arr) =>
        arr.map((b) =>
          b.id === id
            ? { ...b, reviewed: true, rating: rating ?? 5, status: b.status }
            : b,
        ),
      );
      // persist in localStorage (demo)
      try {
        const mine = JSON.parse(localStorage.getItem("sharthi_my_bookings") || "[]") as BookingItem[];
        const idx = mine.findIndex((m) => m.id === id);
        if (idx >= 0) mine[idx] = { ...mine[idx], reviewed: true, rating: rating ?? 5 };
        localStorage.setItem("sharthi_my_bookings", JSON.stringify(mine));
      } catch {
        // ignore localStorage issues
      }
      toast.success("Thank you for your review!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit review");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-neutral-900 mb-2">My Bookings</h1>
        <p className="text-neutral-600">Manage your event bookings and tickets</p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        </TabsList>

        {/* UPCOMING */}
        <TabsContent value="upcoming" className="space-y-4 mt-6">
          {upcoming.map((booking) => (
            <Card key={booking.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-neutral-900">{booking.event}</h3>
                    <Badge className={statusColors[booking.status]}>
                      {booking.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-neutral-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>
                        {booking.date ||
                          (booking.dateStart
                            ? new Date(booking.dateStart).toLocaleDateString()
                            : "—")}
                      </span>
                    </div>
                    {booking.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>{booking.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <QrCode size={18} />
                      View Ticket
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Event Ticket</DialogTitle>
                      <DialogDescription>
                        Your booking details and QR code for event entry
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      {/* QR Code placeholder */}
                      <div className="flex justify-center">
                        <div className="w-48 h-48 bg-neutral-100 rounded-xl flex items-center justify-center">
                          <QrCode size={120} className="text-neutral-400" />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Booking ID</span>
                          <span className="text-neutral-900">{booking.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Stall</span>
                          <span className="text-neutral-900">
                            {booking.tier} {booking.stallNumber || ""}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-600">Amount Paid</span>
                          <span className="text-primary">₹{booking.amount.toLocaleString()}</span>
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        <Button className="flex-1 gap-2" onClick={() => downloadTicket(booking)}>
                          <Download size={16} />
                          Download PDF
                        </Button>
                        <Button variant="outline" className="flex-1 gap-2" onClick={() => contactOrganizer(booking)}>
                          <MessageCircle size={16} />
                          Contact
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-neutral-50 rounded-xl">
                  <p className="text-neutral-600 text-sm mb-1">Stall</p>
                  <p className="text-neutral-900">
                    {booking.tier} {booking.stallNumber || ""}
                  </p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl">
                  <p className="text-neutral-600 text-sm mb-1">Booking ID</p>
                  <p className="text-neutral-900">{booking.id}</p>
                </div>
                <div className="p-3 bg-neutral-50 rounded-xl">
                  <p className="text-neutral-600 text-sm mb-1">Amount</p>
                  <p className="text-primary">₹{booking.amount.toLocaleString()}</p>
                </div>
              </div>
            </Card>
          ))}

          {!loading && upcoming.length === 0 && (
            <Card className="p-12">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto">
                  <Calendar className="text-neutral-400" size={32} />
                </div>
                <h4 className="text-neutral-900">No upcoming bookings</h4>
                <p className="text-neutral-600">Book a stall at an event to get started!</p>
                <Button className="mt-4" onClick={() => (window.location.href = "/")}>
                  Browse Events
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* PAST */}
        <TabsContent value="past" className="space-y-4 mt-6">
          {past.map((booking) => (
            <Card key={booking.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-neutral-900">{booking.event}</h3>
                    <Badge className={statusColors[booking.status]}>
                      {booking.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-neutral-600">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} />
                      <span>
                        {booking.date ||
                          (booking.dateStart
                            ? new Date(booking.dateStart).toLocaleDateString()
                            : "—")}
                      </span>
                    </div>
                    {booking.location && (
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>{booking.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Download size={18} />
                      Invoice
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Booking Invoice</DialogTitle>
                      <DialogDescription>
                        Summary of your booking payment for this event
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <p className="text-neutral-900 mb-1">{booking.event}</p>
                        <p className="text-neutral-600 text-sm">
                          {booking.date ||
                            (booking.dateStart
                              ? new Date(booking.dateStart).toLocaleDateString()
                              : "")}
                          {booking.location ? ` • ${booking.location}` : ""}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Invoice ID</span>
                          <span className="text-neutral-900">{booking.id}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Stall</span>
                          <span className="text-neutral-900">
                            {booking.tier} {booking.stallNumber || ""}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-neutral-600">Amount</span>
                          <span className="text-primary">₹{booking.amount.toLocaleString()}</span>
                        </div>
                      </div>

                      <Separator />

                      <Button className="w-full gap-2" onClick={() => downloadInvoice(booking)}>
                        <Download size={16} />
                        Download PDF
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Separator className="my-4" />

              <div className="flex items-center justify-between">
                <div className="flex gap-6">
                  <div>
                    <p className="text-neutral-600 text-sm">Stall</p>
                    <p className="text-neutral-900">
                      {booking.tier} {booking.stallNumber || ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-neutral-600 text-sm">Amount</p>
                    <p className="text-neutral-900">₹{booking.amount.toLocaleString()}</p>
                  </div>
                </div>

                {booking.reviewed ? (
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={16} className={i < (booking.rating || 0) ? "fill-warning text-warning" : "text-neutral-300"} />
                      ))}
                    </div>
                    <span className="text-neutral-600 text-sm">Reviewed</span>
                  </div>
                ) : (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <Star size={16} />
                        Write Review
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Rate Your Experience</DialogTitle>
                        <DialogDescription>Share your feedback to help other creators and organizers</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 py-4">
                        <div>
                          <p className="text-neutral-900 mb-2">{booking.event}</p>
                          {booking.date && <p className="text-neutral-600 text-sm">{booking.date}</p>}
                        </div>

                        <div>
                          <p className="text-neutral-700 mb-3">How was your experience?</p>
                          <div className="flex gap-2 justify-center">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button key={rating} className="hover:scale-110 transition-transform" onClick={() => markReviewed(booking.id, rating)}>
                                <Star size={32} className="text-warning hover:fill-warning" />
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-neutral-700 mb-2">Share your thoughts</p>
                          <Textarea placeholder="Tell us about your experience at this event..." rows={4} />
                        </div>

                        <Button className="w-full" onClick={() => markReviewed(booking.id, 5)}>
                          Submit Review
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
