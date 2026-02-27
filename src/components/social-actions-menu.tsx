"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, HandMetal, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SocialActionsMenuProps {
  userType: "location" | "arl";
  userId?: string;
  userName?: string;
}

export function SocialActionsMenu({ userType, userId, userName }: SocialActionsMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showShoutoutForm, setShowShoutoutForm] = useState(false);
  const [showHighFiveForm, setShowHighFiveForm] = useState(false);
  const [locations, setLocations] = useState<Array<{ id: string; name: string; storeNumber: string }>>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const loadLocations = async () => {
    try {
      const res = await fetch("/api/locations");
      if (res.ok) {
        const data = await res.json();
        setLocations(data.locations || []);
      }
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
  };

  const handleShoutout = async () => {
    if (!selectedLocation || !message.trim()) return;
    setSending(true);
    try {
      const location = locations.find(l => l.id === selectedLocation);
      await fetch("/api/shoutouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toLocationId: selectedLocation,
          toLocationName: location?.name || "Unknown",
          message: message.trim(),
        }),
      });
      setMessage("");
      setSelectedLocation("");
      setShowShoutoutForm(false);
      setShowMenu(false);
    } catch (err) {
      console.error("Failed to send shoutout:", err);
    } finally {
      setSending(false);
    }
  };

  const handleHighFive = async () => {
    if (!selectedLocation) return;
    setSending(true);
    try {
      const location = locations.find(l => l.id === selectedLocation);
      await fetch("/api/high-fives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toUserId: selectedLocation,
          toUserType: "location",
          toUserName: location?.name || "Unknown",
          message: message.trim() || undefined,
        }),
      });
      setMessage("");
      setSelectedLocation("");
      setShowHighFiveForm(false);
      setShowMenu(false);
    } catch (err) {
      console.error("Failed to send high-five:", err);
    } finally {
      setSending(false);
    }
  };

  const openShoutoutForm = () => {
    loadLocations();
    setShowShoutoutForm(true);
    setShowHighFiveForm(false);
  };

  const openHighFiveForm = () => {
    loadLocations();
    setShowHighFiveForm(true);
    setShowShoutoutForm(false);
  };

  // Only show for ARLs
  if (userType !== "arl") return null;

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowMenu(!showMenu)}
        className="fixed bottom-6 md:bottom-6 right-6 z-[135] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl transition-shadow"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}
        title="Social Actions"
      >
        {showMenu ? <X className="h-6 w-6" /> : <span className="text-2xl">✨</span>}
      </motion.button>

      {/* Quick Action Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed right-6 z-[135] flex flex-col gap-2"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 128px)' }}
          >
            <button
              onClick={openShoutoutForm}
              className="flex items-center gap-3 rounded-full bg-white border border-purple-200 px-4 py-3 shadow-lg hover:shadow-xl transition-all hover:bg-purple-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                <Megaphone className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Give Shoutout</span>
            </button>
            <button
              onClick={openHighFiveForm}
              className="flex items-center gap-3 rounded-full bg-white border border-orange-200 px-4 py-3 shadow-lg hover:shadow-xl transition-all hover:bg-orange-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                <HandMetal className="h-5 w-5 text-orange-600" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Send High-Five</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shoutout Form Modal */}
      <AnimatePresence>
        {showShoutoutForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowShoutoutForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                  <Megaphone className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Give a Shoutout</h3>
                  <p className="text-xs text-slate-500">Publicly recognize great work!</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Select Location</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-purple-400 focus:outline-none"
                  >
                    <option value="">Choose a location...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} (#{loc.storeNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Your Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Great job on hitting your targets today!"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-purple-400 focus:outline-none resize-none"
                    rows={4}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowShoutoutForm(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleShoutout}
                    disabled={!selectedLocation || !message.trim() || sending}
                    className="flex-1 bg-purple-500 hover:bg-purple-600"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Shoutout
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* High-Five Form Modal */}
      <AnimatePresence>
        {showHighFiveForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowHighFiveForm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                  <HandMetal className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Send a High-Five</h3>
                  <p className="text-xs text-slate-500">Show some appreciation!</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Select Location</label>
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-orange-400 focus:outline-none"
                  >
                    <option value="">Choose a location...</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} (#{loc.storeNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700 mb-2 block">Optional Message</label>
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Keep up the great work!"
                    className="rounded-xl"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowHighFiveForm(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleHighFive}
                    disabled={!selectedLocation || sending}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                  >
                    <HandMetal className="h-4 w-4 mr-2" />
                    Send High-Five
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
