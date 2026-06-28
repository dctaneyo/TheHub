"use client";

import { useState, useEffect } from "react";
import {
  Dialog as ArkDialog,
  Switch as ArkSwitch,
  Tabs as ArkTabs,
  Select as ArkSelect,
  createListCollection,
} from "@ark-ui/react";
import {
  PencilSimple,
  Trash,
  CaretDown,
  Check,
  X,
  Moon,
  Sun,
  CheckSquare,
  ChatCircleText,
  CalendarBlank,
  FileText,
  Quotes,
  Siren,
  House,
  GearSix,
} from "@phosphor-icons/react";
import "./preview.css";

/* ════════════════════════════════════════════════════════════════════════════
   DESIGN PREVIEW — standalone, no auth (see middleware.ts).

   Two real screens, not isolated swatches:
     1. ARL Console  — dense admin surface (Linear-inspired)
     2. Main Dashboard (Kiosk) — restaurant-facing, glance-and-tap surface
        (Toast POS-inspired layout, app's own colors — not Toast's palette)

   Both share the same light/dark + "direction" controls. Background, card,
   and primary text colors are pinned to the app's real tokens in every
   direction — only the primary action color (and the chrome built around it)
   changes. See preview.css for the token wiring.
   ════════════════════════════════════════════════════════════════════════════ */

type Direction = "neutral" | "brand" | "tinted";
type Surface = "console" | "kiosk";
type Status = "online" | "reconnecting" | "offline" | "remote" | "inactive";

const DIRECTIONS: { id: Direction; label: string; blurb: string }[] = [
  {
    id: "neutral",
    label: "A — Neutral",
    blurb:
      "Primary action is near-black on light / near-white on dark — content-first, lowest visual noise. Status dots + plain pills carry all the color. (Linear, Vercel, Raycast.)",
  },
  {
    id: "brand",
    label: "B — Brand Red",
    blurb:
      "Primary action is a solid brand-red fill. High-visibility, matches the sidebar accent today — but spends the same red the urgency system uses for \"offline\"/\"destructive.\"",
  },
  {
    id: "tinted",
    label: "C — Tinted Brand",
    blurb:
      "Primary action is a soft red-tinted fill with red text. Softer presence than B, still reads as branded — a middle ground between A and B.",
  },
];

const STATUS_META: Record<Status, { label: string; dot: string; pill: string; outline: string }> = {
  online: { label: "Online", dot: "dp-dot-green", pill: "dp-badge-pill-green", outline: "dp-badge-outline-green" },
  reconnecting: { label: "Reconnecting", dot: "dp-dot-amber", pill: "dp-badge-pill-amber", outline: "dp-badge-outline-amber" },
  offline: { label: "Offline", dot: "dp-dot-red", pill: "dp-badge-pill-red", outline: "dp-badge-outline-red" },
  remote: { label: "Remote active", dot: "dp-dot-teal", pill: "dp-badge-pill-teal", outline: "dp-badge-outline-teal" },
  inactive: { label: "Inactive", dot: "dp-dot-muted", pill: "dp-badge-pill-muted", outline: "dp-badge-outline-muted" },
};

function StatusBadge({ status, direction }: { status: Status; direction: Direction }) {
  const meta = STATUS_META[status];
  if (direction === "neutral") {
    return (
      <span className="dp-badge-dot">
        <span className={`dp-dot ${meta.dot}`} />
        {meta.label}
      </span>
    );
  }
  if (direction === "brand") {
    return <span className={`dp-badge-pill ${meta.pill}`}>{meta.label}</span>;
  }
  return <span className={`dp-badge-outline ${meta.outline}`}>{meta.label}</span>;
}

// Tabs (Underline) and Inputs (Bordered) are decided — DESIGN.md §15 — and
// no longer vary with the primary-color direction below.
const TAB_LIST_CLASS = "dp-tabs-underline-list";
const TAB_TRIGGER_CLASS = "dp-tab-underline";
const INPUT_CLASS = "dp-input-bordered";

