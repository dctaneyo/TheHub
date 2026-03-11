"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { useSocket } from "@/lib/socket-context";

export interface TargetDeviceInfo {
  width: number;
  height: number;
  isMobile: boolean;
  userAgent: string;
  layout?: string;
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
  remoteScroll: { x: number; y: number } | null;
  viewState: MirrorViewState | null;
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
  });

  const sessionIdRef = useRef<string | null>(null);
  const cursorVisibleRef = useRef(false);
  const disableCursorTrackingRef = useRef(false);

  const setDisableCursorTracking = useCallback((disabled: boolean) => {
    disableCursorTrackingRef.current = disabled;
  }, []);

  const startMirror = useCallback((locationId: string, locationName: string, sessionId: string) => {
    sessionIdRef.current = sessionId;
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

    const onScroll = (data: { sessionId: string; x: number; y: number }) => {
      if (data.sessionId !== sessionIdRef.current) return;
      setState(prev => ({ ...prev, remoteScroll: { x: data.x, y: data.y } }));
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
      });
      // Close the mirror browser tab
      try { window.close(); } catch {}
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

    return () => {
      socket.off("remote-view:cursor", onCursor);
      socket.off("mirror:scroll", onScroll);
      socket.off("mirror:device-info", onDevice);
      socket.off("remote-view:ended", onEnded);
      socket.off("remote-view:control-toggled", onControlToggled);
      socket.off("mirror:view-change", onViewChange);
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
