"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { GridDashboard, PREDEFINED_LAYOUTS } from "@/components/dashboard/grid";
import { 
  type TaskItem, 
  type TasksResponse 
} from "@/components/dashboard/timeline";
import { 
  type UpcomingTask 
} from "@/components/dashboard/mini-calendar";
import { SimpleHeader } from "@/components/dashboard/simple-header";
import { OfflineIndicator } from "@/components/offline-indicator";
import { useOnlineStatus } from "@/hooks/use-mobile-utils";
import { cn } from "@/lib/utils";

// Import widget data types
import type { Widget } from "@/components/dashboard/grid";

interface NewDashboardPageProps {
  initialLayout?: string;
}

export default function NewDashboardPage({ initialLayout = 'balanced' }: NewDashboardPageProps) {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const isOnline = useOnlineStatus();
  
  // Task state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TaskItem[]>([]);
  const [missedYesterday, setMissedYesterday] = useState<TaskItem[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Record<string, UpcomingTask[]>>({});
  const [currentTime, setCurrentTime] = useState(new Date().toTimeString().slice(0, 5));
  const [pointsToday, setPointsToday] = useState(0);
  const [totalToday, setTotalToday] = useState(0);
  const [loading, setLoading] = useState(true);

  // Chat state
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatIsOpen, setChatIsOpen] = useState(false);

  // Current time update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toTimeString().slice(0, 5));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch tasks data
  const fetchTasks = useCallback(async () => {
    try {
      const endpoint = user?.userType === "arl" ? "/api/tasks" : "/api/tasks";
      const res = await fetch(endpoint);
      if (res.ok) {
        const data: TasksResponse = await res.json();
        setTasks(data.tasks || []);
        setCompletedTasks(data.tasks?.filter((t: TaskItem) => t.isCompleted) || []);
        setMissedYesterday(data.missedYesterday || []);
        setPointsToday(data.pointsToday || 0);
        setTotalToday(data.totalToday || 0);
        
        // Process upcoming tasks
        const upcoming: Record<string, UpcomingTask[]> = {};
        data.tasks?.forEach((task: TaskItem) => {
          // Add logic to populate upcoming tasks
          // This would need date processing similar to the mini-calendar
        });
        setUpcomingTasks(upcoming);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch chat data
  const fetchChatData = useCallback(async () => {
    try {
      const res = await fetch("/api/messages");
      if (res.ok) {
        const data = await res.json();
        const totalUnread = data.conversations?.reduce((sum: number, conv: any) => sum + conv.unreadCount, 0) || 0;
        setChatUnreadCount(totalUnread);
      }
    } catch (error) {
      console.error('Failed to fetch chat data:', error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchTasks();
    fetchChatData();
  }, [fetchTasks, fetchChatData]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const socket = useSocket();
    
    // Task updates
    socket.socket?.on('task:completed', fetchTasks);
    socket.socket?.on('task:uncompleted', fetchTasks);
    socket.socket?.on('task:created', fetchTasks);
    socket.socket?.on('task:updated', fetchTasks);
    
    // Chat updates
    socket.socket?.on('message:new', fetchChatData);
    socket.socket?.on('message:read', fetchChatData);

    return () => {
      socket.socket?.off('task:completed', fetchTasks);
      socket.socket?.off('task:uncompleted', fetchTasks);
      socket.socket?.off('task:created', fetchTasks);
      socket.socket?.off('task:updated', fetchTasks);
      socket.socket?.off('message:new', fetchChatData);
      socket.socket?.off('message:read', fetchChatData);
    };
  }, [isConnected, fetchTasks, fetchChatData]);

  // Task handlers
  const handleTaskComplete = useCallback(async (taskId: string) => {
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (res.ok) {
        fetchTasks(); // Refresh tasks
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  }, [fetchTasks]);

  const handleTaskUncomplete = useCallback(async (taskId: string) => {
    try {
      const res = await fetch("/api/tasks/uncomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      if (res.ok) {
        fetchTasks(); // Refresh tasks
      }
    } catch (error) {
      console.error('Failed to uncomplete task:', error);
    }
  }, [fetchTasks]);

  const handleEarlyComplete = useCallback(async (taskId: string, dateStr: string) => {
    try {
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, earlyComplete: true, date: dateStr }),
      });
      if (res.ok) {
        fetchTasks(); // Refresh tasks
      }
    } catch (error) {
      console.error('Failed to complete task early:', error);
    }
  }, [fetchTasks]);

  // Chat handlers
  const handleChatOpen = useCallback(() => {
    setChatIsOpen(true);
  }, []);

  const handleChatClose = useCallback(() => {
    setChatIsOpen(false);
  }, []);

  const handleChatUnreadChange = useCallback((count: number) => {
    setChatUnreadCount(count);
  }, []);

  // Get initial layout
  const getInitialLayout = useMemo(() => {
    return PREDEFINED_LAYOUTS.find(layout => layout.id === initialLayout) || PREDEFINED_LAYOUTS[0];
  }, [initialLayout]);

  // Enhanced layout with widget data
  const enhancedLayout = useMemo(() => {
    if (!getInitialLayout) return getInitialLayout;

    return {
      ...getInitialLayout,
      widgets: getInitialLayout.widgets.map(widget => ({
        ...widget,
        data: getWidgetData(widget.type)
      }))
    };
  }, [getInitialLayout]);

  // Get widget data based on type
  const getWidgetData = useCallback((widgetType: string) => {
    switch (widgetType) {
      case 'timeline':
        return {
          tasks,
          onComplete: handleTaskComplete,
          onUncomplete: handleTaskUncomplete,
          currentTime
        };
      
      case 'calendar':
        return {
          upcomingTasks,
          onEarlyComplete: handleEarlyComplete
        };
      
      case 'chat':
        return {
          isOpen: chatIsOpen,
          onClose: handleChatClose,
          unreadCount: chatUnreadCount,
          onUnreadChange: handleChatUnreadChange
        };
      
      case 'forms':
        return {
          currentLocationId: user?.userType === 'location' ? user.id : ''
        };
      
      case 'leaderboard':
        return {
          currentLocationId: user?.userType === 'location' ? user.id : ''
        };
      
      case 'stats':
        return {
          completedTasks: completedTasks.length,
          totalTasks: totalToday,
          pointsToday,
          missedTasks: missedYesterday.length,
          loading
        };
      
      default:
        return {};
    }
  }, [
    tasks, 
    completedTasks, 
    missedYesterday, 
    upcomingTasks, 
    currentTime, 
    pointsToday, 
    totalToday,
    chatIsOpen,
    chatUnreadCount,
    loading,
    user,
    handleTaskComplete,
    handleTaskUncomplete,
    handleEarlyComplete,
    handleChatClose,
    handleChatUnreadChange
  ]);

  // Handle layout changes
  const handleLayoutChange = useCallback((layout: any) => {
    console.log('Layout changed:', layout);
    // TODO: Save layout preference to backend
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <SimpleHeader 
        title="Dashboard"
        subtitle={user?.name}
        showNotifications={true}
        showUserMenu={true}
      />

      {/* Main Grid Dashboard */}
      <div className="flex-1 relative">
        <GridDashboard
          initialLayout={enhancedLayout}
          onLayoutChange={handleLayoutChange}
          showLayoutSwitcher={true}
          allowCustomization={true}
        />
      </div>

      {/* Status Indicators */}
      <div className="fixed bottom-4 left-4 z-50">
        <OfflineIndicator />
      </div>

      {/* Connection Status */}
      {!isOnline && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-destructive text-destructive-foreground px-3 py-2 rounded-lg shadow-lg text-sm">
            Offline Mode
          </div>
        </div>
      )}
    </div>
  );
}