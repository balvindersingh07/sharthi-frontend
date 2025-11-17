import {
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
} from "react";
import {
  MapPin,
  CalendarDays,
  IndianRupee,
  CheckCircle,
  Upload,
  Plus,
  X,
} from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { toast } from "sonner";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/* ---------- helpers (same style as CreatorProfile) ---------- */
function getToken(): string | null {
  try {
    return (
      localStorage.getItem("jwt") || localStorage.getItem("sharthi_token")
    );
  } catch {
    return null;
  }
}

async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API}${path}`, { ...init, headers });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || res.statusText);
  }
  return data as T;
}

/* ---------- small types ---------- */
type OrganizerMe = {
  ok: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    organizer?: {
      companyName: string | null;
      gstin: string | null;
    } | null;
  };
};

type Venue = {
  id: string;
  name: string;
  city: string;
  description: string;
  tier: "Tier A" | "Tier B" | "Other";
};

const defaultVenues: Venue[] = [
  {
    id: "v1",
    name: "Pragati Maidan",
    city: "New Delhi",
    description: "Indoor Exhibition Halls",
    tier: "Tier A",
  },
  {
    id: "v2",
    name: "BKC Grounds",
    city: "Mumbai",
    description: "Open Air, large footfall",
    tier: "Tier B",
  },
];

const sampleEvents = [
  {
    title: "Delhi Handmade Crafts Fair",
    dates: "Nov 15–17, 2025",
    venue: "Pragati Maidan, Delhi",
    stalls: "120 / 150 booked",
    status: "Upcoming",
  },
  {
    title: "Mumbai Art Festival",
    dates: "Dec 1–5, 2025",
    venue: "BKC Grounds, Mumbai",
    stalls: "80 / 100 booked",
    status: "Upcoming",
  },
];

export function OrganizerProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // header identity
  const [brandName, setBrandName] = useState("Weekend Flea Co.");
  const [gstin, setGstin] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");

  const [about, setAbout] = useState(
    "We host curated handmade and lifestyle markets across metro cities, focusing on a premium experience for both visitors and vendors."
  );
  const [policies, setPolicies] = useState(
    "Electricity and furniture add-ons available. 50% advance to confirm stall, balance due 7 days before the event."
  );

  // avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // venues
  const [venues, setVenues] = useState<Venue[]>(defaultVenues);
  const [showVenueForm, setShowVenueForm] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [venueCity, setVenueCity] = useState("");
  const [venueDesc, setVenueDesc] = useState("");
  const [venueTier, setVenueTier] = useState<Venue["tier"]>("Other");

  // docs
  const [gstDocName, setGstDocName] = useState("gst_certificate.pdf");
  const [idDocName, setIdDocName] = useState("organiser_pan_card.jpg");
  const gstInputRef = useRef<HTMLInputElement | null>(null);
  const idInputRef = useRef<HTMLInputElement | null>(null);

  // simple stats
  const stats = useMemo(
    () => ({
      eventsHosted: 6,
      totalStalls: "420+",
      avgRating: 4.7,
      profileComplete: 68,
    }),
    []
  );

  /* ---------- initial load ---------- */
  useEffect(() => {
    let cancel = false;

    (async () => {
      try {
        setLoading(true);

        // avatar from localStorage
        try {
          const savedAvatar = localStorage.getItem("organizer_avatar_url");
          if (savedAvatar) setAvatarUrl(savedAvatar);
        } catch {
          /* ignore */
        }

        // about/policies from localStorage (if any)
        try {
          const aboutLS = localStorage.getItem("organizer_about");
          const policiesLS = localStorage.getItem("organizer_policies");
          if (aboutLS) setAbout(aboutLS);
          if (policiesLS) setPolicies(policiesLS);
        } catch {
          /* ignore */
        }

        // venues from localStorage
        try {
          const vStr = localStorage.getItem("organizer_venues");
          if (vStr) {
            const parsed = JSON.parse(vStr) as Venue[];
            if (Array.isArray(parsed) && parsed.length) {
              setVenues(parsed);
            }
          }
        } catch {
          /* ignore */
        }

        // organizer details from backend
        const token = getToken();
        if (!token) {
          // not logged in as organizer – show demo data only
          setLoading(false);
          return;
        }

        const data = await api<OrganizerMe>("/organizers/me");
        if (cancel) return;

        const u = data.user;
        setContactPerson(u.name || "");
        setPhone(u.phone || "");
        setBrandName(u.organizer?.companyName || "Weekend Flea Co.");
        setGstin(u.organizer?.gstin || "");
      } catch (e: any) {
        if (!cancel) {
          toast.error(e?.message || "Failed to load organizer profile");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, []);

  /* ---------- avatar ---------- */
  const onAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const onAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAvatarUrl(url);

    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          localStorage.setItem("organizer_avatar_url", reader.result);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      /* ignore */
    }
  };

  /* ---------- save profile ---------- */
  const onSaveProfile = async () => {
    try {
      setSaving(true);

      // persist long-text fields in browser for now
      try {
        localStorage.setItem("organizer_about", about);
        localStorage.setItem("organizer_policies", policies);
      } catch {
        /* ignore */
      }

      // hit backend for the bits it understands
      const payload = {
        companyName: brandName,
        gstin: gstin || undefined,
        contactName: contactPerson || undefined,
        phone: phone || undefined,
        // about/policies are sent too – backend may ignore for now
        about,
        policies,
      };

      await api("/organizers/me/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      toast.success("Organizer profile saved");
    } catch (e: any) {
      toast.error(e?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- venues ---------- */
  const resetVenueForm = () => {
    setVenueName("");
    setVenueCity("");
    setVenueDesc("");
    setVenueTier("Other");
  };

  const saveVenuesToStorage = (list: Venue[]) => {
    try {
      localStorage.setItem("organizer_venues", JSON.stringify(list));
    } catch {
      /* ignore */
    }
  };

  const onAddVenue = () => {
    if (!venueName.trim() || !venueCity.trim()) {
      toast.error("Venue name and city required");
      return;
    }
    const v: Venue = {
      id: `v-${Date.now()}`,
      name: venueName.trim(),
      city: venueCity.trim(),
      description: venueDesc.trim() || "Custom venue",
      tier: venueTier,
    };
    setVenues((prev) => {
      const next = [...prev, v];
      saveVenuesToStorage(next);
      return next;
    });
    resetVenueForm();
    setShowVenueForm(false);
    toast.success("Venue added");
  };

  const onRemoveVenue = (id: string) => {
    setVenues((prev) => {
      const next = prev.filter((v) => v.id !== id);
      saveVenuesToStorage(next);
      return next;
    });
  };

  /* ---------- docs ---------- */
  const onDocPick =
    (kind: "gst" | "id") => (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (kind === "gst") setGstDocName(file.name);
      else setIdDocName(file.name);
      toast.success("Document selected (demo only)");
    };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header / Identity */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="relative">
            <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
              <ImageWithFallback
                src={
                  avatarUrl ||
                  "https://api.dicebear.com/7.x/identicon/svg?seed=Organizer"
                }
                alt="Organizer Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <Button
              size="sm"
              className="absolute bottom-0 right-0 rounded-full w-10 h-10 p-0"
              onClick={onAvatarClick}
            >
              <Upload size={16} />
            </Button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onAvatarFileChange}
            />
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-neutral-900">
                    {brandName || "Your Brand / Company"}
                  </h2>
                  <Badge className="bg-accent">
                    <CheckCircle size={12} className="mr-1" />
                    Verified Organizer
                  </Badge>
                </div>
                <p className="text-neutral-600">
                  Specialised in flea markets, handmade & lifestyle events.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-neutral-600 mb-4">
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span>Based in Delhi • Hosting in 4 cities</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays size={16} />
                <span>Next event in 3 weeks</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-neutral-50">
                Weekend Bazaars
              </Badge>
              <Badge variant="outline" className="bg-neutral-50">
                Exhibition Centers
              </Badge>
              <Badge variant="outline" className="bg-neutral-50">
                College Fests
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-primary mb-1">{stats.eventsHosted}</div>
          <p className="text-neutral-600 text-sm">Events Hosted</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-secondary mb-1">{stats.totalStalls}</div>
          <p className="text-neutral-600 text-sm">Stalls Managed</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-secondary mb-1">{stats.avgRating}</div>
          <p className="text-neutral-600 text-sm">Organizer Rating</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-accent mb-1">
            {stats.profileComplete}%
          </div>
          <p className="text-neutral-600 text-sm">Profile Complete</p>
        </Card>
      </div>

      {/* Tabs – About / Venues / Docs */}
      <Tabs defaultValue="about" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="about">Organizer Profile</TabsTrigger>
          <TabsTrigger value="venues">Preferred Venues</TabsTrigger>
          <TabsTrigger value="docs">KYC &amp; Documents</TabsTrigger>
        </TabsList>

        {/* ABOUT */}
        <TabsContent value="about" className="mt-6 space-y-6">
          <Card className="p-6">
            <h3 className="text-neutral-900 mb-4">Basic Details</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <Label htmlFor="org-name">Brand / Company Name</Label>
                <Input
                  id="org-name"
                  placeholder="e.g. Weekend Flea Co."
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="gstin">GSTIN (optional)</Label>
                <Input
                  id="gstin"
                  placeholder="22AAAAA0000A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="contact-person">Contact Person</Label>
                <Input
                  id="contact-person"
                  placeholder="Your full name"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  placeholder="+91 98xxx xxxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="about">About your events</Label>
                <Textarea
                  id="about"
                  rows={4}
                  placeholder="Tell creators what type of events you run, footfall, theme, etc."
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div>
                <Label htmlFor="policies">Stall Policies (short)</Label>
                <Textarea
                  id="policies"
                  rows={4}
                  placeholder="Refunds, electricity, branding rules..."
                  value={policies}
                  onChange={(e) => setPolicies(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                className="gap-2"
                onClick={onSaveProfile}
                disabled={saving || loading}
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </Card>

          {/* Upcoming events */}
          <Card className="p-6">
            <h3 className="text-neutral-900 mb-4">Upcoming Events</h3>
            <div className="space-y-4">
              {sampleEvents.map((ev) => (
                <Card key={ev.title} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-neutral-900 mb-1">
                        {ev.title}
                      </h4>
                      <p className="text-neutral-600 text-sm">
                        {ev.dates} • {ev.venue}
                      </p>
                      <p className="text-neutral-500 text-xs mt-1">
                        {ev.stalls}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className="bg-accent">{ev.status}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          toast.info("Open event details (demo only)")
                        }
                      >
                        Manage Event
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* VENUES */}
        <TabsContent value="venues" className="mt-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-neutral-900 mb-1">
                  Preferred Venues
                </h3>
                <p className="text-neutral-600 text-sm">
                  Save your frequently used venues for quick event
                  creation.
                </p>
              </div>
              <Button
                className="gap-2"
                variant="outline"
                onClick={() => setShowVenueForm((v) => !v)}
              >
                <Plus size={16} />
                {showVenueForm ? "Cancel" : "Add Venue"}
              </Button>
            </div>

            {showVenueForm && (
              <Card className="p-4 border-dashed">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="venue-name">Venue Name</Label>
                    <Input
                      id="venue-name"
                      placeholder="Pragati Maidan"
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="venue-city">City</Label>
                    <Input
                      id="venue-city"
                      placeholder="New Delhi"
                      value={venueCity}
                      onChange={(e) => setVenueCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="venue-desc">
                      Description (optional)
                    </Label>
                    <Input
                      id="venue-desc"
                      placeholder="Indoor Exhibition Halls"
                      value={venueDesc}
                      onChange={(e) => setVenueDesc(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="venue-tier">Tier</Label>
                    <select
                      id="venue-tier"
                      className="mt-1 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm"
                      value={venueTier}
                      onChange={(e) =>
                        setVenueTier(
                          e.target.value as Venue["tier"]
                        )
                      }
                    >
                      <option>Tier A</option>
                      <option>Tier B</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetVenueForm();
                      setShowVenueForm(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={onAddVenue}>
                    Save Venue
                  </Button>
                </div>
              </Card>
            )}

            <div className="space-y-3">
              {venues.map((v) => (
                <Card
                  key={v.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-neutral-900">
                      {v.name}
                    </p>
                    <p className="text-sm text-neutral-600">
                      {v.city} • {v.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {v.tier === "Tier A" && (
                        <span className="flex items-center gap-1">
                          <IndianRupee size={14} /> Tier A venue
                        </span>
                      )}
                      {v.tier === "Tier B" && "Tier B venue"}
                      {v.tier === "Other" && "Custom venue"}
                    </Badge>
                    <button
                      className="text-xs text-neutral-400 hover:text-red-500 flex items-center gap-1"
                      onClick={() => onRemoveVenue(v.id)}
                    >
                      <X size={12} /> Remove
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* DOCS / KYC */}
        <TabsContent value="docs" className="mt-6 space-y-6">
          <Card className="p-6">
            <h3 className="text-neutral-900 mb-4">KYC &amp; Documents</h3>
            <div className="flex items-center justify-between p-4 bg-accent/10 rounded-xl border border-accent/20 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-accent" size={24} />
                <div>
                  <p className="text-neutral-900">
                    Organizer KYC Approved
                  </p>
                  <p className="text-neutral-600 text-sm">
                    GST &amp; ID documents verified on Oct 10, 2025
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.info("KYC history panel (demo only)")
                }
              >
                View History
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="mb-1">GST Certificate</Label>
                <div className="flex items-center justify-between p-3 border rounded-xl bg-neutral-50">
                  <span className="text-sm text-neutral-700">
                    {gstDocName}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => gstInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    Replace
                  </Button>
                  <input
                    ref={gstInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={onDocPick("gst")}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-1">Government ID</Label>
                <div className="flex items-center justify-between p-3 border rounded-xl bg-neutral-50">
                  <span className="text-sm text-neutral-700">
                    {idDocName}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => idInputRef.current?.click()}
                  >
                    <Upload size={14} />
                    Replace
                  </Button>
                  <input
                    ref={idInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={onDocPick("id")}
                  />
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
