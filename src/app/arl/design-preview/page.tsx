"use client";

import { useState, useMemo } from "react";
import {
  Dialog as ArkDialog,
  Switch as ArkSwitch,
  Tabs as ArkTabs,
  Accordion as ArkAccordion,
  Slider as ArkSlider,
  RadioGroup as ArkRadioGroup,
  Checkbox as ArkCheckbox,
  Select as ArkSelect,
  Tooltip as ArkTooltip,
  createListCollection,
} from "@ark-ui/react";
import {
  PencilSimple,
  Copy,
  Trash,
  DotsThreeVertical,
  GearSix,
  Bell,
  SignOut,
  CaretDown,
  CaretRight,
  X,
  Check,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { IconWeight } from "@phosphor-icons/react";

// Current implementation components (shadcn/Radix)
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* ════════════════════════════════════════════════════════════════════════════
   DESIGN PREVIEW — Current vs. New (Ark UI + Linear)

   Side-by-side comparison of the current shadcn/Radix implementation
   against the target Ark UI + Linear (Refined) design.

   Left column  = CURRENT (real shadcn/Radix components, existing tokens)
   Right column = NEW (real Ark UI components, --dp-* tokens, Linear style)

   Design tokens follow DESIGN.md:
   - §1: Four-size type scale (12/14/18/24), Space Mono for numerics
   - §3: 12px card rounding (house style)
   - §7: One dominant element per screen
   - §8: Dark mode = warm near-black, light mode = warm off-white
   - §10: Solid inverted fill for selection, dot+label for status
   - §14: Phosphor regular weight (clean single-stroke)
   - §17: Warm-tinted palette, not stock zinc
   ════════════════════════════════════════════════════════════════════════════ */

type PhosphorIconProps = { weight?: IconWeight; className?: string; size?: number };
function Icon({ icon: Ic, className, size }: { icon: React.ComponentType<PhosphorIconProps>; className?: string; size?: number }) {
  return <Ic weight="regular" className={className} size={size} />;
}

// ─── Column headers ─────────────────────────────────────────────────────────
function ColumnHeader({ side, label, sublabel }: { side: "current" | "new"; label: string; sublabel: string }) {
  return (
    <div className={cn(
      "sticky top-0 z-10 flex items-center gap-2 border-b px-4 py-2.5 backdrop-blur-sm",
      side === "current"
        ? "border-border bg-card/80"
        : "border-[var(--dp-border)] bg-[var(--dp-surface-1)]/80"
    )}>
      <span className={cn(
        "text-xs font-bold uppercase tracking-[0.08em]",
        side === "current" ? "text-muted-foreground" : "text-[var(--dp-text-tertiary)]"
      )}>
        {label}
      </span>
      <span className={cn(
        "text-xs",
        side === "current" ? "text-muted-foreground/60" : "text-[var(--dp-text-tertiary)]"
      )}>
        {sublabel}
      </span>
    </div>
  );
}

// ─── Section divider ────────────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-6">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Current-side cell (uses existing card styles) ──────────────────────────
function CurrentCell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between px-0">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">{name}</span>
        <span className="font-mono text-xs text-muted-foreground/60">shadcn/radix</span>
      </div>
      <CardContent className="px-0">
        {children}
      </CardContent>
    </Card>
  );
}

// ─── New-side cell (uses --dp-* tokens) ─────────────────────────────────────
function NewCell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--dp-radius)] border border-[var(--dp-border)] bg-[var(--dp-surface-1)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--dp-text-tertiary)]">{name}</span>
        <span className="font-mono text-xs text-[var(--dp-teal)]">ark-ui</span>
      </div>
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

