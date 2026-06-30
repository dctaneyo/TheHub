"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import {
  CheckSquare,
  Trash2,
  Pencil,
  Sun,
  Moon,
  FolderOpen,
  Bell,
  Loader2,
  Settings,
} from "@/lib/icons";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValueText,
  SelectContent,
  SelectItem,
  createListCollection,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusDot } from "@/components/ui/status-dot";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ModalCloseButton } from "@/components/ui/modal-close-button";
import { DestructiveIconButton } from "@/components/ui/destructive-icon-button";
import { IconTip } from "@/components/ui/icon-tip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shake } from "@/components/ui/shake";
import { SuccessCheckmark } from "@/components/ui/success-checkmark";
import { Emoji } from "@/components/ui/emoji";
import { PinPad } from "@/components/ui/pin-pad";
import { ConfirmDialog, useConfirmDialog } from "@/components/confirm-dialog";

/* ════════════════════════════════════════════════════════════════════════════
   STYLE GUIDE — standalone, no auth (see middleware.ts).

   A UI kit, not a snapshot: every example below renders the real
   src/components/ui/* primitives this app actually ships (plus
   confirm-dialog.tsx, the one shared pattern that lives a level up), in
   every variant/size/state each one actually supports — interactive, not
   static screenshots. Stays accurate automatically as those components
   change, since it imports the same modules every real screen does.

   Organized to mirror DESIGN.md's own structure (Part A's UX rules aren't
   restated here — they govern *when* to use a pattern, not what it looks
   like; this page is the "what it looks like" half).

   Distinct from /design-preview: that page is a narrower A/B/C comparison
   tool for specific *undecided* UI choices (e.g. primary-button color).
   This page is the reference for what's already decided.
   ════════════════════════════════════════════════════════════════════════════ */

const priorityOptions = createListCollection({
  items: [
    { value: "low", label: "Low" },
    { value: "normal", label: "Normal" },
    { value: "high", label: "High" },
    { value: "urgent", label: "Urgent" },
  ],
});

const regionOptions = createListCollection({
  items: [
    { value: "west", label: "West" },
    { value: "east", label: "East" },
  ],
});

const queueItems = Array.from({ length: 14 }, (_, i) => `Task ${i + 1} — Morning Line Check`);