const locations = [
  { name: "Downtown — 5th Ave", region: "West", status: "online" as Status, lastSync: "2 min ago" },
  { name: "Riverside Plaza", region: "East", status: "remote" as Status, lastSync: "just now" },
  { name: "Harbor View", region: "West", status: "reconnecting" as Status, lastSync: "11 min ago" },
  { name: "Old Town Square", region: "Central", status: "offline" as Status, lastSync: "3 hrs ago" },
  { name: "Lakeside Commons", region: "Central", status: "inactive" as Status, lastSync: "2 days ago" },
];

const regions = createListCollection({
  items: [
    { label: "West", value: "West" },
    { label: "East", value: "East" },
    { label: "Central", value: "Central" },
  ],
});

function ConsoleMockup({ direction }: { direction: Direction }) {
  const [tab, setTab] = useState("overview");
  const [newOpen, setNewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [region, setRegion] = useState(["West"]);
  const [active, setActive] = useState(true);

  return (
    <div className="dp-page">
      <ArkTabs.Root value={tab} onValueChange={(d) => setTab(d.value)}>
        <ArkTabs.List className={TAB_LIST_CLASS}>
          <ArkTabs.Trigger value="overview" className={TAB_TRIGGER_CLASS}>Overview</ArkTabs.Trigger>
          <ArkTabs.Trigger value="locations" className={TAB_TRIGGER_CLASS}>Locations</ArkTabs.Trigger>
          <ArkTabs.Trigger value="settings" className={TAB_TRIGGER_CLASS}>Settings</ArkTabs.Trigger>
        </ArkTabs.List>

        <ArkTabs.Content value="overview" className="dp-tab-content">
          <div className="dp-page" style={{ padding: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <div className="dp-card dp-kpi-card">
                <div className="dp-kpi-label">Total Locations</div>
                <div className="dp-kpi-value">12</div>
                <div className="dp-kpi-sub"><span className="dp-dot dp-dot-green" /> 9 online</div>
              </div>
              <div className="dp-card dp-kpi-card">
                <div className="dp-kpi-label">Needs Review</div>
                <div className="dp-kpi-value">2</div>
                <div className="dp-kpi-sub"><span className="dp-dot dp-dot-red" /> Offline &gt; 1 hr</div>
              </div>
              <div className="dp-card dp-kpi-card">
                <div className="dp-kpi-label">Open Tasks</div>
                <div className="dp-kpi-value">37</div>
                <div className="dp-kpi-sub"><span className="dp-dot dp-dot-amber" /> 6 overdue</div>
              </div>
            </div>
          </div>
        </ArkTabs.Content>

        <ArkTabs.Content value="locations" className="dp-tab-content">
          <div className="dp-card" style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--dp-border)" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--dp-text)" }}>Locations</span>
              <button className="dp-btn dp-btn-primary" onClick={() => setNewOpen(true)}>+ New Location</button>
            </div>
            <table className="dp-table">
              <thead>
                <tr><th>Name</th><th>Region</th><th>Status</th><th>Last sync</th><th></th></tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc.name}>
                    <td style={{ fontWeight: 600 }}>{loc.name}</td>
                    <td style={{ color: "var(--dp-text-secondary)" }}>{loc.region}</td>
                    <td><StatusBadge status={loc.status} direction={direction} /></td>
                    <td style={{ color: "var(--dp-text-tertiary)" }}>{loc.lastSync}</td>
                    <td>
                      <div className="dp-row-actions">
                        <button className="dp-btn-icon"><PencilSimple size={15} /></button>
                        <button className="dp-btn-icon dp-btn-icon-danger" onClick={() => { setDeleteTarget(loc.name); setDeleteOpen(true); }}>
                          <Trash size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ArkTabs.Content>

        <ArkTabs.Content value="settings" className="dp-tab-content">
          <div className="dp-card" style={{ padding: 20, maxWidth: 360, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="dp-field">
              <label className="dp-label">Display name</label>
              <input className={INPUT_CLASS} defaultValue="Downtown — 5th Ave" />
            </div>
            <div className="dp-field">
              <label className="dp-label">Region</label>
              <ArkSelect.Root collection={regions} value={region} onValueChange={(d) => setRegion(d.value)} positioning={{ sameWidth: true }}>
                <ArkSelect.Control>
                  <ArkSelect.Trigger className="dp-select-trigger">
                    <ArkSelect.ValueText>{region[0]}</ArkSelect.ValueText>
                    <ArkSelect.Indicator><CaretDown size={12} /></ArkSelect.Indicator>
                  </ArkSelect.Trigger>
                </ArkSelect.Control>
                <ArkSelect.Positioner className="dp-select-positioner">
                  <ArkSelect.Content className="dp-select-menu">
                    {regions.items.map((r) => (
                      <ArkSelect.Item key={r.value} item={r} className="dp-select-option">
                        <ArkSelect.ItemText>{r.label}</ArkSelect.ItemText>
                        <ArkSelect.ItemIndicator className="dp-select-check"><Check size={14} /></ArkSelect.ItemIndicator>
                      </ArkSelect.Item>
                    ))}
                  </ArkSelect.Content>
                </ArkSelect.Positioner>
              </ArkSelect.Root>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="dp-label">Active</span>
              <ArkSwitch.Root checked={active} onCheckedChange={(d) => setActive(d.checked)} className="dp-switch-track">
                <ArkSwitch.HiddenInput />
                <ArkSwitch.Thumb className="dp-switch-thumb" />
              </ArkSwitch.Root>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="dp-btn dp-btn-ghost dp-btn-sm">Cancel</button>
              <button className="dp-btn dp-btn-primary dp-btn-sm">Save changes</button>
            </div>
          </div>
        </ArkTabs.Content>
      </ArkTabs.Root>

      {/* New Location dialog */}
      <ArkDialog.Root open={newOpen} onOpenChange={(d) => setNewOpen(d.open)}>
        <ArkDialog.Backdrop className="dp-dialog-backdrop" />
        <ArkDialog.Positioner className="dp-dialog-positioner">
          <ArkDialog.Content className="dp-dialog">
            <ArkDialog.Title className="dp-dialog-title">New location</ArkDialog.Title>
            <ArkDialog.Description className="dp-dialog-desc">Add a location to this organization.</ArkDialog.Description>
            <div className="dp-field">
              <label className="dp-label">Name</label>
              <input className={INPUT_CLASS} placeholder="e.g. Westfield Mall" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <ArkDialog.CloseTrigger className="dp-btn dp-btn-ghost dp-btn-sm">Cancel</ArkDialog.CloseTrigger>
              <ArkDialog.CloseTrigger className="dp-btn dp-btn-primary dp-btn-sm">Create</ArkDialog.CloseTrigger>
            </div>
            <ArkDialog.CloseTrigger className="dp-dialog-close"><X size={16} /></ArkDialog.CloseTrigger>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </ArkDialog.Root>

      {/* Delete confirm dialog */}
      <ArkDialog.Root open={deleteOpen} onOpenChange={(d) => setDeleteOpen(d.open)}>
        <ArkDialog.Backdrop className="dp-dialog-backdrop" />
        <ArkDialog.Positioner className="dp-dialog-positioner">
          <ArkDialog.Content className="dp-dialog">
            <ArkDialog.Title className="dp-dialog-title">Delete location?</ArkDialog.Title>
            <ArkDialog.Description className="dp-dialog-desc">
              This will permanently remove <strong style={{ color: "var(--dp-text)" }}>{deleteTarget}</strong> and all associated data. This cannot be undone.
            </ArkDialog.Description>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <ArkDialog.CloseTrigger className="dp-btn dp-btn-ghost dp-btn-sm">Cancel</ArkDialog.CloseTrigger>
              <ArkDialog.CloseTrigger className="dp-btn dp-btn-destructive dp-btn-sm">Delete</ArkDialog.CloseTrigger>
            </div>
            <ArkDialog.CloseTrigger className="dp-dialog-close"><X size={16} /></ArkDialog.CloseTrigger>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </ArkDialog.Root>
    </div>
  );
}

function KioskMockup() {
  const [now, setNow] = useState<Date | null>(() => new Date());
  const [activeNav, setActiveNav] = useState("home");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tiles = [
    { id: "tasks", icon: CheckSquare, title: "Tasks", sub: "4 open today", badge: 4 },
    { id: "messages", icon: ChatCircleText, title: "Messages", sub: "2 unread", badge: 2 },
    { id: "upcoming", icon: CalendarBlank, title: "Upcoming", sub: "Lunch rush · 11:30", badge: null },
    { id: "forms", icon: FileText, title: "Forms", sub: "Shift checklist", badge: null },
    { id: "quote", icon: Quotes, title: "Quote of the Day", sub: '"Speed is a feature."', badge: null },
  ];

  return (
    <div className="dp-kiosk-shell">
      <div className="dp-kiosk-header">
        <div>
          <div className="dp-kiosk-clock">{now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}</div>
          <div className="dp-kiosk-date">{now ? now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : ""}</div>
        </div>
        <span className="dp-kiosk-status-pill"><span className="dp-dot dp-dot-green" /> All systems online</span>
      </div>

      <div className="dp-kiosk-grid">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.id} className="dp-kiosk-tile">
              {t.badge != null && <span className="dp-kiosk-tile-badge">{t.badge}</span>}
              <span className="dp-kiosk-tile-icon"><Icon size={20} /></span>
              <div>
                <div className="dp-kiosk-tile-title">{t.title}</div>
                <div className="dp-kiosk-tile-sub">{t.sub}</div>
              </div>
            </div>
          );
        })}
        <div className="dp-kiosk-tile dp-kiosk-tile-emergency">
          <span className="dp-kiosk-tile-icon"><Siren size={20} /></span>
          <div>
            <div className="dp-kiosk-tile-title">Emergency</div>
            <div className="dp-kiosk-tile-sub">Broadcast to all staff</div>
          </div>
        </div>
      </div>

      <div className="dp-kiosk-nav">
        <button className="dp-kiosk-nav-btn" data-active={activeNav === "home"} onClick={() => setActiveNav("home")}>
          <House size={18} /> Home
        </button>
        <button className="dp-kiosk-nav-btn" data-active={activeNav === "tasks"} onClick={() => setActiveNav("tasks")}>
          <CheckSquare size={18} /> Tasks
        </button>
        <button className="dp-kiosk-nav-btn" data-active={activeNav === "messages"} onClick={() => setActiveNav("messages")}>
          <ChatCircleText size={18} /> Messages
        </button>
        <button className="dp-kiosk-nav-btn" data-active={activeNav === "settings"} onClick={() => setActiveNav("settings")}>
          <GearSix size={18} /> Settings
        </button>
      </div>
    </div>
  );
}