export default function DesignPreviewPage() {
  // ─── State for Ark UI components ──────────────────────────────────────────
  const [arkDialogOpen, setArkDialogOpen] = useState(false);
  const [arkFormDialogOpen, setArkFormDialogOpen] = useState(false);
  const [arkSwitchStates, setArkSwitchStates] = useState<Record<number, boolean>>({ 0: true, 1: false, 2: true, 3: true });
  const [arkSliderValues, setArkSliderValues] = useState<Record<number, number>>({ 0: 72, 1: 3, 2: 15 });
  const [arkRadioValue, setArkRadioValue] = useState("manager");
  const [arkCheckboxStates, setArkCheckboxStates] = useState<Record<number, boolean>>({ 0: true, 1: true, 2: true, 3: false, 4: false, 5: false });
  const [arkSelectValue, setArkSelectValue] = useState("Pacific Time (PST)");
  const [arkAccordionValue, setArkAccordionValue] = useState<string[]>(["plan"]);

  // ─── State for current shadcn components ──────────────────────────────────
  const [currentDialogOpen, setCurrentDialogOpen] = useState(false);
  const [currentTabsValue, setCurrentTabsValue] = useState("overview");

  const checkboxLabels = ["View dashboard", "Create tasks", "Edit tasks", "Delete tasks", "Manage users", "Emergency broadcasts"];

  const timezones = useMemo(
    () =>
      createListCollection({
        items: [
          { label: "Pacific Time (PST)", value: "Pacific Time (PST)" },
          { label: "Mountain Time (MST)", value: "Mountain Time (MST)" },
          { label: "Central Time (CST)", value: "Central Time (CST)" },
          { label: "Eastern Time (EST)", value: "Eastern Time (EST)" },
          { label: "UTC", value: "UTC" },
        ],
      }),
    []
  );

  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
      {/* Page header */}
      <div className="border-b border-border bg-card px-6 pb-4 pt-5">
        <h1 className="mb-1 text-lg font-bold text-foreground">
          Design Preview — Current vs. New (Ark UI + Linear)
        </h1>
        <p className="text-sm text-muted-foreground">
          Side-by-side comparison. Left = current shadcn/Radix components. Right = target Ark UI + Linear design.
          Both columns are fully interactive.
        </p>
      </div>

      {/* Two-column comparison grid */}
      <div className="grid grid-cols-2 gap-px bg-border">
        {/* ═════════════════════════════════════════════════════════════════════
            LEFT COLUMN — CURRENT (shadcn/Radix)
            ═════════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4 bg-background p-4">
          <ColumnHeader side="current" label="Current" sublabel="shadcn / Radix UI" />

          {/* Buttons */}
          <CurrentCell name="Buttons">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Add User</Button>
              <Button variant="outline">Export</Button>
              <Button variant="destructive">Delete</Button>
              <Button size="sm">Small</Button>
              <Button variant="outline" size="sm">Small Ghost</Button>
            </div>
          </CurrentCell>

          {/* Dialog */}
          <CurrentCell name="Dialog">
            <p className="mb-2 text-sm text-muted-foreground">Click to open the current dialog.</p>
            <Dialog open={currentDialogOpen} onOpenChange={setCurrentDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">Delete user account</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete user account?</DialogTitle>
                  <DialogDescription>
                    This will permanently remove David Santos and all associated data. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2">
                  <DialogClose asChild>
                    <Button variant="outline" size="sm">Cancel</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="destructive" size="sm">Delete account</Button>
                  </DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </CurrentCell>

          {/* Tabs */}
          <CurrentCell name="Tabs">
            <Tabs value={currentTabsValue} onValueChange={setCurrentTabsValue}>
              <TabsList variant="line">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Overview</strong> — summary stats and quick actions.
              </TabsContent>
              <TabsContent value="tasks" className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Tasks</strong> — 24 active tasks across 8 locations.
              </TabsContent>
              <TabsContent value="analytics" className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Analytics</strong> — completion trends, last 7 days.
              </TabsContent>
            </Tabs>
          </CurrentCell>

          {/* Badges */}
          <CurrentCell name="Badges">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Pill-shaped, background-filled. Status is communicated by background color.
            </p>
          </CurrentCell>

          {/* KPI Cards */}
          <CurrentCell name="KPI Cards">
            <div className="grid grid-cols-3 gap-2">
              <Card className="gap-2 p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total ARLs</span>
                <span className="font-mono text-xl font-bold text-foreground">12</span>
                <Badge variant="secondary" className="w-fit">3 active</Badge>
              </Card>
              <Card className="gap-2 border-destructive/30 p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inactive</span>
                <span className="font-mono text-xl font-bold text-destructive">2</span>
                <Badge variant="destructive" className="w-fit">Needs review</Badge>
              </Card>
              <Card className="gap-2 p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Locations</span>
                <span className="font-mono text-xl font-bold text-foreground">8</span>
                <Badge variant="secondary" className="w-fit">All online</Badge>
              </Card>
            </div>
          </CurrentCell>

          {/* Input + Label */}
          <CurrentCell name="Input + Label">
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-input">Display name</Label>
              <Input id="current-input" defaultValue="David Santos" />
            </div>
          </CurrentCell>
        </div>

        {/* ═════════════════════════════════════════════════════════════════════
            RIGHT COLUMN — NEW (Ark UI + Linear)
            ═════════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4 bg-[var(--dp-bg)] p-4">
          <ColumnHeader side="new" label="New" sublabel="Ark UI + Linear" />

          {/* Buttons */}
          <NewCell name="Buttons">
            <div className="flex flex-wrap items-center gap-2">
              <button className="dp-btn dp-btn-primary">Add User</button>
              <button className="dp-btn dp-btn-ghost">Export</button>
              <button className="dp-btn dp-btn-destructive">Delete</button>
              <button className="dp-btn dp-btn-primary dp-btn-sm">Small</button>
              <button className="dp-btn dp-btn-ghost dp-btn-sm">Small Ghost</button>
            </div>
            <div className="flex items-center gap-2">
              <button className="dp-btn-icon"><Icon icon={PencilSimple} size={16} /></button>
              <button className="dp-btn-icon"><Icon icon={Copy} size={16} /></button>
              <button className="dp-btn-icon dp-btn-icon-danger"><Icon icon={Trash} size={16} /></button>
              <button className="dp-btn-icon"><Icon icon={DotsThreeVertical} size={16} /></button>
            </div>
          </NewCell>

          {/* Dialog */}
          <NewCell name="Dialog">
            <p className="text-sm text-[var(--dp-text-secondary)]">Click to open the new Ark UI dialog.</p>
            <button className="dp-btn dp-btn-destructive" onClick={() => setArkDialogOpen(true)}>
              Delete user account
            </button>
          </NewCell>

          {/* Tabs */}
          <NewCell name="Tabs">
            <ArkTabs.Root defaultValue="overview" className="flex flex-col gap-3">
              <ArkTabs.List className="flex gap-0 border-b border-[var(--dp-border)]">
                <ArkTabs.Trigger value="overview" className="dp-tab" _data-selected={{ className: "dp-tab-active" }}>
                  Overview
                </ArkTabs.Trigger>
                <ArkTabs.Trigger value="tasks" className="dp-tab" _data-selected={{ className: "dp-tab-active" }}>
                  Tasks
                </ArkTabs.Trigger>
                <ArkTabs.Trigger value="analytics" className="dp-tab" _data-selected={{ className: "dp-tab-active" }}>
                  Analytics
                </ArkTabs.Trigger>
              </ArkTabs.List>
              <ArkTabs.Content value="overview" className="dp-tab-content" _data-selected={{ className: "dp-tab-content-active" }}>
                <strong className="text-[var(--dp-text)]">Overview</strong> — summary stats and quick actions.
              </ArkTabs.Content>
              <ArkTabs.Content value="tasks" className="dp-tab-content" _data-selected={{ className: "dp-tab-content-active" }}>
                <strong className="text-[var(--dp-text)]">Tasks</strong> — 24 active tasks across 8 locations.
              </ArkTabs.Content>
              <ArkTabs.Content value="analytics" className="dp-tab-content" _data-selected={{ className: "dp-tab-content-active" }}>
                <strong className="text-[var(--dp-text)]">Analytics</strong> — completion trends, last 7 days.
              </ArkTabs.Content>
            </ArkTabs.Root>
          </NewCell>

          {/* Badges */}
          <NewCell name="Badges">
            <div className="flex flex-wrap items-center gap-4">
              <span className="dp-badge"><span className="dp-badge-dot dp-dot-green" /> Online</span>
              <span className="dp-badge"><span className="dp-badge-dot dp-dot-amber" /> Reconnecting</span>
              <span className="dp-badge"><span className="dp-badge-dot dp-dot-red" /> Offline</span>
              <span className="dp-badge"><span className="dp-badge-dot dp-dot-teal" /> Remote active</span>
              <span className="dp-badge"><span className="dp-badge-dot dp-dot-muted" /> Inactive</span>
            </div>
            <p className="text-xs text-[var(--dp-text-tertiary)]">
              Dot + plain-weight label, no pill background (§10). Dot carries the semantic color.
            </p>
          </NewCell>

          {/* KPI Cards */}
          <NewCell name="KPI Cards">
            <div className="grid grid-cols-3 gap-2">
              <div className="dp-kpi-card">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dp-text-tertiary)]">Total ARLs</div>
                <div className="mb-1 font-mono text-xl font-bold leading-none text-[var(--dp-text)]">12</div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--dp-text-tertiary)]">
                  <span className="dp-badge-dot dp-dot-green" /> 3 active
                </div>
              </div>
              <div className="dp-kpi-card dp-kpi-urgent">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dp-text-tertiary)]">Inactive</div>
                <div className="mb-1 font-mono text-xl font-bold leading-none text-[var(--dp-brand)]">2</div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--dp-text-tertiary)]">
                  <span className="dp-badge-dot dp-dot-red" /> Needs review
                </div>
              </div>
              <div className="dp-kpi-card">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dp-text-tertiary)]">Locations</div>
                <div className="mb-1 font-mono text-xl font-bold leading-none text-[var(--dp-text)]">8</div>
                <div className="flex items-center gap-1.5 text-xs text-[var(--dp-text-tertiary)]">
                  <span className="dp-badge-dot dp-dot-green" /> All online
                </div>
              </div>
            </div>
          </NewCell>

          {/* Input + Label */}
          <NewCell name="Input + Label">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-[var(--dp-text)]" htmlFor="new-input">Display name</label>
              <input id="new-input" className="dp-input" defaultValue="David Santos" />
            </div>
          </NewCell>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          FULL-WIDTH SECTIONS — Ark UI only (no current equivalent)
          These primitives don't have a direct shadcn counterpart or the
          comparison is less important than seeing them work.
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="bg-[var(--dp-bg)] px-4 pb-10 pt-4">
        <SectionDivider label="Ark UI Primitives — Switch · Slider · Accordion · Radio · Select · Checkbox · Tooltip" />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {/* Switch */}
          <NewCell name="Switch">
            <div className="flex flex-col gap-2">
              {[
                { label: "Task notifications", idx: 0 },
                { label: "Email digest", idx: 1 },
                { label: "Auto-assign", idx: 2 },
                { label: "Emergency alerts", idx: 3 },
              ].map((item) => (
                <div key={item.idx} className="dp-switch-row">
                  <span className="text-sm font-semibold text-[var(--dp-text)]">{item.label}</span>
                  <ArkSwitch.Root
                    checked={arkSwitchStates[item.idx]}
                    onCheckedChange={({ checked }) => setArkSwitchStates((p) => ({ ...p, [item.idx]: checked }))}
                    className="dp-switch-track"
                    _data-checked={{ className: "dp-switch-on" }}
                  >
                    <ArkSwitch.Thumb className="dp-switch-thumb" />
                  </ArkSwitch.Root>
                </div>
              ))}
            </div>
          </NewCell>

          {/* Slider */}
          <NewCell name="Slider">
            <div className="flex flex-col gap-4">
              {[
                { label: "Volume", min: 0, max: 100, idx: 0 },
                { label: "Threshold", min: 0, max: 10, idx: 1 },
                { label: "Timeout (min)", min: 1, max: 60, idx: 2 },
              ].map((item) => (
                <div key={item.idx} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--dp-text-secondary)]">{item.label}</span>
                    <span className="font-mono text-sm font-semibold text-[var(--dp-text)]">{arkSliderValues[item.idx]}</span>
                  </div>
                  <ArkSlider.Root
                    min={item.min}
                    max={item.max}
                    value={[arkSliderValues[item.idx]]}
                    onValueChange={({ value }) => setArkSliderValues((p) => ({ ...p, [item.idx]: value[0] }))}
                    className="dp-slider-track-wrap"
                  >
                    <ArkSlider.Control className="dp-slider-control">
                      <ArkSlider.Track className="dp-slider-track">
                        <ArkSlider.Range className="dp-slider-fill" />
                      </ArkSlider.Track>
                      <ArkSlider.Thumb index={0} className="dp-slider-thumb">
                        <ArkSlider.HiddenInput />
                      </ArkSlider.Thumb>
                    </ArkSlider.Control>
                  </ArkSlider.Root>
                </div>
              ))}
            </div>
          </NewCell>

          {/* Accordion */}
          <NewCell name="Accordion">
            <ArkAccordion.Root
              value={arkAccordionValue}
              onValueChange={({ value }) => setArkAccordionValue(value as string[])}
              multiple
              className="flex flex-col"
            >
              {[
                { id: "plan", title: "Plan & Billing", body: "Current plan: Business · 8 locations · $240/mo." },
                { id: "branding", title: "Branding", body: "Upload a logo, set display name, configure brand colors." },
                { id: "domain", title: "Domain & Assets", body: "Custom domain mapping, SSL certificates, CDN config." },
                { id: "timezone", title: "Timezone & Locale", body: "Default timezone for all locations. Individual locations can override." },
              ].map((item) => (
                <ArkAccordion.Item key={item.id} value={item.id} className="dp-accordion-item">
                  <ArkAccordion.ItemTrigger className="dp-accordion-trigger">
                    {item.title}
                    <ArkAccordion.ItemIndicator className="dp-accordion-chevron">
                      <Icon icon={CaretRight} size={12} />
                    </ArkAccordion.ItemIndicator>
                  </ArkAccordion.ItemTrigger>
                  <ArkAccordion.ItemContent className="dp-accordion-content">
                    <div className="dp-accordion-content-inner">{item.body}</div>
                  </ArkAccordion.ItemContent>
                </ArkAccordion.Item>
              ))}
            </ArkAccordion.Root>
          </NewCell>

          {/* Radio Group */}
          <NewCell name="Radio Group">
            <ArkRadioGroup.Root
              value={arkRadioValue}
              onValueChange={({ value }) => value && setArkRadioValue(value)}
              className="flex flex-col gap-2"
            >
              {[
                { value: "arl", label: "ARL Staff", desc: "Standard location access" },
                { value: "manager", label: "Manager", desc: "Location-level admin" },
                { value: "admin", label: "Admin", desc: "Full console access" },
              ].map((item) => (
                <ArkRadioGroup.Item
                  key={item.value}
                  value={item.value}
                  className="dp-radio-item"
                  _data-checked={{ className: "dp-radio-selected" }}
                >
                  <ArkRadioGroup.Indicator className="dp-radio-indicator" />
                  <div>
                    <div className="text-sm font-semibold text-[var(--dp-text)]">{item.label}</div>
                    <div className="text-xs text-[var(--dp-text-tertiary)]">{item.desc}</div>
                  </div>
                </ArkRadioGroup.Item>
              ))}
            </ArkRadioGroup.Root>
          </NewCell>

          {/* Select */}
          <NewCell name="Select">
            <ArkSelect.Root
              collection={timezones}
              value={[arkSelectValue]}
              onValueChange={({ value }) => value[0] && setArkSelectValue(value[0] as string)}
              positioning={{ sameWidth: true }}
            >
              <ArkSelect.Control>
                <ArkSelect.Trigger className="dp-select-trigger">
                  <ArkSelect.ValueText>{arkSelectValue}</ArkSelect.ValueText>
                  <ArkSelect.Indicator className="dp-select-chevron">
                    <Icon icon={CaretDown} size={12} />
                  </ArkSelect.Indicator>
                </ArkSelect.Trigger>
              </ArkSelect.Control>
              <ArkSelect.Positioner className="dp-select-positioner">
                <ArkSelect.Content className="dp-select-menu">
                  {timezones.items.map((tz) => (
                    <ArkSelect.Item key={tz.value} item={tz} className="dp-select-option">
                      <ArkSelect.ItemText>{tz.label}</ArkSelect.ItemText>
                      <ArkSelect.ItemIndicator className="dp-select-check">
                        <Icon icon={Check} size={14} />
                      </ArkSelect.ItemIndicator>
                    </ArkSelect.Item>
                  ))}
                </ArkSelect.Content>
              </ArkSelect.Positioner>
            </ArkSelect.Root>
          </NewCell>

          {/* Checkbox */}
          <NewCell name="Checkbox">
            <div className="flex flex-col gap-2">
              {checkboxLabels.map((label, idx) => (
                <ArkCheckbox.Root
                  key={idx}
                  checked={arkCheckboxStates[idx]}
                  onCheckedChange={({ checked }) => setArkCheckboxStates((p) => ({ ...p, [idx]: checked === true }))}
                  className="dp-checkbox-group flex cursor-pointer items-center gap-2.5"
                >
                  <ArkCheckbox.Control className="dp-checkbox">
                    <ArkCheckbox.Indicator>
                      <Icon icon={Check} size={12} />
                    </ArkCheckbox.Indicator>
                  </ArkCheckbox.Control>
                  <span className="text-sm text-[var(--dp-text)]">{label}</span>
                </ArkCheckbox.Root>
              ))}
            </div>
          </NewCell>

          {/* Tooltip */}
          <NewCell name="Tooltip">
            <div className="flex items-center gap-4 py-3">
              <ArkTooltip.Root>
                <ArkTooltip.Trigger className="dp-btn-icon">
                  <Icon icon={GearSix} size={16} />
                </ArkTooltip.Trigger>
                <ArkTooltip.Positioner>
                  <ArkTooltip.Content className="dp-tooltip">Settings</ArkTooltip.Content>
                </ArkTooltip.Positioner>
              </ArkTooltip.Root>
              <ArkTooltip.Root>
                <ArkTooltip.Trigger className="dp-btn-icon">
                  <Icon icon={Bell} size={16} />
                </ArkTooltip.Trigger>
                <ArkTooltip.Positioner>
                  <ArkTooltip.Content className="dp-tooltip">Notifications</ArkTooltip.Content>
                </ArkTooltip.Positioner>
              </ArkTooltip.Root>
              <ArkTooltip.Root>
                <ArkTooltip.Trigger className="dp-btn-icon">
                  <Icon icon={SignOut} size={16} />
                </ArkTooltip.Trigger>
                <ArkTooltip.Positioner>
                  <ArkTooltip.Content className="dp-tooltip">Sign out</ArkTooltip.Content>
                </ArkTooltip.Positioner>
              </ArkTooltip.Root>
            </div>
            <p className="text-xs text-[var(--dp-text-tertiary)]">Hover or keyboard-focus to reveal.</p>
          </NewCell>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          Ark UI Dialogs (rendered at end, portaled)
          ═════════════════════════════════════════════════════════════════════ */}
      {/* Confirmation dialog */}
      <ArkDialog.Root open={arkDialogOpen} onOpenChange={({ open }) => setArkDialogOpen(open)}>
        <ArkDialog.Backdrop className="dp-dialog-backdrop" />
        <ArkDialog.Positioner className="dp-dialog-positioner">
          <ArkDialog.Content className="dp-dialog">
            <ArkDialog.Title className="dp-dialog-title">Delete user account?</ArkDialog.Title>
            <ArkDialog.Description className="dp-dialog-desc">
              This will permanently remove David Santos and all associated data. This action cannot be undone.
            </ArkDialog.Description>
            <div className="flex justify-end gap-2">
              <ArkDialog.CloseTrigger className="dp-btn dp-btn-ghost dp-btn-sm">Cancel</ArkDialog.CloseTrigger>
              <ArkDialog.CloseTrigger className="dp-btn dp-btn-destructive dp-btn-sm">Delete account</ArkDialog.CloseTrigger>
            </div>
            <ArkDialog.CloseTrigger className="dp-dialog-close">
              <Icon icon={X} size={16} />
            </ArkDialog.CloseTrigger>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </ArkDialog.Root>

      {/* Form dialog */}
      <ArkDialog.Root open={arkFormDialogOpen} onOpenChange={({ open }) => setArkFormDialogOpen(open)}>
        <ArkDialog.Backdrop className="dp-dialog-backdrop" />
        <ArkDialog.Positioner className="dp-dialog-positioner">
          <ArkDialog.Content className="dp-dialog">
            <ArkDialog.Title className="dp-dialog-title">Edit profile</ArkDialog.Title>
            <ArkDialog.Description className="dp-dialog-desc">Update the display name for this user.</ArkDialog.Description>
            <input className="dp-input" type="text" defaultValue="David Santos" placeholder="Display name" />
            <div className="flex justify-end gap-2">
              <ArkDialog.CloseTrigger className="dp-btn dp-btn-ghost dp-btn-sm">Cancel</ArkDialog.CloseTrigger>
              <ArkDialog.CloseTrigger className="dp-btn dp-btn-primary dp-btn-sm">Save changes</ArkDialog.CloseTrigger>
            </div>
            <ArkDialog.CloseTrigger className="dp-dialog-close">
              <Icon icon={X} size={16} />
            </ArkDialog.CloseTrigger>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </ArkDialog.Root>
    </div>
  );
}
