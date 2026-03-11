"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useSocket } from "@/lib/socket-context";

export interface TargetDeviceInfo {
  width: number;
  height: number;
  isMobile: boolean;
  userAgent: string;
  layout?: string;
  theme?: string;
}

export interface MirrorViewState {
  chatOpen: boolean;
  formsOpen: boolean;
  calendarOpen: boolean;
  layout: string;
  mobileView: string;
  accordions?: { completed?: boolean; missed?: boolean; leaderboard?: boolean };
  notificationsOpen?: boolean;
  settingsOpen?: boolean;
  hubMenuOpen?: boolean;
  // Remote desktop sync fields
  celebration?: "confetti" | "coinRain" | "fireworks" | null;
  celebrationPoints?: number;
  soundEnabled?: boolean;
  mobilePanelOpen?: "left" | "right" | null;
  idle?: boolean;
  theme?: string;
}

interface MirrorState {
  isMirroring: boolean;
  targetLocationId: string | null;
  targetLocationName: string | null;
  sessionId: string | null;
  controlEnabled: boolean;
  cursorVisible: boolean;
  targetDevice: TargetDeviceInfo | null;
  remoteCursor: { x: number; y: number } | null;
  remoteScroll: { x: number; y: number; maxY?: number } | null;
  viewState: MirrorViewState | null;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
}

interface MirrorContextValue extends MirrorState {
  startMirror: (locationId: string, locationName: string, sessionId: string) => void;
  endMirror: () => void;
  toggleControl: () => void;
  toggleCursorVisible: () => void;
  setTargetDevice: (device: TargetDeviceInfo) => void;
  sendViewChange: (viewState: Partial<MirrorViewState>) => void;
  setDisableCursorTracking: (disabled: boolean) => void;
}

const MirrorContext = createContext<MirrorContextValue | null>(null);