export default function DesignPreviewPage() {
  const [isDark, setIsDark] = useState(true);
  const [direction, setDirection] = useState<Direction>("neutral");
  const [surface, setSurface] = useState<Surface>("console");

  const activeDirection = DIRECTIONS.find((d) => d.id === direction)!;

  return (
    <div
      className={`dp-root dp-shell ${isDark ? "dp-dark" : "dp-light"}`}
      data-direction={direction}
      style={{ minHeight: "100dvh" }}
    >
      <div className="dp-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Design Preview</span>
          <div className="dp-segctl">
            <button className="dp-segctl-btn" data-active={surface === "console"} onClick={() => setSurface("console")}>ARL Console</button>
            <button className="dp-segctl-btn" data-active={surface === "kiosk"} onClick={() => setSurface("kiosk")}>Main Dashboard (Kiosk)</button>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div className="dp-segctl">
            {DIRECTIONS.map((d) => (
              <button key={d.id} className="dp-segctl-btn" data-active={direction === d.id} onClick={() => setDirection(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
          <button className="dp-icon-toggle" onClick={() => setIsDark((v) => !v)}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      <div className="dp-legend" style={{ marginTop: 12 }}>
        <strong>{activeDirection.label}</strong>
        {direction === "neutral" ? " — decided (DESIGN.md §2, §15)." : " — rejected, kept for reference."} {activeDirection.blurb} Tabs (underline) and inputs (bordered) are
        also decided and no longer change with this switcher. Background, card, and text colors are identical across
        all three options and are not the organization&apos;s theme-picker color.
      </div>

      {surface === "console" ? <ConsoleMockup direction={direction} /> : <KioskMockup />}
    </div>
  );
}
