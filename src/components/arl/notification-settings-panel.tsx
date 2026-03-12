"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, BellOff, Settings, CheckCircle2, AlertCircle } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface NotificationPreferences {
  id?: string;
  userId: string;
  userType: string;
  taskDueSoon: boolean;
  taskOverdue: boolean;
  taskCompleted: boolean;
  newMessage: boolean;
  messageReply: boolean;
  locationOnline: boolean;
  locationOffline: boolean;
  locationStatusChange: boolean;
  emergencyBroadcast: boolean;
  regularBroadcast: boolean;
  meetingStarted: boolean;
  meetingEnded: boolean;
  meetingReminder: boolean;
  newShoutout: boolean;
  leaderboardUpdate: boolean;
  systemAlert: boolean;
  weeklyReport: boolean;
  priorityTypes: string[];
  emailNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
}

interface NotificationSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  userType?: "arl" | "admin" | "location";
}

const categories = [
  {
    id: "tasks",
    title: "Task Notifications",
    icon: "✅",
    description: "Notifications about tasks and reminders",
  },
  {
    id: "messages",
    title: "Message Notifications",
    icon: "💬",
    description: "Notifications for new messages and replies",
  },
  {
    id: "locations",
    title: "Location Status",
    icon: "📍",
    description: "Notifications about location activity",
  },
  {
    id: "broadcasts",
    title: "Broadcasts & Meetings",
    icon: "📢",
    description: "Emergency broadcasts and meeting updates",
  },
  {
    id: "gamification",
    title: "Gamification",
    icon: "🏆",
    description: "Shoutouts, leaderboards, and achievements",
  },
  {
    id: "system",
    title: "System & Reports",
    icon: "⚙️",
    description: "Critical alerts and weekly reports",
  },
];

const deliveryMethods = [
  {
    id: "inApp",
    title: "In-App Notifications",
    icon: "🔔",
    description: "Show in notification bell within the app",
  },
  {
    id: "push",
    title: "Browser Push",
    icon: "📱",
    description: "Push notifications to your device",
  },
  {
    id: "email",
    title: "Email",
    icon: "📧",
    description: "Send to your registered email address",
  },
];

