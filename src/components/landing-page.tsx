import {
  MessageCircle, ClipboardList, CalendarDays, Users, Store,
  Video, BarChart3, Shield, Zap, ArrowRight, ChevronRight,
} from "lucide-react";

const features = [
  { icon: ClipboardList, title: "Tasks & Reminders", desc: "Assign, track, and complete tasks across all locations with gamification" },
  { icon: MessageCircle, title: "Instant Messaging", desc: "Real-time chat between restaurants and leadership with read receipts" },
  { icon: CalendarDays, title: "Calendar", desc: "Visual calendar with recurring tasks, daily/weekly/monthly views" },
  { icon: Video, title: "Video Meetings", desc: "Built-in video conferencing with LiveKit — no external tools needed" },
  { icon: Store, title: "Location Management", desc: "Monitor all restaurant locations, session tracking, and online status" },
  { icon: BarChart3, title: "Analytics", desc: "Task completion rates, messaging stats, gamification leaderboards" },
  { icon: Shield, title: "Emergency Broadcasts", desc: "Instant alerts to all locations with acknowledgment tracking" },
  { icon: Users, title: "Multi-Tenant", desc: "Each franchise gets its own branded subdomain with full data isolation" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 shadow-sm">
              <span className="text-sm font-black text-white">H</span>
            </div>
            <span className="text-lg font-bold text-slate-900">The Hub</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:hello@meetthehub.com" className="text-sm text-slate-500 hover:text-slate-900 transition-colors hidden sm:block">
              Contact
            </a>
            <a
              href="https://kazi.meetthehub.com/login"
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
            >
              Sign In <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-700 mb-6">
          <Zap className="h-3.5 w-3.5" />
          Multi-brand franchise management
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-slate-900 leading-[1.1]">
          Your restaurants.<br />
          <span className="text-red-600">One dashboard.</span>
        </h1>
        <p className="mt-6 text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          The Hub is an all-in-one franchise management platform. Tasks, messaging,
          video meetings, leaderboards, and analytics — unified for every location.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="mailto:hello@meetthehub.com?subject=The Hub Demo Request"
            className="flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-200 hover:bg-red-700 transition-colors"
          >
            Request a Demo <ChevronRight className="h-4 w-4" />
          </a>
          <a
            href="https://kazi.meetthehub.com"
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            See it in action
          </a>
        </div>
      </section>

      {/* Preview */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-2 shadow-2xl shadow-slate-200/50">
          <div className="rounded-2xl bg-slate-900 aspect-video flex items-center justify-center">
            <div className="text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 mx-auto mb-4 shadow-lg">
                <span className="text-2xl font-black text-white">H</span>
              </div>
              <p className="text-white/60 text-sm">Dashboard Preview</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 border-y border-slate-100 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-slate-900">Everything your franchise needs</h2>
            <p className="mt-3 text-slate-500">Built for multi-location restaurant operations</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-3">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{f.title}</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multi-tenant CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-black text-slate-900">One platform, every brand</h2>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto">
            Each franchise gets its own branded subdomain with complete data isolation.
            Your brand colors, your logo, your domain — powered by The Hub.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {["kazi", "brand-a", "brand-b"].map((slug) => (
              <div key={slug} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-600 shadow-sm">
                <span className="font-bold text-red-600">{slug}</span>.meetthehub.com
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600">
              <span className="text-[10px] font-black text-white">H</span>
            </div>
            <span className="text-sm font-bold text-slate-900">The Hub</span>
          </div>
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} The Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
