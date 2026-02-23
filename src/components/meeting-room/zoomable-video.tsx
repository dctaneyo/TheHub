"use client";

import React, { useRef, useState, useCallback } from "react";
import { VideoTrack } from "@livekit/components-react";

interface ZoomableVideoProps {
  trackRef: any;
  className?: string;
  children?: React.ReactNode;
}

export function ZoomableVideo({ trackRef, className, children }: ZoomableVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastTouchDistance = useRef(0);

  // Reset zoom
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Handle double-click to reset zoom
  const handleDoubleClick = useCallback(() => {
    resetZoom();
  }, [resetZoom]);

  // Handle wheel zoom (desktop)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.5, scale * delta), 3);
    setScale(newScale);
    
    // Reset position if zooming back to 1x
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  // Get distance between two touch points
  const getTouchDistance = useCallback((touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - start dragging
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    } else if (e.touches.length === 2) {
      // Two touches - start pinch zoom
      setIsDragging(false);
      lastTouchDistance.current = getTouchDistance(e.touches);
    }
  }, [position, getTouchDistance]);

  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging && scale > 1) {
      // Drag when zoomed in
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      
      // Limit dragging to prevent video from going completely off-screen
      const maxDrag = scale * 100; // Arbitrary limit based on scale
      setPosition({
        x: Math.max(-maxDrag, Math.min(maxDrag, newX)),
        y: Math.max(-maxDrag, Math.min(maxDrag, newY)),
      });
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const currentDistance = getTouchDistance(e.touches);
      if (lastTouchDistance.current > 0) {
        const delta = currentDistance / lastTouchDistance.current;
        const newScale = Math.min(Math.max(0.5, scale * delta), 3);
        setScale(newScale);
        
        // Reset position if zooming back to 1x
        if (newScale === 1) {
          setPosition({ x: 0, y: 0 });
        }
      }
      lastTouchDistance.current = currentDistance;
    }
  }, [isDragging, dragStart, scale, getTouchDistance]);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastTouchDistance.current = 0;
  }, []);

  // Handle mouse drag (desktop alternative to touch)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      e.preventDefault();
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      const maxDrag = scale * 100;
      setPosition({
        x: Math.max(-maxDrag, Math.min(maxDrag, newX)),
        y: Math.max(-maxDrag, Math.min(maxDrag, newY)),
      });
    }
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
    >
      <div
        ref={videoRef}
        className="w-full h-full flex items-center justify-center"
        style={{
          transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          transformOrigin: "center",
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
      >
        <VideoTrack
          trackRef={trackRef}
          className="w-full h-full object-contain"
          style={{ pointerEvents: "none" }}
        />
      </div>
      {children}
      
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 flex gap-1">
        {scale > 1 && (
          <button
            onClick={resetZoom}
            className="bg-black/60 backdrop-blur-sm rounded-lg p-1.5 hover:bg-black/80 transition-colors"
            title="Reset zoom"
          >
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
        )}
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1">
          <span className="text-xs text-white font-medium">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>
      
      {/* Instructions hint */}
      {scale === 1 && (
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 opacity-0 hover:opacity-100 transition-opacity">
          <span className="text-xs text-white">
            Pinch to zoom • Scroll to zoom • Double-click to reset
          </span>
        </div>
      )}
    </div>
  );
}
