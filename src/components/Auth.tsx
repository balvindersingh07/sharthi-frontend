import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { toast } from "sonner";

interface AuthProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogin: (email: string, role: "creator" | "organizer" | "admin") => void;
}

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/** Small helpers (no extra files) */
async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) throw new Error(data?.error || data?.message || res.statusText);
  return data as T;
}

function saveAuth(token: string, user: any) {
  // Primary key used across app:
  localStorage.setItem("jwt", token);
  // Back-compat (existing storage keys in your FE):
  localStorage.setItem("sharthi_token", token);
  localStorage.setItem("sharthi_user", JSON.stringify(user));
}

// map API role -> UI role
function toUiRole(raw: any): "creator" | "organizer" | "admin" {
  const r = String(raw || "CREATOR").toUpperCase();
  if (r === "ORGANIZER") return "organizer";
  if (r === "ADMIN") return "admin";
  return "creator";
}

export function Auth({ open, onOpenChange, onLogin }: AuthProps) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  // shared role selector (UX only, backend actual role decide karega)
  const [role, setRole] = useState<"creator" | "organizer">("creator");

  // sign in
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  // sign up
  const [name, setName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  const [loading, setLoading] = useState(false);

  function resetForm() {
    setLoading(false);
    setSigninEmail("");
    setSigninPassword("");
    setName("");
    setSignupEmail("");
    setPhone("");
    setSignupPassword("");
    setTab("signin");
  }

  /* ---------------------------
     HANDLERS
  --------------------------- */

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!signinEmail || !signinPassword) {
      toast.error("Email & password required");
      return;
    }
    setLoading(true);
    try {
      const data = await jsonFetch<{ token: string; user: any }>(
        `${API}/auth/login`,
        {
          method: "POST",
          body: JSON.stringify({
            email: signinEmail,
            password: signinPassword,
          }),
        }
      );

      saveAuth(data.token, data.user);
      const uiRole = toUiRole(data.user?.role);

      toast.success(`Signed in as ${uiRole.toUpperCase()}`);
      onLogin(data.user?.email || signinEmail, uiRole);
      onOpenChange(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !signupEmail || !signupPassword) {
      toast.error("Name, email & password required");
      return;
    }
    setLoading(true);
    try {
      // public signup sirf CREATOR / ORGANIZER laii
      const apiRole = role === "organizer" ? "ORGANIZER" : "CREATOR";

      const data = await jsonFetch<{ token: string; user: any }>(
        `${API}/auth/register`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            email: signupEmail,
            password: signupPassword,
            role: apiRole,
            phone, // backend zod unknown fields ignore, so safe
          }),
        }
      );

      saveAuth(data.token, data.user);
      const uiRole = toUiRole(data.user?.role || apiRole);

      toast.success("Account created");
      onLogin(data.user?.email || signupEmail, uiRole);
      onOpenChange(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------
     RENDER
  --------------------------- */

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          resetForm();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Sharthi</DialogTitle>
          <DialogDescription>
            Sign in with email &amp; password or create a new account
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "signin" | "signup")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          {/* SIGN IN (password-based) */}
          <TabsContent value="signin" className="space-y-4 mt-4">
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                />
              </div>

              {/* Role hint (for UX only) */}
              <div>
                <Label className="mb-3">Sign in as</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(v) => setRole(v as "creator" | "organizer")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="creator" id="signin-creator" />
                    <Label htmlFor="signin-creator" className="cursor-pointer">
                      Creator (Artist, Maker, Vendor)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="organizer" id="signin-organizer" />
                    <Label
                      htmlFor="signin-organizer"
                      className="cursor-pointer"
                    >
                      Organizer (Event Organizer)
                    </Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-neutral-500 mt-1">
                  (Actual role backend ton read hovega, je account ADMIN hai ta
                  auto admin dashboard khul javega.)
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          {/* SIGN UP (password-based) */}
          <TabsContent value="signup" className="space-y-4 mt-4">
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div>
                <Label htmlFor="signup-name">Full Name</Label>
                <Input
                  id="signup-name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="signup-phone">Phone Number</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="At least 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
              </div>

              <div>
                <Label className="mb-3">I am a</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(v) => setRole(v as "creator" | "organizer")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="creator" id="creator" />
                    <Label htmlFor="creator" className="cursor-pointer">
                      Creator (Artist, Maker, Vendor)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="organizer" id="organizer" />
                    <Label htmlFor="organizer" className="cursor-pointer">
                      Organizer (Event Organizer)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Sign Up"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