export function NotificationSettingsPanel({ open, onClose, userType = "arl" }: NotificationSettingsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId: "",
    userType: userType,
    taskDueSoon: true,
    taskOverdue: true,
    taskCompleted: false,
    newMessage: true,
    messageReply: true,
    locationOnline: true,
    locationOffline: false,
    locationStatusChange: false,
    emergencyBroadcast: true,
    regularBroadcast: true,
    meetingStarted: true,
    meetingEnded: false,
    meetingReminder: true,
    newShoutout: true,
    leaderboardUpdate: false,
    systemAlert: true,
    weeklyReport: false,
    priorityTypes: ["urgent"],
    emailNotifications: false,
    pushNotifications: true,
    inAppNotifications: true,
  });

  const [activeCategory, setActiveCategory] = useState<string>("tasks");

  useEffect(() => {
    if (open) {
      fetchPreferences();
      setSaved(false);
    }
  }, [open]);

  const fetchPreferences = async () => {
    try {
      const res = await fetch("/api/preferences/notifications");
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    }
  };

  const handleToggle = (field: keyof NotificationPreferences, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [field]: value }));
  };

  const savePreferences = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/preferences/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      if (res.ok) {
        const data = await res.json();
        setPreferences(data.preferences);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSet = (mode: "minimal" | "balanced" | "comprehensive") => {
    const presets = {
      minimal: {
        taskDueSoon: true,
        taskOverdue: true,
        taskCompleted: false,
        newMessage: false,
        messageReply: false,
        locationOnline: false,
        locationOffline: false,
        locationStatusChange: false,
        emergencyBroadcast: true,
        regularBroadcast: false,
        meetingStarted: true,
        meetingEnded: false,
        meetingReminder: true,
        newShoutout: false,
        leaderboardUpdate: false,
        systemAlert: true,
        weeklyReport: false,
      },
      balanced: {
        taskDueSoon: true,
        taskOverdue: true,
        taskCompleted: false,
        newMessage: true,
        messageReply: true,
        locationOnline: true,
        locationOffline: false,
        locationStatusChange: false,
        emergencyBroadcast: true,
        regularBroadcast: true,
        meetingStarted: true,
        meetingEnded: false,
        meetingReminder: true,
        newShoutout: true,
        leaderboardUpdate: false,
        systemAlert: true,
        weeklyReport: false,
      },
      comprehensive: {
        taskDueSoon: true,
        taskOverdue: true,
        taskCompleted: true,
        newMessage: true,
        messageReply: true,
        locationOnline: true,
        locationOffline: true,
        locationStatusChange: true,
        emergencyBroadcast: true,
        regularBroadcast: true,
        meetingStarted: true,
        meetingEnded: true,
        meetingReminder: true,
        newShoutout: true,
        leaderboardUpdate: true,
        systemAlert: true,
        weeklyReport: true,
      },
    };

    setPreferences((prev) => ({
      ...prev,
      ...presets[mode],
    }));
  };

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case "tasks":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task Notifications</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Control notifications related to tasks, reminders, and completions.
            </p>
            <div className="space-y-3 mt-4">
              <ToggleField
                label="Tasks Due Soon"
                description="Notify when a task is due within 30 minutes"
                checked={preferences.taskDueSoon}
                onChange={(checked) => handleToggle("taskDueSoon", checked)}
              />
              <ToggleField
                label="Overdue Tasks"
                description="Alert when tasks become overdue"
                checked={preferences.taskOverdue}
                onChange={(checked) => handleToggle("taskOverdue", checked)}
              />
              <ToggleField
                label="Task Completions"
                description="Receive updates when tasks are completed"
                checked={preferences.taskCompleted}
                onChange={(checked) => handleToggle("taskCompleted", checked)}
              />
            </div>
          </div>
        );

      case "messages":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Message Notifications</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Stay updated on conversations and direct messages.
            </p>
            <div className="space-y-3 mt-4">
              <ToggleField
                label="New Messages"
                description="Notify when you receive a new message"
                checked={preferences.newMessage}
                onChange={(checked) => handleToggle("newMessage", checked)}
              />
              <ToggleField
                label="Message Replies"
                description="Alert when someone replies to your messages"
                checked={preferences.messageReply}
                onChange={(checked) => handleToggle("messageReply", checked)}
              />
            </div>
          </div>
        );

      case "locations":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Location Status</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Monitor location activity and status changes.
            </p>
            <div className="space-y-3 mt-4">
              <ToggleField
                label="Location Online"
                description="Notify when a location comes online"
                checked={preferences.locationOnline}
                onChange={(checked) => handleToggle("locationOnline", checked)}
              />
              <ToggleField
                label="Location Offline"
                description="Alert when a location goes offline"
                checked={preferences.locationOffline}
                onChange={(checked) => handleToggle("locationOffline", checked)}
              />
              <ToggleField
                label="Status Changes"
                description="Notify about location status updates"
                checked={preferences.locationStatusChange}
                onChange={(checked) => handleToggle("locationStatusChange", checked)}
              />
            </div>
          </div>
        );

      case "broadcasts":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Broadcasts & Meetings</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Stay informed about broadcasts and meeting events.
            </p>
            <div className="space-y-3 mt-4">
              <ToggleField
                label="Emergency Broadcasts"
                description="Always notify for emergency broadcasts (cannot be disabled)"
                checked={preferences.emergencyBroadcast}
                onChange={(checked) => handleToggle("emergencyBroadcast", checked)}
                isCritical
              />
              <ToggleField
                label="Regular Broadcasts"
                description="Notify about regular broadcast messages"
                checked={preferences.regularBroadcast}
                onChange={(checked) => handleToggle("regularBroadcast", checked)}
              />
              <ToggleField
                label="Meeting Started"
                description="Alert when a meeting begins"
                checked={preferences.meetingStarted}
                onChange={(checked) => handleToggle("meetingStarted", checked)}
              />
              <ToggleField
                label="Meeting Ended"
                description="Notify when meetings conclude"
                checked={preferences.meetingEnded}
                onChange={(checked) => handleToggle("meetingEnded", checked)}
              />
              <ToggleField
                label="Meeting Reminders"
                description="15-minute reminder before scheduled meetings"
                checked={preferences.meetingReminder}
                onChange={(checked) => handleToggle("meetingReminder", checked)}
              />
            </div>
          </div>
        );

      case "gamification":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Gamification</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Celebrate achievements and track performance.
            </p>
            <div className="space-y-3 mt-4">
              <ToggleField
                label="New Shoutouts"
                description="Notify when you receive a shoutout"
                checked={preferences.newShoutout}
                onChange={(checked) => handleToggle("newShoutout", checked)}
              />
              <ToggleField
                label="Leaderboard Updates"
                description="Weekly leaderboard and ranking updates"
                checked={preferences.leaderboardUpdate}
                onChange={(checked) => handleToggle("leaderboardUpdate", checked)}
              />
            </div>
          </div>
        );

      case "system":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System & Reports</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Critical system alerts and periodic reports.
            </p>
            <div className="space-y-3 mt-4">
              <ToggleField
                label="System Alerts"
                description="Critical system notifications (cannot be disabled)"
                checked={preferences.systemAlert}
                onChange={(checked) => handleToggle("systemAlert", checked)}
                isCritical
              />
              <ToggleField
                label="Weekly Reports"
                description="Receive weekly summary reports via email"
                checked={preferences.weeklyReport}
                onChange={(checked) => handleToggle("weeklyReport", checked)}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderDeliveryMethods = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Delivery</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Choose how you want to receive notifications.
      </p>
      <div className="space-y-3 mt-4">
        {deliveryMethods.map((method) => (
          <ToggleField
            key={method.id}
            label={method.title}
            description={method.description}
            icon={method.icon}
            checked={
              method.id === "inApp" ? preferences.inAppNotifications :
              method.id === "push" ? preferences.pushNotifications :
              preferences.emailNotifications
            }
            onChange={(checked) => {
              if (method.id === "inApp") handleToggle("inAppNotifications", checked);
              else if (method.id === "push") handleToggle("pushNotifications", checked);
              else handleToggle("emailNotifications", checked);
            }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-6 h-6" />
                  Notification Settings
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Customize what notifications you receive
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Setup</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuickSet("minimal")}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Minimal
                </button>
                <button
                  onClick={() => handleQuickSet("balanced")}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Balanced
                </button>
                <button
                  onClick={() => handleQuickSet("comprehensive")}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Comprehensive
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Category Tabs */}
              <div className="flex gap-2 p-4 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
                      activeCategory === category.id
                        ? "bg-blue-600 text-white"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    )}
                  >
                    <span className="mr-1">{category.icon}</span>
                    {category.title}
                  </button>
                ))}
              </div>

              {/* Category Content */}
              <div className="p-6">
                {activeCategory === "delivery" ? renderDeliveryMethods() : renderCategoryContent()}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                onClick={savePreferences}
                disabled={loading}
                className={cn(
                  "w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : saved
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                )}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Saved Successfully!
                  </>
                ) : (
                  "Save Preferences"
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ToggleFieldProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: string;
  isCritical?: boolean;
}

function ToggleField({ label, description, checked, onChange, icon, isCritical }: ToggleFieldProps) {
  return (
    <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon && <span className="text-xl">{icon}</span>}
          <label className="font-medium text-gray-900 dark:text-white cursor-pointer">
            {label}
          </label>
          {isCritical && (
            <AlertCircle className="w-4 h-4 text-red-500" title="Cannot be disabled" />
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {description}
        </p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          checked ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
