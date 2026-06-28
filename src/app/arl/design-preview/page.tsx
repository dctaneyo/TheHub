"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Dialog,
  Switch,
  Tabs,
  Accordion,
  Slider,
  RadioGroup,
  Checkbox,
  Select,
  Tooltip,
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
  Key,
  ClipboardText,
  CaretDown,
  CaretRight,
  X,
  Check,
  Moon,
  Sun,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { IconWeight } from "@phosphor-icons/react";

/* ════════════════════════════════════════════════════════════════════════════
   DESIGN PREVIEW — Ark UI + Linear (Refined)
   
   This route demonstrates the target design system using real Ark UI
   primitives with the refined Linear aesthetic. Every primitive is fully
   interactive — these are the actual Ark UI components, not mockups.
   
   Design tokens follow DESIGN.md:
   - §1: Four-size type scale (12/14/18/24), Space Mono for numerics
   - §3: 12px card rounding (house style)
   - §7: One dominant element per screen
   - §8: Dark mode = warm near-black, light mode = warm off-white (deliberate)
   - §10: Solid inverted fill for selection, dot+label for status
   - §14: Phosphor regular weight (clean single-stroke)
   - §17: Warm-tinted palette, not stock zinc
   ════════════════════════════════════════════════════════════════════════════ */

// ─── Phosphor icon wrapper (regular weight, matching src/lib/icons.tsx) ────
type PhosphorIconProps = { weight?: IconWeight; className?: string; size?: number };
function Icon({ icon: Ic, className, size }: { icon: React.ComponentType<PhosphorIconProps>; className?: string; size?: number }) {
  return <Ic weight="regular" className={className} size={size} />;
}

// ─── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--dp-text-tertiary)] whitespace-nowrap">
          {title}
        </span>
        <div className="h-px flex-1 bg-[var(--dp-border)]" />
        {note && <span className="text-xs text-[var(--dp-text-tertiary)] whitespace-nowrap">{note}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Primitive cell ─────────────────────────────────────────────────────────
function Cell({ name, tag, children }: { name: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--dp-radius)] border border-[var(--dp-border)] bg-[var(--dp-surface-1)] p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--dp-text-tertiary)]">{name}</span>
        <span className="font-mono text-xs text-[var(--dp-teal)]">{tag}</span>
      </div>
      {children}
    </div>
  );
}

