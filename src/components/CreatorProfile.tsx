import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  MapPin,
  IndianRupee,
  Edit,
  CheckCircle,
  Upload,
  Plus,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type UserSelf = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  creatorProfile?:
    | {
        bio?: string | null;
        cityId?: string | null;
        minPrice?: number | null;
        maxPrice?: number | null;
        tags?: string[] | null;
        updatedAt?: string;
      }
    | null;
};

type BookingPreview = {
  event: string;
  date: string;
  stall: string;
  status: string;
  ref: string;
};

const portfolioImages = [
  "https://images.unsplash.com/photo-1617035305886-59c560e07ce4?q=80&w=1080&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1701987432961-831aa2aa9b34?q=80&w=1080&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1735605918310-73ad27a5dd6b?q=80&w=1080&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1761124739063-8a1464438cdf?q=80&w=1080&auto=format&fit=crop",
];

const demoBookings: BookingPreview[] = [
  {
    event: "Delhi Handmade Crafts Fair",
    date: "Nov 15-17, 2025",
    stall: "Premium #12",
    status: "confirmed",
    ref: "SHR-DEL-2025-12",
  },
  {
    event: "Mumbai Art Festival",
    date: "Dec 1-5, 2025",
    stall: "VIP #5",
    status: "confirmed",
    ref: "SHR-MUM-2025-05",
  },
];