function Section({
  id,
  title,
  blurb,
  children,
}: {
  id: string;
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-border py-12 first:pt-0 last:border-b-0">
      <h2 className="text-2xl font-black text-foreground">{title}</h2>
      {blurb && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{blurb}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xs font-semibold text-muted-foreground">{children}</p>;
}

function Swatch({ label, token, className }: { label: string; token: string; className: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-16 w-full rounded-xl border border-border ${className}`} />
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="font-mono text-xs text-muted-foreground">{token}</p>
      </div>
    </div>
  );
}

export default function StyleGuidePage() {
  const { theme, setTheme } = useTheme();
  const [selectedPriority, setSelectedPriority] = useState(["normal"]);
  const [skeletonView, setSkeletonView] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const [checkShow, setCheckShow] = useState(false);
  const [pin, setPin] = useState("");
  const [savingDemo, setSavingDemo] = useState(false);
  const { dialog, confirm } = useConfirmDialog();

  const nav = [
    ["typography", "Typography"],
    ["color", "Color"],
    ["spacing", "Spacing & Shape"],
    ["buttons", "Buttons"],
    ["badges-avatars", "Badges & Avatars"],
    ["cards", "Cards"],
    ["forms", "Form Controls"],
    ["overlays", "Dialog, Confirm & Menu"],
    ["tabs", "Tabs"],
    ["status", "Status, Empty & Loading"],
    ["feedback", "Feedback Motion"],
    ["scroll", "Scroll Area"],
    ["pinpad", "Pin Pad"],
    ["emoji", "Emoji"],
    ["motion", "Press Motion"],
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground">The Hub — UI Kit</h1>
            <p className="text-xs text-muted-foreground">
              Every primitive in <span className="font-mono">src/components/ui</span>, live and interactive. See
              {" "}<span className="font-mono">DESIGN.md</span> in the repo root for the rules behind it.
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-6 pb-3 text-xs">
          {nav.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="shrink-0 font-semibold text-muted-foreground transition-colors hover:text-foreground active:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-6">
        {/* ── Typography (DESIGN.md §1) ── */}
        <Section
          id="typography"
          title="Typography"
          blurb="Two typefaces, four sizes, two weights — Manrope for UI text, Space Mono for anything tabular or code-like. font-black is a display register, not a third UI weight."
        >
          <div className="space-y-5">
            <div>
              <p className="text-2xl font-black text-foreground">Display — 24px / font-black</p>
              <p className="font-mono text-xs text-muted-foreground">text-2xl font-black — page-level headings only</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Title — 18px / Semibold</p>
              <p className="font-mono text-xs text-muted-foreground">text-lg font-semibold — widget/card/modal titles</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Body Semibold — 14px</p>
              <p className="text-sm text-muted-foreground">Body Regular — 14px — the default for UI text: labels, list items, controls.</p>
              <p className="font-mono text-xs text-muted-foreground">text-sm font-semibold / text-sm</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Caption — 12px</p>
              <p className="font-mono text-xs text-muted-foreground">text-xs — metadata, timestamps, badges. Absolute floor for legibility.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-mono text-2xl font-bold text-foreground">14:32:07</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                --font-mono (Space Mono) — clock, PINs, session codes, IDs, timestamps. Never tabular-nums standing in for it.
              </p>
            </div>
          </div>
        </Section>

        {/* ── Color (DESIGN.md §2) ── */}
        <Section
          id="color"
          title="Color"
          blurb="Every color has a job — palette, brand, or semantic — stated, not implied. Reuse a claimed semantic color before introducing a new one."
        >
          <SubLabel>Claimed semantic colors</SubLabel>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Swatch label="Red — brand/urgent/destructive" token="--hub-red" className="bg-[var(--hub-red)]" />
            <Swatch label="Amber — priority warning" token="amber-500" className="bg-amber-500" />
            <Swatch label="Emerald — success/online" token="emerald-500" className="bg-emerald-500" />
            <Swatch label="Teal — remote session active" token="--hub-teal" className="bg-[var(--hub-teal)]" />
          </div>
          <SubLabel>
            <span className="mt-6 inline-block">Surface tokens</span>
          </SubLabel>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Swatch label="Background" token="bg-background" className="bg-background" />
            <Swatch label="Card" token="bg-card" className="bg-card" />
            <Swatch label="Muted" token="bg-muted" className="bg-muted" />
            <Swatch label="Primary (neutral)" token="bg-primary" className="bg-primary" />
            <Swatch label="Secondary" token="bg-secondary" className="bg-secondary" />
            <Swatch label="Accent" token="bg-accent" className="bg-accent" />
            <Swatch label="Destructive" token="bg-destructive" className="bg-destructive" />
            <Swatch label="Border" token="border-border" className="border-2 bg-transparent" />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Primary action color is a chromatic neutral (near-black on light, near-white on dark) — not brand
            red, since red is already claimed for urgent/destructive/active-selected. See /design-preview for
            the A/B/C comparison that decided this.
          </p>
        </Section>

        {/* ── Spacing & Shape (DESIGN.md §3) ── */}
        <Section
          id="spacing"
          title="Spacing & Shape"
          blurb="8pt grid for rhythm (padding/margin/gap), with a 4px half-step as a stated exception. Heavy, near-uniform radius is this app's deliberate house style."
        >
          <SubLabel>Spacing scale</SubLabel>
          <div className="flex flex-wrap items-end gap-4">
            {[1, 2, 3, 4, 6, 8].map((n) => (
              <div key={n} className="flex flex-col items-center gap-2">
                <div className="bg-primary" style={{ width: n * 4, height: n * 4 }} />
                <p className="font-mono text-xs text-muted-foreground">{n * 4}px</p>
              </div>
            ))}
          </div>
          <SubLabel>
            <span className="mt-6 inline-block">Radius scale, by role</span>
          </SubLabel>
          <div className="flex flex-wrap gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border text-center text-xs text-muted-foreground">rounded-lg<br />icon buttons</div>
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-border text-center text-xs text-muted-foreground">rounded-xl<br />controls</div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border text-center text-xs text-muted-foreground">rounded-2xl<br />cards/modals</div>
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border text-center text-xs text-muted-foreground">rounded-full<br />pills/avatars</div>
          </div>
        </Section>

        {/* ── Buttons (DESIGN.md §6, §9) ── */}
        <Section
          id="buttons"
          title="Buttons"
          blurb="Every hover: is paired with an active: of the same treatment — this is a touchscreen kiosk product too, and hover-only feedback is invisible on that hardware."
        >
          <SubLabel>Variants</SubLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>

          <SubLabel><span className="mt-6 inline-block">States</span></SubLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Rest</Button>
            <Button disabled>Disabled</Button>
            <Button
              disabled={savingDemo}
              onClick={() => {
                setSavingDemo(true);
                setTimeout(() => setSavingDemo(false), 1800);
              }}
            >
              {savingDemo ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Click to simulate save"}
            </Button>
          </div>

          <SubLabel><span className="mt-6 inline-block">Sizes</span></SubLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xs">Extra small</Button>
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </div>

          <SubLabel><span className="mt-6 inline-block">Icon-only sizes</span></SubLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="icon-xs" aria-label="Edit"><Pencil /></Button>
            <Button size="icon-sm" aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
            <Button size="icon-lg" aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
          </div>

          <SubLabel><span className="mt-6 inline-block">Icon-button primitives</span></SubLabel>
          <div className="flex flex-wrap items-center gap-3">
            <ModalCloseButton onClick={() => {}} />
            <DestructiveIconButton icon={Trash2} label="Delete" onClick={() => {}} />
            <IconTip label="This is a tooltip on an icon-only control">
              <Button variant="outline" size="icon-sm"><Bell className="h-4 w-4" /></Button>
            </IconTip>
          </div>
        </Section>

        {/* ── Badges & Avatars (DESIGN.md §11) ── */}
        <Section
          id="badges-avatars"
          title="Badges & Avatars"
          blurb="A field with a small, fixed vocabulary becomes a colored chip, not a plain text column. An avatar next to an identity column is a faster lookup path than reading a name."
        >
          <SubLabel>Badge variants</SubLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Destructive</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>
          <SubLabel><span className="mt-6 inline-block">Badges as status (custom className, the actual app pattern)</span></SubLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Active</Badge>
            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">Pending</Badge>
            <Badge className="bg-muted text-muted-foreground">Inactive</Badge>
            <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400">ARL</Badge>
          </div>

          <SubLabel><span className="mt-6 inline-block">Avatar sizes</span></SubLabel>
          <div className="flex flex-wrap items-center gap-6">
            <Avatar size="sm"><AvatarFallback className="bg-primary/10 text-primary">JS</AvatarFallback></Avatar>
            <Avatar><AvatarFallback className="bg-primary/10 text-primary">DC</AvatarFallback></Avatar>
            <Avatar size="lg"><AvatarFallback className="bg-blue-600 text-white">AR</AvatarFallback></Avatar>
          </div>

          <SubLabel><span className="mt-6 inline-block">Avatar with status badge overlay</span></SubLabel>
          <div className="flex flex-wrap items-center gap-6">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">U</AvatarFallback>
              <AvatarBadge className="bg-destructive ring-card" />
            </Avatar>
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">U</AvatarFallback>
              <AvatarBadge className="bg-emerald-500 ring-card" />
            </Avatar>
          </div>

          <SubLabel><span className="mt-6 inline-block">Avatar group (overlapping, + overflow count)</span></SubLabel>
          <AvatarGroup>
            <Avatar><AvatarFallback className="bg-blue-600 text-white">AR</AvatarFallback></Avatar>
            <Avatar><AvatarFallback className="bg-emerald-600 text-white">DC</AvatarFallback></Avatar>
            <Avatar><AvatarFallback className="bg-purple-600 text-white">JS</AvatarFallback></Avatar>
            <AvatarGroupCount>+5</AvatarGroupCount>
          </AvatarGroup>
        </Section>

        {/* ── Cards (DESIGN.md §17 — no shadow-sm) ── */}
        <Section
          id="cards"
          title="Cards"
          blurb="rounded-xl, no resting shadow — fill-color contrast separates surfaces, not the untouched shadcn rounded-lg/shadow-sm combo (DESIGN.md §17's named tell)."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Morning Line Check</CardTitle>
                <CardDescription>Check all food line temperatures and log readings.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <StatusDot color="emerald" /> Due 06:00 — daily
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm" variant="outline">Edit</Button>
                <Button size="sm">Mark Done</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Locations</CardTitle>
                <CardDescription>Stat card — header + content only, no footer.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-3xl font-bold text-foreground">47<span className="text-base font-normal text-muted-foreground"> / 52</span></p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* ── Form Controls (DESIGN.md §15 — Select replaces native <select>) ── */}
        <Section id="forms" title="Form Controls" blurb="Bordered inputs, Ark-powered Select (replaces the native element app-wide), underline tabs — the app's decided patterns, not a per-component choice.">
          <div className="grid max-w-md gap-5">
            <div>
              <Label htmlFor="sg-input">Text input — rest</Label>
              <Input id="sg-input" placeholder="e.g. Morning Huddle" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="sg-input-disabled">Text input — disabled</Label>
              <Input id="sg-input-disabled" placeholder="Disabled" disabled className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="sg-input-invalid">Text input — invalid</Label>
              <Input id="sg-input-invalid" aria-invalid defaultValue="not-an-email" className="mt-1.5" />
              <p className="mt-1 text-xs text-destructive">Enter a valid email address.</p>
            </div>
            <div>
              <Label htmlFor="sg-textarea">Textarea</Label>
              <Textarea id="sg-textarea" placeholder="Description..." className="mt-1.5" />
            </div>
            <div>
              <Label>Select</Label>
              <Select
                collection={priorityOptions}
                value={selectedPriority}
                onValueChange={(d) => setSelectedPriority(d.value)}
              >
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValueText />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.items.map((item) => (
                    <SelectItem key={item.value} item={item}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select — disabled</Label>
              <Select collection={regionOptions} disabled>
                <SelectTrigger className="mt-1.5 w-full">
                  <SelectValueText placeholder="Unavailable" />
                </SelectTrigger>
                <SelectContent>
                  {regionOptions.items.map((item) => (
                    <SelectItem key={item.value} item={item}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        {/* ── Dialog, Confirm & Menu (DESIGN.md §12 — tap, not hover, for disclosure) ── */}
        <Section
          id="overlays"
          title="Dialog, Confirm & Menu"
          blurb="Disclosure happens through a deliberate tap (Section 12) — never a hover reveal, since hover isn't part of this product's input model. Every destructive action gates through a confirm dialog (DESIGN.md §19), no exceptions."
        >
          <SubLabel>Generic dialog</SubLabel>
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rename Location</DialogTitle>
                  <DialogDescription>Set a new display name for this location.</DialogDescription>
                </DialogHeader>
                <Input defaultValue="Downtown — 5th Ave" />
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>Save</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Menu>
              <MenuTrigger asChild>
                <Button variant="outline">Open Menu</Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem value="edit" onClick={() => {}}>
                  <Pencil className="h-4 w-4" /> Edit
                </MenuItem>
                <MenuItem value="settings" onClick={() => {}}>
                  <Settings className="h-4 w-4" /> Settings
                </MenuItem>
                <MenuSeparator />
                <MenuItem value="delete" variant="destructive" onClick={() => {}}>
                  <Trash2 className="h-4 w-4" /> Delete
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>

          <SubLabel>
            <span className="mt-6 inline-block">
              Confirm dialog — the app-wide destructive-action pattern (DESIGN.md §19: states the consequence in one short sentence, requires a second deliberate click)
            </span>
          </SubLabel>
          <Button
            variant="destructive"
            onClick={() =>
              confirm({
                title: "Delete David Santos?",
                description: "This cannot be undone.",
                confirmLabel: "Delete User",
                variant: "danger",
                onConfirm: () => {},
              })
            }
          >
            <Trash2 className="h-4 w-4" /> Delete User
          </Button>
          <ConfirmDialog {...dialog} />
        </Section>

        {/* ── Tabs ── */}
        <Section id="tabs" title="Tabs" blurb="Underline only — the app's one decided tab style. No segmented-pill variant; offering a choice is what let two screens drift apart in the first place.">
          <Tabs defaultValue="overview" className="max-w-md">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4 text-sm text-muted-foreground">Overview panel content.</TabsContent>
            <TabsContent value="activity" className="mt-4 text-sm text-muted-foreground">Activity panel content.</TabsContent>
            <TabsContent value="settings" className="mt-4 text-sm text-muted-foreground">Settings panel content.</TabsContent>
          </Tabs>
        </Section>

        {/* ── Status, Empty & Loading States (DESIGN.md §10, §16) ── */}
        <Section
          id="status"
          title="Status, Empty & Loading States"
          blurb="The user always knows: something is happening right now, what just happened, and how to get back (DESIGN.md §16 — extended 2026-06-30 to add the first leg)."
        >
          <SubLabel>Status dots</SubLabel>
          <div className="flex flex-wrap items-center gap-6">
            <span className="flex items-center gap-2 text-sm text-foreground"><StatusDot color="emerald" /> Online</span>
            <span className="flex items-center gap-2 text-sm text-foreground"><StatusDot color="amber" pulse /> Reconnecting</span>
            <span className="flex items-center gap-2 text-sm text-foreground"><StatusDot color="red" /> Offline</span>
            <span className="flex items-center gap-2 text-sm text-foreground"><StatusDot color="muted" /> Inactive</span>
            <span className="flex items-center gap-2 text-sm text-foreground"><StatusDot color="brand" pulse /> Live</span>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <div>
              <SubLabel>Empty state</SubLabel>
              <EmptyState icon={FolderOpen} title="No tasks yet" subtext="Tasks assigned to this location will show up here." bordered />
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Skeleton loading</p>
                <button
                  type="button"
                  onClick={() => setSkeletonView((v) => !v)}
                  className="text-xs font-semibold text-primary underline active:opacity-70"
                >
                  Toggle
                </button>
              </div>
              {skeletonView ? (
                <div className="rounded-xl border border-border p-4">
                  <Skeleton variant="list" lines={3} />
                </div>
              ) : (
                <div className="rounded-xl border border-border p-4">
                  <Skeleton variant="card" />
                </div>
              )}
            </div>
            <div>
              <SubLabel>In-flight button (DESIGN.md §16)</SubLabel>
              <div className="flex h-[88px] items-center justify-center rounded-xl border border-border p-4">
                <Button disabled>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </Button>
              </div>
            </div>
          </div>
        </Section>

        {/* ── Feedback motion: Shake + Success Checkmark ── */}
        <Section
          id="feedback"
          title="Feedback Motion"
          blurb="A small animation on a meaningful state change confirms the action landed (DESIGN.md §9) — it marks one specific event, not ambient polish."
        >
          <div className="flex flex-wrap items-center gap-10">
            <div>
              <SubLabel>Shake — invalid input (e.g. wrong PIN)</SubLabel>
              <Shake trigger={shakeTrigger} intensity="medium">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShakeTrigger(true);
                    setTimeout(() => setShakeTrigger(false), 600);
                  }}
                >
                  Click to shake
                </Button>
              </Shake>
            </div>
            <div>
              <SubLabel>Success checkmark — action confirmed</SubLabel>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCheckShow(true);
                    setTimeout(() => setCheckShow(false), 1400);
                  }}
                >
                  Click to confirm
                </Button>
                <SuccessCheckmark show={checkShow} size="md" />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Scroll Area ── */}
        <Section id="scroll" title="Scroll Area" blurb="Custom scrollbar styling (Radix-based) — used anywhere a list needs to scroll within a fixed-height panel, like chat threads.">
          <ScrollArea className="h-48 max-w-md rounded-xl border border-border p-3">
            <div className="space-y-1">
              {queueItems.map((item) => (
                <div key={item} className="rounded-lg px-2 py-1.5 text-sm text-foreground">{item}</div>
              ))}
            </div>
          </ScrollArea>
        </Section>

        {/* ── Pin Pad ── */}
        <Section id="pinpad" title="Pin Pad" blurb="The kiosk login/PIN-reconfirmation keypad — large touch targets, no hover dependency.">
          <div className="max-w-xs">
            <p className="mb-3 text-center font-mono text-2xl tracking-[0.5em] text-foreground">
              {pin.padEnd(4, "•").split("").map((c, i) => (i < pin.length ? "•" : "·")).join(" ")}
            </p>
            <PinPad
              value={pin}
              maxLength={4}
              onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
              onDelete={() => setPin((p) => p.slice(0, -1))}
              onAction={() => setPin("")}
              actionContent="Clear"
            />
          </div>
        </Section>

        {/* ── Emoji ── */}
        <Section id="emoji" title="Emoji" blurb="Renders a literal emoji character via the unified code-point lookup — used for message reactions.">
          <div className="flex items-center gap-3">
            {["👍", "🎉", "🔥", "✅", "👀"].map((e) => (
              <button
                key={e}
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border transition-colors active:bg-muted"
              >
                <Emoji emoji={e} size={20} />
              </button>
            ))}
          </div>
        </Section>

        {/* ── Press Motion (DESIGN.md §9) ── */}
        <Section
          id="motion"
          title="Press Motion"
          blurb="~150-200ms ease-out governs ordinary feedback. A press state is a real transition, not an instant snap — try tapping/clicking the tile below."
        >
          <button
            type="button"
            className="flex h-24 w-48 items-center justify-center rounded-2xl border border-border bg-card text-sm font-semibold text-foreground transition-all duration-150 ease-out active:scale-95 active:bg-muted"
          >
            <CheckSquare className="mr-2 h-4 w-4" /> Press me
          </button>
        </Section>
      </div>
    </div>
  );
}