export function MirrorProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const [state, setState] = useState<MirrorState>({
    isMirroring: false,
    targetLocationId: null,
    targetLocationName: null,
    sessionId: null,
    controlEnabled: false,
    cursorVisible: false,
    targetDevice: null,
    remoteCursor: null,
    remoteScroll: null,
    viewState: null,
    connectionStatus: "connected",
  });

  const sessionIdRef = useRef<string | null>(null);
  const cursorVisibleRef = useRef(false);
  const disableCursorTrackingRef = useRef(false);
  const locationIdRef = useRef<string | null>(null);
  const locationNameRef = useRef<string | null>(null);

  const setDisableCursorTracking = useCallback((disabled: boolean) => {
    disableCursorTrackingRef.current = disabled;
  }, []);

  const startMirror = useCallback((locationId: string, locationName: string, sessionId: string) => {
    sessionIdRef.current = sessionId;
    locationIdRef.current = locationId;
    locationNameRef.current = locationName;
    setState({
      isMirroring: true,
      targetLocationId: locationId,
      targetLocationName: locationName,
      sessionId,
      controlEnabled: false,
      cursorVisible: false,
      targetDevice: null,
      remoteCursor: null,
      remoteScroll: null,
      viewState: null,
      connectionStatus: "connected",
    });
    cursorVisibleRef.current = false;

    // Join the target location's socket room for real-time task updates
    if (socket) {
      socket.emit("mirror:join", { sessionId, locationId });
    }
  }, [socket]);

  const endMirror = useCallback(() => {
    if (socket && sessionIdRef.current) {
      socket.emit("remote-view:end", { sessionId: sessionIdRef.current });
    }
    sessionIdRef.current = null;
    locationIdRef.current = null;
    locationNameRef.current = null;
    cursorVisibleRef.current = false;
    setState({
      isMirroring: false,
      targetLocationId: null,
      targetLocationName: null,
      sessionId: null,
      controlEnabled: false,
      cursorVisible: false,
      targetDevice: null,
      remoteCursor: null,
      remoteScroll: null,
      viewState: null,
      connectionStatus: "connected",
    });
    // Close the mirror browser tab
    try { window.close(); } catch {}
  }, [socket]);

  const toggleCursorVisible = useCallback(() => {
    if (!socket || !sessionIdRef.current) return;
    const newVal = !cursorVisibleRef.current;
    cursorVisibleRef.current = newVal;
    setState(prev => ({ ...prev, cursorVisible: newVal }));
    socket.emit("mirror:arl-cursor-toggle", {
      sessionId: sessionIdRef.current,
      visible: newVal,
    });
  }, [socket]);

  const toggleControl = useCallback(() => {
    if (!socket || !sessionIdRef.current) return;
    const newState = !state.controlEnabled;
    socket.emit("remote-view:toggle-control", {
      sessionId: sessionIdRef.current,
      enabled: newState,
    });
    setState(prev => ({ ...prev, controlEnabled: newState }));
  }, [socket, state.controlEnabled]);

  const setTargetDevice = useCallback((device: TargetDeviceInfo) => {
    setState(prev => ({ ...prev, targetDevice: device }));
  }, []);

  // Listen for cursor/scroll/device updates from target
  useEffect(() => {
    if (!socket) return;

    const onCursor = (data: { sessionId: string; x: number; y: number }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      setState(prev => ({ ...prev, remoteCursor: { x: data.x, y: data.y } }));
    };

    const onScroll = (data: { sessionId: string; x: number; y: number; maxY?: number }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      setState(prev => ({ ...prev, remoteScroll: { x: data.x, y: data.y, maxY: data.maxY } }));
    };

    const onDevice = (data: { sessionId: string; device: TargetDeviceInfo }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      setState(prev => ({
        ...prev,
        targetDevice: data.device,
        // Use target's layout from device info if we don't have view state yet
        viewState: prev.viewState ? prev.viewState : (data.device.layout ? {
          chatOpen: false,
          formsOpen: false,
          calendarOpen: false,
          layout: data.device.layout,
          mobileView: "tasks",
        } : prev.viewState),
      }));
    };

    const onEnded = (data: { sessionId: string }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      sessionIdRef.current = null;
      locationIdRef.current = null;
      locationNameRef.current = null;
      cursorVisibleRef.current = false;
      setState({
        isMirroring: false,
        targetLocationId: null,
        targetLocationName: null,
        sessionId: null,
        controlEnabled: false,
        cursorVisible: false,
        targetDevice: null,
        remoteCursor: null,
        remoteScroll: null,
        viewState: null,
        connectionStatus: "connected",
      });
      // Close the mirror browser tab
      try { window.close(); } catch {}
    };

    const onReconnecting = (data: { sessionId: string; disconnectedUserType: string }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      // The other side disconnected — show reconnecting indicator
      if (data.disconnectedUserType === "location") {
        setState(prev => ({ ...prev, connectionStatus: "reconnecting" }));
      }
    };

    const onReconnected = (data: { sessionId: string; reconnectedUserType: string }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      setState(prev => ({ ...prev, connectionStatus: "connected" }));
    };

    const onViewChange = (data: { sessionId: string; viewState: MirrorViewState }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      setState(prev => ({ ...prev, viewState: data.viewState }));
    };

    const onControlToggled = (data: { sessionId: string; enabled: boolean }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      setState(prev => ({ ...prev, controlEnabled: data.enabled }));
    };

    socket.on("remote-view:cursor", onCursor);
    socket.on("mirror:scroll", onScroll);
    socket.on("mirror:device-info", onDevice);
    socket.on("remote-view:ended", onEnded);
    socket.on("remote-view:control-toggled", onControlToggled);
    socket.on("mirror:view-change", onViewChange);
    socket.on("remote-view:reconnecting", onReconnecting);
    socket.on("remote-view:reconnected", onReconnected);

    return () => {
      socket.off("remote-view:cursor", onCursor);
      socket.off("mirror:scroll", onScroll);
      socket.off("mirror:device-info", onDevice);
      socket.off("remote-view:ended", onEnded);
      socket.off("remote-view:control-toggled", onControlToggled);
      socket.off("mirror:view-change", onViewChange);
      socket.off("remote-view:reconnecting", onReconnecting);
      socket.off("remote-view:reconnected", onReconnected);
    };
  }, [socket]);

  // Auto-rejoin session on socket reconnect
  useEffect(() => {
    if (!socket) return;
    const onSocketReconnect = () => {
      const sid = sessionIdRef.current;
      const locId = locationIdRef.current;
      if (!sid) return;
      setState(prev => ({ ...prev, connectionStatus: "reconnecting" }));
      socket.emit("remote-view:rejoin", { sessionId: sid });
      // Re-join location room for task updates
      if (locId) socket.emit("mirror:join", { sessionId: sid, locationId: locId });
    };
    const onRejoinResult = (data: { sessionId: string; success: boolean; reason?: string }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      if (data.success) {
        setState(prev => ({ ...prev, connectionStatus: "connected" }));
      } else {
        // Session gone — end mirror
        sessionIdRef.current = null;
        locationIdRef.current = null;
        locationNameRef.current = null;
        cursorVisibleRef.current = false;
        setState({
          isMirroring: false, targetLocationId: null, targetLocationName: null,
          sessionId: null, controlEnabled: false, cursorVisible: false,
          targetDevice: null, remoteCursor: null, remoteScroll: null,
          viewState: null, connectionStatus: "disconnected",
        });
        try { window.close(); } catch {}
      }
    };
    socket.on("connect", onSocketReconnect);
    socket.on("remote-view:rejoin-result", onRejoinResult);
    return () => {
      socket.off("connect", onSocketReconnect);
      socket.off("remote-view:rejoin-result", onRejoinResult);
    };
  }, [socket]);

  // Heartbeat: periodically verify session is alive
  useEffect(() => {
    if (!socket) return;
    const interval = setInterval(() => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      socket.emit("remote-view:heartbeat", { sessionId: sid });
    }, 10_000); // every 10s
    const onHeartbeatAck = (data: { sessionId: string; alive: boolean; otherConnected?: boolean; otherReconnecting?: boolean }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      if (!data.alive) {
        // Session no longer exists on server — end mirror
        sessionIdRef.current = null;
        locationIdRef.current = null;
        locationNameRef.current = null;
        cursorVisibleRef.current = false;
        setState({
          isMirroring: false, targetLocationId: null, targetLocationName: null,
          sessionId: null, controlEnabled: false, cursorVisible: false,
          targetDevice: null, remoteCursor: null, remoteScroll: null,
          viewState: null, connectionStatus: "disconnected",
        });
        try { window.close(); } catch {}
        return;
      }
      if (data.otherReconnecting) {
        setState(prev => ({ ...prev, connectionStatus: "reconnecting" }));
      } else if (data.otherConnected) {
        setState(prev => prev.connectionStatus === "reconnecting" ? { ...prev, connectionStatus: "connected" } : prev);
      }
    };
    socket.on("remote-view:heartbeat-ack", onHeartbeatAck);
    return () => {
      clearInterval(interval);
      socket.off("remote-view:heartbeat-ack", onHeartbeatAck);
    };
  }, [socket]);

  // Track ARL mouse position and emit to target when cursor visible
  useEffect(() => {
    if (!socket) return;
    const onMouseMove = (e: MouseEvent) => {
      if (!cursorVisibleRef.current || !sessionIdRef.current || disableCursorTrackingRef.current) return;
      // Send normalised percentages so it maps to any viewport size
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      socket.volatile.emit("mirror:arl-cursor", {
        sessionId: sessionIdRef.current,
        x,
        y,
        visible: true,
      });
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [socket]);

  // Send view state changes from mirror (ARL) → target (location)
  const sendViewChange = useCallback((viewState: Partial<MirrorViewState>) => {
    if (!socket || !sessionIdRef.current) return;
    socket.emit("mirror:view-change", {
      sessionId: sessionIdRef.current,
      viewState,
    });
  }, [socket]);

  return (
    <MirrorContext.Provider value={{ ...state, startMirror, endMirror, toggleControl, toggleCursorVisible, setTargetDevice, sendViewChange, setDisableCursorTracking }}>
      {children}
    </MirrorContext.Provider>
  );
}

export function useMirror() {
  const ctx = useContext(MirrorContext);
  if (!ctx) {
    // Return a safe default when used outside provider (e.g., non-mirror pages)
    return {
      isMirroring: false,
      targetLocationId: null,
      targetLocationName: null,
      sessionId: null,
      controlEnabled: false,
      targetDevice: null,
      remoteCursor: null,
      remoteScroll: null,
      viewState: null,
      cursorVisible: false,
      connectionStatus: "connected",
      startMirror: () => {},
      endMirror: () => {},
      toggleControl: () => {},
      toggleCursorVisible: () => {},
      setTargetDevice: () => {},
      sendViewChange: () => {},
      setDisableCursorTracking: () => {},
    } as MirrorContextValue;
  }
  return ctx;
}