const defaultSkills = [
  "Makeup Artist",
  "Bridal Makeup",
  "Special Effects",
  "Hair Styling",
];
const cities = ["Delhi", "Mumbai", "Bangalore", "Ludhiana"];

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/** helpers */
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
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const t = await res.json();
      msg = t?.error || t?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export function CreatorProfile() {
  const [authMissing, setAuthMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // avatar (profile photo)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // ticket modal
  const [ticketBooking, setTicketBooking] = useState<BookingPreview | null>(
    null
  );

  // form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [minPrice, setMinPrice] = useState<number | "">("");
  const [maxPrice, setMaxPrice] = useState<number | "">("");
  const [skills, setSkills] = useState<string[]>(defaultSkills);
  const [newSkill, setNewSkill] = useState("");

  // load self
  useEffect(() => {
    let cancel = false;
    (async () => {
      const token = getToken();
      if (!token) {
        setAuthMissing(true);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const me = await api<UserSelf>("/creators/me/self");
        if (cancel) return;

        setName(me.name || "");
        setPhone(me.phone || "");
        setBio(me.creatorProfile?.bio || "");
        setCity(me.creatorProfile?.cityId || cities[0]);
        setMinPrice(me.creatorProfile?.minPrice ?? 0);
        setMaxPrice(me.creatorProfile?.maxPrice ?? 0);
        setSkills(
          (me.creatorProfile?.tags?.length
            ? me.creatorProfile.tags!
            : defaultSkills
          ).slice(0, 12)
        );
      } catch (e: any) {
        if (!cancel) {
          toast.error(e?.message || "Failed to load profile");
          // still show editable UI so user can try saving
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // load avatar from localStorage (simple persistent profile photo)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("creator_avatar_url");
      if (saved) {
        setAvatarUrl(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const profileComplete = useMemo(() => {
    let done = 0;
    if (name) done++;
    if (phone) done++;
    if (bio) done++;
    if (city) done++;
    if (typeof minPrice === "number" && minPrice > 0) done++;
    if (typeof maxPrice === "number" && maxPrice > 0) done++;
    if (skills.length) done++;
    return Math.round((done / 7) * 100);
  }, [name, phone, bio, city, minPrice, maxPrice, skills]);

  const onAddSkill = () => {
    const s = newSkill.trim();
    if (!s) return;
    if (skills.includes(s)) {
      toast.info("Skill already added");
      return;
    }
    setSkills((arr) => [...arr, s].slice(0, 20));
    setNewSkill("");
  };
  const onRemoveSkill = (s: string) => {
    setSkills((arr) => arr.filter((x) => x !== s));
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      await api("/creators/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: name || undefined,
          phone: phone || undefined,
          bio,
          cityId: city,
          minPrice: typeof minPrice === "number" ? minPrice : 0,
          maxPrice: typeof maxPrice === "number" ? maxPrice : 0,
          tags: skills,
        }),
      });
      toast.success("Profile updated successfully!");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const onAvatarClick = () => {
    avatarInputRef.current?.click();
  };

  const onAvatarFileChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // quick preview
    const url = URL.createObjectURL(file);
    setAvatarUrl(url);

    // store base64 in localStorage for simple persistence
    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          localStorage.setItem("creator_avatar_url", reader.result);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      // ignore
    }
  };

  if (authMissing) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card className="p-8 text-center">
          <h3 className="text-neutral-900 mb-2">Sign in required</h3>
          <p className="text-neutral-600 mb-4">
            Please sign in to view and edit your creator profile.
          </p>
          <Button
            onClick={() =>
              toast.info("Use Sign In button in header to continue.")
            }
          >
            Go to Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center overflow-hidden">
              <ImageWithFallback
                src={
                  avatarUrl ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    name || "Creator"
                  )}`
                }
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <Button
              size="sm"
              className="absolute bottom-0 right-0 rounded-full w-10 h-10 p-0"
              onClick={onAvatarClick}
            >
              <Camera size={16} />
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
                    {name || "Your Name"}
                  </h2>
                  <Badge className="bg-accent">
                    <CheckCircle size={12} className="mr-1" />
                    Verified
                  </Badge>
                </div>
                <p className="text-neutral-600">Professional Makeup Artist</p>
              </div>
              {/* Settings button removed as per request */}
            </div>

            <div className="flex flex-wrap gap-4 text-neutral-600 mb-4">
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span>{city || "City"}</span>
              </div>
              <div className="flex items-center gap-2">
                <IndianRupee size={16} />
                <span>
                  ₹
                  {(
                    typeof minPrice === "number" ? minPrice : 0
                  ).toLocaleString()}{" "}
                  - ₹
                  {(
                    typeof maxPrice === "number" ? maxPrice : 0
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge
                  key={skill}
                  variant="outline"
                  className="bg-neutral-50"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-primary mb-1">12</div>
          <p className="text-neutral-600 text-sm">Events Booked</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-secondary mb-1">4.8</div>
          <p className="text-neutral-600 text-sm">Avg Rating</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-accent mb-1">{profileComplete}%</div>
          <p className="text-neutral-600 text-sm">Profile Complete</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
          <TabsTrigger value="bookings">My Bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          {/* Edit Profile */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-neutral-900">Edit Profile</h3>
              <Button
                size="sm"
                className="gap-2"
                onClick={saveProfile}
                disabled={saving || loading}
              >
                <Edit size={16} />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={loading}
                  placeholder="Tell organizers about your experience, niche, certifications, etc."
                />
              </div>

              <div>
                <Label>Skills &amp; Services</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="gap-1">
                      {skill}
                      <button
                        className="ml-1"
                        onClick={() => onRemoveSkill(skill)}
                        title="Remove"
                      >
                        <X size={12} />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="Add a skill (e.g. Airbrush)"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    disabled={loading}
                  />
                  <Button
                    variant="outline"
                    onClick={onAddSkill}
                    disabled={!newSkill.trim() || loading}
                  >
                    <Plus size={16} className="mr-1" /> Add
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    list="city-list"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={loading}
                  />
                  <datalist id="city-list">
                    {cities.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label htmlFor="min-price">Min Price (₹)</Label>
                  <Input
                    id="min-price"
                    type="number"
                    value={minPrice}
                    onChange={(e) =>
                      setMinPrice(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="max-price">Max Price (₹)</Label>
                  <Input
                    id="max-price"
                    type="number"
                    value={maxPrice}
                    onChange={(e) =>
                      setMaxPrice(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* KYC Status (static placeholder) */}
          <Card className="p-6">
            <h3 className="text-neutral-900 mb-4">KYC Verification</h3>
            <div className="flex items-center justify-between p-4 bg-accent/10 rounded-xl border border-accent/20">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-accent" size={24} />
                <div>
                  <p className="text-neutral-900">Verified</p>
                  <p className="text-neutral-600 text-sm">
                    Documents approved on Oct 15, 2025
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  toast.info("KYC verified on Oct 15, 2025 (demo data)")
                }
              >
                View Details
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="portfolio" className="space-y-6 mt-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-neutral-900 mb-1">My Portfolio</h3>
                <p className="text-neutral-600 text-sm">
                  Showcase your best work to attract organizers
                </p>
              </div>
              <Button
                className="gap-2"
                onClick={() =>
                  toast.info("Image upload feature coming soon!")
                }
              >
                <Upload size={16} />
                Upload Images
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {portfolioImages.map((image, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-xl overflow-hidden relative group"
                >
                  <ImageWithFallback
                    src={image}
                    alt={`Portfolio ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toast.info("Edit image")}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        toast.success("Image deleted (demo only)")
                      }
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              <button
                className="aspect-square rounded-xl border-2 border-dashed border-neutral-300 hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-neutral-500 hover:text-primary"
                onClick={() =>
                  toast.info("Image upload coming soon!")
                }
              >
                <Upload size={24} />
                <span className="text-sm">Add Image</span>
              </button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="bookings" className="mt-6">
          <Card className="p-6">
            <h3 className="text-neutral-900 mb-4">Upcoming Events</h3>
            <div className="space-y-4">
              {demoBookings.map((booking) => (
                <Card key={booking.ref} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-neutral-900 mb-1">
                        {booking.event}
                      </h4>
                      <p className="text-neutral-600 text-sm">
                        {booking.date} • {booking.stall}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-accent">{booking.status}</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setTicketBooking(booking)}
                      >
                        View Ticket
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ticket Modal */}
      <Dialog
        open={!!ticketBooking}
        onOpenChange={(open) => {
          if (!open) setTicketBooking(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Event Ticket</DialogTitle>
            <DialogDescription>
              Booking details for your upcoming event.
            </DialogDescription>
          </DialogHeader>

          {ticketBooking && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 mb-1">
                  Booking Ref
                </p>
                <p className="font-mono text-sm">
                  {ticketBooking.ref}
                </p>
              </div>

              <div>
                <p className="text-xs text-neutral-500 mb-1">Event</p>
                <p className="text-neutral-900">
                  {ticketBooking.event}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">
                    Dates
                  </p>
                  <p className="text-neutral-900">
                    {ticketBooking.date}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">
                    Stall
                  </p>
                  <p className="text-neutral-900">
                    {ticketBooking.stall}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-neutral-500 mb-1">
                  Status
                </p>
                <Badge className="bg-accent">
                  {ticketBooking.status}
                </Badge>
              </div>

              <div className="mt-4 p-4 rounded-xl border border-dashed border-neutral-300 text-center text-xs text-neutral-500">
                QR / barcode area (design-only demo).<br />
                Actual ticket validation backend nal wire kar sakde haan
                jadon zaroorat hove.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