export default function DesignPreviewPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [switchStates, setSwitchStates] = useState<Record<number, boolean>>({
    0: true, 1: false, 2: true, 3: true,
  });
  const [sliderValues, setSliderValues] = useState<Record<number, number>>({ 0: 72, 1: 3, 2: 15 });
  const [radioValue, setRadioValue] = useState("manager");
  const [checkboxStates, setCheckboxStates] = useState<Record<number, boolean>>({
    0: true, 1: true, 2: true, 3: false, 4: false, 5: false,
  });
  const [selectValue, setSelectValue] = useState("Pacific Time (PST)");
  const [accordionValue, setAccordionValue] = useState<string[]>(["plan"]);
  const constCheckboxLabels = [
    "View dashboard",
    "Create tasks",
    "Edit tasks",
    "Delete tasks",
    "Manage users",
    "Emergency broadcasts",
  ];

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
    <div className="flex-1 overflow-y-auto overscroll-contain">
      {/* Page header */}
      <div className="border-b border-[var(--dp-chrome-border)] bg-[var(--dp-chrome-bg)] px-10 pb-5 pt-7">
        <h1 className="mb-2 text-[24px] font-bold text-[var(--dp-text)]">
          Design Preview — Ark UI + Linear (Refined)
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--dp-text-tertiary)]">
          Real Ark UI primitives with the refined Linear aesthetic. Every component below is fully
          interactive — these are the actual <code className="font-mono text-xs">@ark-ui/react</code> components,
          not HTML mockups. Warm-tinted palette, Phosphor regular weight, 12px rounding, four-size type scale.
          Audited against DESIGN.md.
        </p>
      </div>

      {/* Audit summary strip */}
      <div className="grid grid-cols-7 border-b border-[var(--dp-chrome-border)] bg-[var(--dp-chrome-bg)]">
        {[
          { label: "§17 Palette", was: "stock zinc", fix: "warm-tinted" },
          { label: "§7 Primary", was: "invisible", fix: "high contrast" },
          { label: "§3 Rounding", was: "8px", fix: "12px" },
          { label: "§1 Floor", was: "10-11px", fix: "12px min" },
          { label: "§1 Scale", was: "13/22px", fix: "12/14/18/24" },
          { label: "§10 Select", was: "left bar", fix: "solid fill" },
          { label: "§8 BG", was: "#0c0c0c", fix: "#0e0c0d" },
        ].map((item) => (
          <div key={item.label} className="border-r border-[var(--dp-border)] px-4 py-3 last:border-r-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--dp-text-tertiary)]">
              {item.label}
            </div>
            <div className="text-xs text-[var(--dp-text-tertiary)] line-through">{item.was}</div>
            <div className="text-xs font-semibold text-[var(--dp-emerald)]">{item.fix}</div>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-6xl px-10 py-8 pb-20">

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 1: BUTTONS + TOOLTIP
            ══════════════════════════════════════════════════════════════════ */}
        <Section title="Buttons & Tooltip" note="§7 hierarchy — primary dominates, ghost recedes">
          <div className="grid grid-cols-2 gap-4">
            <Cell name="Button variants" tag="button.tsx">
              <div className="flex flex-wrap items-center gap-2.5">
                <button className="dp-btn dp-btn-primary">Add User</button>
                <button className="dp-btn dp-btn-ghost">Export</button>
                <button className="dp-btn dp-btn-destructive">Delete</button>
                <button className="dp-btn dp-btn-primary dp-btn-sm">Small Primary</button>
                <button className="dp-btn dp-btn-ghost dp-btn-sm">Small Ghost</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--dp-text-tertiary)]">Icon buttons:</span>
                <button className="dp-btn-icon" title="Edit"><Icon icon={PencilSimple} size={16} /></button>
                <button className="dp-btn-icon" title="Copy"><Icon icon={Copy} size={16} /></button>
                <button className="dp-btn-icon dp-btn-icon-danger" title="Delete"><Icon icon={Trash} size={16} /></button>
                <button className="dp-btn-icon" title="More"><Icon icon={DotsThreeVertical} size={16} /></button>
              </div>
            </Cell>

            <Cell name="Tooltip" tag="tooltip.tsx">
              <Tooltip.Root>
                <Tooltip.Trigger className="dp-btn-icon" title="Settings">
                  <Icon icon={GearSix} size={16} />
                </Tooltip.Trigger>
                <Tooltip.Positioner>
                  <Tooltip.Content className="dp-tooltip">
                    Settings
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Tooltip.Root>
              <Tooltip.Root>
                <Tooltip.Trigger className="dp-btn-icon">
                  <Icon icon={Bell} size={16} />
                </Tooltip.Trigger>
                <Tooltip.Positioner>
                  <Tooltip.Content className="dp-tooltip">
                    Notifications
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Tooltip.Root>
              <Tooltip.Root>
                <Tooltip.Trigger className="dp-btn-icon">
                  <Icon icon={SignOut} size={16} />
                </Tooltip.Trigger>
                <Tooltip.Positioner>
                  <Tooltip.Content className="dp-tooltip">
                    Sign out
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Tooltip.Root>
              <p className="text-xs text-[var(--dp-text-tertiary)]">
                Hover or keyboard-focus to reveal. Ark UI handles positioning, delay, and touch fallback.
              </p>
            </Cell>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 2: DIALOG (Ark UI)
            ══════════════════════════════════════════════════════════════════ */}
        <Section title="Dialog" note="Ark UI Dialog — focus trap, Escape, overlay click">
          <div className="grid grid-cols-2 gap-4">
            <Cell name="Confirmation Dialog" tag="dialog.tsx">
              <p className="text-sm leading-relaxed text-[var(--dp-text-secondary)]">
                Destructive confirmation. Cancel is ghost, Delete is destructive red.
              </p>
              <button className="dp-btn dp-btn-destructive" onClick={() => setDialogOpen(true)}>
                Delete user account
              </button>
            </Cell>

            <Cell name="Form Dialog" tag="dialog.tsx">
              <p className="text-sm leading-relaxed text-[var(--dp-text-secondary)]">
                Form dialog with input. Save is primary (high-contrast), Cancel is ghost.
              </p>
              <button className="dp-btn dp-btn-primary" onClick={() => setFormDialogOpen(true)}>
                Edit profile
              </button>
            </Cell>
          </div>
        </Section>

        {/* Ark UI Dialog: Confirmation */}
        <Dialog.Root open={dialogOpen} onOpenChange={({ open }) => setDialogOpen(open)}>
          <Dialog.Backdrop className="dp-dialog-backdrop" />
          <Dialog.Positioner className="dp-dialog-positioner">
            <Dialog.Content className="dp-dialog">
              <Dialog.Title className="dp-dialog-title">Delete user account?</Dialog.Title>
              <Dialog.Description className="dp-dialog-desc">
                This will permanently remove David Santos and all associated data. This action cannot be undone.
              </Dialog.Description>
              <div className="flex justify-end gap-2">
                <Dialog.CloseTrigger className="dp-btn dp-btn-ghost dp-btn-sm">Cancel</Dialog.CloseTrigger>
                <Dialog.CloseTrigger className="dp-btn dp-btn-destructive dp-btn-sm">Delete account</Dialog.CloseTrigger>
              </div>
              <Dialog.CloseTrigger className="dp-dialog-close">
                <Icon icon={X} size={16} />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>

        {/* Ark UI Dialog: Form */}
        <Dialog.Root open={formDialogOpen} onOpenChange={({ open }) => setFormDialogOpen(open)}>
          <Dialog.Backdrop className="dp-dialog-backdrop" />
          <Dialog.Positioner className="dp-dialog-positioner">
            <Dialog.Content className="dp-dialog">
              <Dialog.Title className="dp-dialog-title">Edit profile</Dialog.Title>
              <Dialog.Description className="dp-dialog-desc">
                Update the display name for this user.
              </Dialog.Description>
              <input className="dp-input" type="text" defaultValue="David Santos" placeholder="Display name" />
              <div className="flex justify-end gap-2">
                <Dialog.CloseTrigger className="dp-btn dp-btn-ghost dp-btn-sm">Cancel</Dialog.CloseTrigger>
                <Dialog.CloseTrigger className="dp-btn dp-btn-primary dp-btn-sm">Save changes</Dialog.CloseTrigger>
              </div>
              <Dialog.CloseTrigger className="dp-dialog-close">
                <Icon icon={X} size={16} />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3: TABS (Ark UI)
            ══════════════════════════════════════════════════════════════════ */}
        <Section title="Tabs" note="Ark UI Tabs — keyboard arrows, focus management">
          <Cell name="Tab Group" tag="tabs.tsx">
            <Tabs.Root defaultValue="overview" className="flex flex-col gap-4">
              <Tabs.List className="flex gap-0 border-b border-[var(--dp-border)]">
                <Tabs.Trigger
                  value="overview"
                  className="dp-tab"
                  _data-selected={{ className: "dp-tab-active" }}
                >
                  Overview
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="tasks"
                  className="dp-tab"
                  _data-selected={{ className: "dp-tab-active" }}
                >
                  Tasks
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="analytics"
                  className="dp-tab"
                  _data-selected={{ className: "dp-tab-active" }}
                >
                  Analytics
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="settings"
                  className="dp-tab"
                  _data-selected={{ className: "dp-tab-active" }}
                >
                  Settings
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content
                value="overview"
                className="dp-tab-content"
                _data-selected={{ className: "dp-tab-content-active" }}
              >
                <strong className="text-[var(--dp-text)]">Overview</strong> — summary stats, recent activity, and quick actions. This is the default landing tab.
              </Tabs.Content>
              <Tabs.Content
                value="tasks"
                className="dp-tab-content"
                _data-selected={{ className: "dp-tab-content-active" }}
              >
                <strong className="text-[var(--dp-text)]">Tasks</strong> — full task list with filters, assignments, and completion tracking. 24 active tasks across 8 locations.
              </Tabs.Content>
              <Tabs.Content
                value="analytics"
                className="dp-tab-content"
                _data-selected={{ className: "dp-tab-content-active" }}
              >
                <strong className="text-[var(--dp-text)]">Analytics</strong> — completion trends, location performance, and meeting analytics. Date range: last 7 days.
              </Tabs.Content>
              <Tabs.Content
                value="settings"
                className="dp-tab-content"
                _data-selected={{ className: "dp-tab-content-active" }}
              >
                <strong className="text-[var(--dp-text)]">Settings</strong> — tenant configuration, branding, timezone, and domain settings. Changes save automatically.
              </Tabs.Content>
            </Tabs.Root>
          </Cell>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 4: ACCORDION (Ark UI)
            ══════════════════════════════════════════════════════════════════ */}
        <Section title="Accordion" note="Ark UI Accordion — keyboard, single/multiple">
          <Cell name="Settings Accordion" tag="accordion.tsx">
            <Accordion.Root
              value={accordionValue}
              onValueChange={({ value }) => setAccordionValue(value as string[])}
              multiple
              className="flex flex-col"
            >
              {[
                { id: "plan", title: "Plan & Billing", body: "Current plan: Business · 8 locations · $240/mo. Next renewal: July 15, 2026. Upgrade to Enterprise for unlimited locations and priority support." },
                { id: "branding", title: "Branding", body: "Upload a logo, set display name, and configure brand colors used across kiosk screens. Logo appears on login screen and dashboard header." },
                { id: "domain", title: "Domain & Assets", body: "Custom domain mapping, SSL certificates, and CDN asset configuration. Changes propagate within 5 minutes." },
                { id: "timezone", title: "Timezone & Locale", body: "Default timezone for all locations. Individual locations can override. Locale affects date formatting and day-of-week labels." },
              ].map((item) => (
                <Accordion.Item key={item.id} value={item.id} className="dp-accordion-item">
                  <Accordion.ItemTrigger className="dp-accordion-trigger">
                    {item.title}
                    <Accordion.ItemIndicator className="dp-accordion-chevron">
                      <Icon icon={CaretRight} size={12} />
                    </Accordion.ItemIndicator>
                  </Accordion.ItemTrigger>
                  <Accordion.ItemContent className="dp-accordion-content">
                    <div className="dp-accordion-content-inner">{item.body}</div>
                  </Accordion.ItemContent>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </Cell>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 5: SWITCH + SLIDER (Ark UI)
            ══════════════════════════════════════════════════════════════════ */}
        <Section title="Switch & Slider" note="Ark UI — keyboard, touch, RTL">
          <div className="grid grid-cols-2 gap-4">
            <Cell name="Switch / Toggle" tag="switch.tsx">
              <div className="flex flex-col gap-3">
                {[
                  { label: "Task notifications", desc: "Alert on new assignments", idx: 0 },
                  { label: "Email digest", desc: "Daily summary at 8am", idx: 1 },
                  { label: "Auto-assign tasks", desc: "Based on location proximity", idx: 2 },
                  { label: "Emergency broadcasts", desc: "Critical alerts only", idx: 3 },
                ].map((item) => (
                  <div key={item.idx} className="dp-switch-row">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-[var(--dp-text)]">{item.label}</span>
                      <span className="text-xs text-[var(--dp-text-tertiary)]">{item.desc}</span>
                    </div>
                    <Switch.Root
                      checked={switchStates[item.idx]}
                      onCheckedChange={({ checked }) =>
                        setSwitchStates((prev) => ({ ...prev, [item.idx]: checked }))
                      }
                      className="dp-switch-track"
                      _data-checked={{ className: "dp-switch-on" }}
                    >
                      <Switch.Thumb className="dp-switch-thumb" />
                    </Switch.Root>
                  </div>
                ))}
              </div>
            </Cell>

            <Cell name="Slider" tag="slider.tsx">
              <div className="flex flex-col gap-5">
                {[
                  { label: "Volume", min: 0, max: 100, idx: 0 },
                  { label: "Notification threshold", min: 0, max: 10, idx: 1 },
                  { label: "Session timeout (minutes)", min: 1, max: 60, idx: 2 },
                ].map((item) => (
                  <div key={item.idx} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--dp-text-secondary)]">{item.label}</span>
                      <span className="font-mono text-sm font-semibold text-[var(--dp-text)]">
                        {sliderValues[item.idx]}
                      </span>
                    </div>
                    <Slider.Root
                      min={item.min}
                      max={item.max}
                      value={[sliderValues[item.idx]]}
                      onValueChange={({ value }) =>
                        setSliderValues((prev) => ({ ...prev, [item.idx]: value[0] }))
                      }
                      className="dp-slider-track-wrap"
                    >
                      <Slider.Control className="dp-slider-control">
                        <Slider.Track className="dp-slider-track">
                          <Slider.Range className="dp-slider-fill" />
                        </Slider.Track>
                        <Slider.Thumb index={0} className="dp-slider-thumb">
                          <Slider.HiddenInput />
                        </Slider.Thumb>
                      </Slider.Control>
                    </Slider.Root>
                  </div>
                ))}
              </div>
            </Cell>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 6: RADIO GROUP + SELECT + CHECKBOX (Ark UI)
            ══════════════════════════════════════════════════════════════════ */}
        <Section title="Radio Group · Select · Checkbox" note="§10 solid inverted fill">
          <div className="grid grid-cols-3 gap-4">
            <Cell name="Radio Group" tag="radio-group.tsx">
              <RadioGroup.Root
                value={radioValue}
                onValueChange={({ value }) => value && setRadioValue(value)}
                className="flex flex-col gap-2"
              >
                {[
                  { value: "arl", label: "ARL Staff", desc: "Standard location access" },
                  { value: "manager", label: "Manager", desc: "Location-level admin" },
                  { value: "admin", label: "Admin", desc: "Full console access" },
                ].map((item) => (
                  <RadioGroup.Item
                    key={item.value}
                    value={item.value}
                    className="dp-radio-item"
                    _data-checked={{ className: "dp-radio-selected" }}
                  >
                    <RadioGroup.Indicator className="dp-radio-indicator" />
                    <div>
                      <div className="text-sm font-semibold text-[var(--dp-text)]">{item.label}</div>
                      <div className="text-xs text-[var(--dp-text-tertiary)]">{item.desc}</div>
                    </div>
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            </Cell>

            <Cell name="Select" tag="select.tsx">
              <Select.Root
                collection={timezones}
                value={[selectValue]}
                onValueChange={({ value }) => value[0] && setSelectValue(value[0] as string)}
                positioning={{ sameWidth: true }}
              >
                <Select.Control>
                  <Select.Trigger className="dp-select-trigger">
                    <Select.ValueText>{selectValue}</Select.ValueText>
                    <Select.Indicator className="dp-select-chevron">
                      <Icon icon={CaretDown} size={12} />
                    </Select.Indicator>
                  </Select.Trigger>
                </Select.Control>
                <Select.Positioner className="dp-select-positioner">
                  <Select.Content className="dp-select-menu">
                    {timezones.items.map((tz) => (
                      <Select.Item
                        key={tz.value}
                        item={tz}
                        className="dp-select-option"
                      >
                        <Select.ItemText>{tz.label}</Select.ItemText>
                        <Select.ItemIndicator className="dp-select-check">
                          <Icon icon={Check} size={14} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Select.Root>

              <div className="mt-4">
                <div className="mb-2 text-xs text-[var(--dp-text-tertiary)]">Progress (read-only):</div>
                <div className="flex flex-col gap-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--dp-border)]">
                    <div className="h-full rounded-full bg-[var(--dp-text)]" style={{ width: "68%" }} />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--dp-text-tertiary)]">
                    <span>68% complete</span><span>17/25</span>
                  </div>
                </div>
                <div className="h-2.5" />
                <div className="flex flex-col gap-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--dp-border)]">
                    <div className="h-full rounded-full bg-[var(--dp-amber)]" style={{ width: "45%" }} />
                  </div>
                  <div className="flex justify-between text-xs text-[var(--dp-text-tertiary)]">
                    <span>Storage used</span><span>4.5/10 GB</span>
                  </div>
                </div>
              </div>
            </Cell>

            <Cell name="Checkbox Group" tag="checkbox.tsx">
              <div className="flex flex-col gap-2.5">
                {constCheckboxLabels.map((label, idx) => (
                  <Checkbox.Root
                    key={idx}
                    checked={checkboxStates[idx]}
                    onCheckedChange={({ checked }) =>
                      setCheckboxStates((prev) => ({ ...prev, [idx]: checked === true }))
                    }
                    className="dp-checkbox-group flex items-center gap-2.5 cursor-pointer"
                  >
                    <Checkbox.Control className="dp-checkbox">
                      <Checkbox.Indicator>
                        <Icon icon={Check} size={12} />
                      </Checkbox.Indicator>
                    </Checkbox.Control>
                    <span className="text-sm text-[var(--dp-text)]">{label}</span>
                  </Checkbox.Root>
                ))}
              </div>
            </Cell>
          </div>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 7: BADGES / STATUS PATTERNS
            ══════════════════════════════════════════════════════════════════ */}
        <Section title="Badges & Status Patterns" note="§10 — dot + plain-weight label, no pill background">
          <Cell name="Status Variations" tag="badge.tsx">
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center gap-5">
                <span className="dp-badge"><span className="dp-badge-dot dp-dot-green" /> Online</span>
                <span className="dp-badge"><span className="dp-badge-dot dp-dot-amber" /> Reconnecting</span>
                <span className="dp-badge"><span className="dp-badge-dot dp-dot-red" /> Offline</span>
                <span className="dp-badge"><span className="dp-badge-dot dp-dot-teal" /> Remote session active</span>
                <span className="dp-badge"><span className="dp-badge-dot dp-dot-muted" /> Inactive</span>
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <span className="dp-badge dp-badge-amber"><span className="dp-badge-dot dp-dot-amber" /> Admin</span>
                <span className="dp-badge dp-badge-teal"><span className="dp-badge-dot dp-dot-teal" /> ARL</span>
                <span className="dp-badge dp-badge-muted"><span className="dp-badge-dot dp-dot-muted" /> Location Staff</span>
              </div>
              <p className="text-xs text-[var(--dp-text-tertiary)]">
                Dot carries the semantic color. Label stays plain-weight. No pill background — the dot+label is the unit (§10).
              </p>
            </div>
          </Cell>
        </Section>

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 8: KPI CARDS (§7 hierarchy — no accent bar)
            ══════════════════════════════════════════════════════════════════ */}
        <Section title="KPI Cards" note="§7 hierarchy — red value + red dot, no accent bar">
          <div className="grid grid-cols-3 gap-3">
            <div className="dp-kpi-card">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dp-text-tertiary)]">Total ARLs</div>
              <div className="mb-1.5 font-mono text-[24px] font-bold leading-none text-[var(--dp-text)]">12</div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--dp-text-tertiary)]">
                <span className="dp-badge-dot dp-dot-green" /> 3 active sessions
              </div>
            </div>
            <div className="dp-kpi-card dp-kpi-urgent">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dp-text-tertiary)]">Inactive Users</div>
              <div className="mb-1.5 font-mono text-[24px] font-bold leading-none text-[var(--dp-brand)]">2</div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--dp-text-tertiary)]">
                <span className="dp-badge-dot dp-dot-red" /> Needs review
              </div>
            </div>
            <div className="dp-kpi-card">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--dp-text-tertiary)]">Locations</div>
              <div className="mb-1.5 font-mono text-[24px] font-bold leading-none text-[var(--dp-text)]">8</div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--dp-text-tertiary)]">
                <span className="dp-badge-dot dp-dot-green" /> All online
              </div>
            </div>
          </div>
        </Section>

      </div>

      {/* Footer */}
      <div className="mt-10 border-t border-[var(--dp-chrome-border)] px-10 py-6 pb-10">
        <div className="max-w-3xl text-xs leading-relaxed text-[var(--dp-text-tertiary)]">
          <strong className="text-xs font-bold uppercase tracking-wide text-[var(--dp-text-secondary)]">
            Ark UI + Linear (Refined)
          </strong>
          <br />
          All primitives above use <code className="font-mono text-xs text-[var(--dp-text-secondary)]">@ark-ui/react</code> components
          with Zag.js state machines. Warm-tinted palette (§17), Phosphor regular weight (§14), 12px rounding (§3),
          four-size type scale (§1), solid inverted fill for selection (§10), high-contrast primary button (§7).
          Light mode is a deliberate pass per §8 — not a naive invert.
        </div>
      </div>
    </div>
  );
}
