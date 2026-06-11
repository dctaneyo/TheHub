"use client";

import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Maximize2, 
  Minimize2, 
  X, 
  Settings,
  MoreVertical,
  Hand
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useGrid, useWidget } from "./grid-context";
import { WIDGET_SIZES, type Widget, type WidgetSize } from "./grid-layout";

interface WidgetContainerProps {
  widget: Widget;
  children: React.ReactNode;
  onRemove?: (widgetId: string) => void;
  onSettings?: (widgetId: string) => void;
  isDraggable?: boolean;
  isResizable?: boolean;
  showControls?: boolean;
}

export function WidgetContainer({
  widget,
  children,
  onRemove,
  onSettings,
  isDraggable = false,
  isResizable = false,
  showControls = true
}: WidgetContainerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    updateWidgetPosition, 
    updateWidgetSize, 
    toggleWidgetExpansion,
    isExpanded
  } = useGrid();
  
  const { widget: widgetData } = useWidget(widget.id);

  const expanded = isExpanded(widget.id);
  const bounds = {
    width: WIDGET_SIZES[widget.size].width,
    height: WIDGET_SIZES[widget.size].height
  };

  // Handle widget expansion
  const handleExpand = useCallback(() => {
    toggleWidgetExpansion(widget.id);
  }, [widget.id, toggleWidgetExpansion]);

  // Handle widget removal
  const handleRemove = useCallback(() => {
    onRemove?.(widget.id);
  }, [widget.id, onRemove]);

  // Handle widget settings
  const handleSettings = useCallback(() => {
    onSettings?.(widget.id);
    setShowMenu(false);
  }, [widget.id, onSettings]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!isDraggable || expanded) return;
    
    setIsDragging(true);
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...widget.position };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      // Convert pixel delta to grid units
      const gridUnit = containerRef.current?.offsetWidth ? 
        containerRef.current.offsetWidth / bounds.width : 0;
      
      if (gridUnit > 0) {
        const newX = Math.max(0, Math.min(12 - bounds.width, startPos.x + Math.round(deltaX / gridUnit)));
        const newY = Math.max(0, Math.min(12 - bounds.height, startPos.y + Math.round(deltaY / gridUnit)));
        
        updateWidgetPosition(widget.id, { x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isDraggable, expanded, widget.position, widget.id, bounds, updateWidgetPosition]);

  // Get widget dimensions for grid
  const getWidgetStyles = useCallback(() => {
    if (expanded) {
      return {
        gridColumn: '1 / -1',
        gridRow: '1 / -1',
        zIndex: 50
      };
    }

    const { width, height } = WIDGET_SIZES[widget.size];
    return {
      gridColumn: `${widget.position.x + 1} / ${widget.position.x + width + 1}`,
      gridRow: `${widget.position.y + 1} / ${widget.position.y + height + 1}`,
      zIndex: isDragging ? 40 : 10
    };
  }, [expanded, widget.size, widget.position, isDragging]);

  return (
    <motion.div
      ref={containerRef}
      style={getWidgetStyles()}
      className={cn(
        "relative group bg-card border border-border rounded-2xl shadow-sm overflow-hidden",
        "transition-all duration-200 ease-in-out",
        expanded && "fixed inset-4 md:inset-8 rounded-3xl shadow-2xl",
        isDragging && "cursor-grabbing shadow-lg scale-105",
        isDraggable && !expanded && "cursor-grab hover:shadow-md",
        "hover:border-border/80"
      )}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: isDragging ? 0 : -2 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Widget Header */}
      <div className={cn(
        "flex items-center justify-between p-3 border-b border-border/50 bg-muted/30",
        expanded && "p-4"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <h3 className={cn(
            "font-semibold text-foreground truncate",
            expanded && "text-lg"
          )}>
            {widget.title}
          </h3>
        </div>

        {/* Controls */}
        <AnimatePresence>
          {(isHovered || showMenu) && showControls && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1"
            >
              {/* Drag Handle */}
              {isDraggable && !expanded && (
                <button
                  onMouseDown={handleDragStart}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title="Drag to move"
                >
                  <Hand className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              {/* Settings */}
              {onSettings && (
                <button
                  onClick={handleSettings}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title="Settings"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </button>
              )}

              {/* Expand/Minimize */}
              <button
                onClick={handleExpand}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                title={expanded ? "Minimize" : "Expand"}
              >
                {expanded ? (
                  <Minimize2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Maximize2 className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Remove */}
              {onRemove && (
                <button
                  onClick={handleRemove}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                  title="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Widget Content */}
      <div className={cn(
        "relative overflow-hidden",
        expanded ? "h-[calc(100%-5rem)]" : "h-[calc(100%-3rem)]"
      )}>
        {children}
      </div>

      {/* Overlay when expanded */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
          onClick={handleExpand}
        />
      )}
    </motion.div>
  );
}

// Widget size selector for resize functionality
interface WidgetSizeSelectorProps {
  currentSize: WidgetSize;
  onSizeChange: (size: WidgetSize) => void;
  availableSizes: WidgetSize[];
}

export function WidgetSizeSelector({ 
  currentSize, 
  onSizeChange, 
  availableSizes 
}: WidgetSizeSelectorProps) {
  return (
    <div className="grid grid-cols-4 gap-2 p-2">
      {availableSizes.map(size => {
        const { width, height } = WIDGET_SIZES[size];
        const isSelected = size === currentSize;
        
        return (
          <button
            key={size}
            onClick={() => onSizeChange(size)}
            className={cn(
              "relative border-2 rounded-lg p-2 transition-all",
              isSelected 
                ? "border-primary bg-primary/10" 
                : "border-border hover:border-border/80"
            )}
            title={`${size} (${width}×${height})`}
          >
            <div className={cn(
              "bg-muted/50 rounded-sm",
              size === '1x1' && "w-2 h-2",
              size === '1x2' && "w-2 h-4",
              size === '1x3' && "w-2 h-6",
              size === '1x4' && "w-2 h-8",
              size === '2x1' && "w-4 h-2",
              size === '2x2' && "w-4 h-4",
              size === '2x3' && "w-4 h-6",
              size === '2x4' && "w-4 h-8",
              size === '3x2' && "w-6 h-4",
              size === '3x3' && "w-6 h-6",
              size === '3x4' && "w-6 h-8",
              size === '4x2' && "w-8 h-4",
              size === '4x3' && "w-8 h-6",
              size === '4x4' && "w-8 h-8",
              size === '6x4' && "w-12 h-8",
              size === '6x6' && "w-12 h-12",
              size === '8x4' && "w-16 h-8",
              size === '8x6' && "w-16 h-12",
              size === '8x8' && "w-16 h-16",
              size === '12x2' && "w-20 h-4",
              size === '12x3' && "w-20 h-6",
              size === '12x4' && "w-20 h-8",
              size === '12x12' && "w-20 h-20"
            )} />
            <span className="text-[10px] text-muted-foreground mt-1">
              {size}
            </span>
          </button>
        );
      })}
    </div>
  );
}