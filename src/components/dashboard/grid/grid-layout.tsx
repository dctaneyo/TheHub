"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Grid configuration
export const GRID_SIZE = 12;
export const GRID_GAP = 4; // Gap between widgets in pixels

// Widget size presets
export const WIDGET_SIZES = {
  // Small widgets
  '1x1': { width: 1, height: 1 },
  '1x2': { width: 1, height: 2 },
  '1x3': { width: 1, height: 3 },
  '1x4': { width: 1, height: 4 },
  '2x1': { width: 2, height: 1 },
  '2x2': { width: 2, height: 2 },
  '2x3': { width: 2, height: 3 },
  '2x4': { width: 2, height: 4 },
  
  // Medium widgets
  '3x2': { width: 3, height: 2 },
  '3x3': { width: 3, height: 3 },
  '3x4': { width: 3, height: 4 },
  '4x2': { width: 4, height: 2 },
  '4x3': { width: 4, height: 3 },
  '4x4': { width: 4, height: 4 },
  '4x6': { width: 4, height: 6 },
  '4x8': { width: 4, height: 8 },
  
  // Large widgets
  '6x4': { width: 6, height: 4 },
  '6x6': { width: 6, height: 6 },
  '8x4': { width: 8, height: 4 },
  '8x6': { width: 8, height: 6 },
  '8x8': { width: 8, height: 8 },
  
  // Full width
  '12x2': { width: 12, height: 2 },
  '12x3': { width: 12, height: 3 },
  '12x4': { width: 12, height: 4 },
  
  // Full screen
  '12x12': { width: 12, height: 12 },
} as const;

export type WidgetSize = keyof typeof WIDGET_SIZES;

export interface Widget {
  id: string;
  type: string;
  title: string;
  size: WidgetSize;
  position: { x: number; y: number };
  isExpanded?: boolean;
  isMinimized?: boolean;
  data?: any; // Widget-specific data
}

export interface GridLayout {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  isCustom?: boolean;
}

// Predefined layouts
export const PREDEFINED_LAYOUTS: GridLayout[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: '4 equal widgets for optimal viewing',
    widgets: [
      {
        id: 'tasks',
        type: 'timeline',
        title: "Today's Tasks",
        size: '6x6',
        position: { x: 0, y: 0 }
      },
      {
        id: 'chat',
        type: 'chat',
        title: 'Messages',
        size: '6x6',
        position: { x: 6, y: 0 }
      },
      {
        id: 'calendar',
        type: 'calendar',
        title: 'Calendar',
        size: '6x6',
        position: { x: 0, y: 6 }
      },
      {
        id: 'forms',
        type: 'forms',
        title: 'Forms',
        size: '6x6',
        position: { x: 6, y: 6 }
      }
    ]
  },
  {
    id: 'focus-tasks',
    name: 'Focus Tasks',
    description: 'Large task view with supporting widgets',
    widgets: [
      {
        id: 'tasks',
        type: 'timeline',
        title: "Today's Tasks",
        size: '8x8',
        position: { x: 0, y: 0 }
      },
      {
        id: 'chat',
        type: 'chat',
        title: 'Messages',
        size: '4x4',
        position: { x: 8, y: 0 }
      },
      {
        id: 'calendar',
        type: 'calendar',
        title: 'Upcoming',
        size: '4x4',
        position: { x: 8, y: 4 }
      },
      {
        id: 'stats',
        type: 'stats',
        title: 'Stats',
        size: '12x4',
        position: { x: 0, y: 8 }
      }
    ]
  },
  {
    id: 'social',
    name: 'Social Hub',
    description: 'Emphasis on messaging and collaboration',
    widgets: [
      {
        id: 'chat',
        type: 'chat',
        title: 'Messages',
        size: '8x8',
        position: { x: 0, y: 0 }
      },
      {
        id: 'tasks',
        type: 'timeline',
        title: "Today's Tasks",
        size: '4x8',
        position: { x: 8, y: 0 }
      },
      {
        id: 'leaderboard',
        type: 'leaderboard',
        title: 'Leaderboard',
        size: '12x4',
        position: { x: 0, y: 8 }
      }
    ]
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Classic dashboard layout',
    widgets: [
      {
        id: 'stats',
        type: 'stats',
        title: 'Overview',
        size: '12x3',
        position: { x: 0, y: 0 }
      },
      {
        id: 'tasks',
        type: 'timeline',
        title: "Today's Tasks",
        size: '6x6',
        position: { x: 0, y: 3 }
      },
      {
        id: 'calendar',
        type: 'calendar',
        title: 'Calendar',
        size: '6x6',
        position: { x: 6, y: 3 }
      },
      {
        id: 'chat',
        type: 'chat',
        title: 'Messages',
        size: '4x3',
        position: { x: 0, y: 9 }
      },
      {
        id: 'forms',
        type: 'forms',
        title: 'Forms',
        size: '4x3',
        position: { x: 4, y: 9 }
      },
      {
        id: 'leaderboard',
        type: 'leaderboard',
        title: 'Leaderboard',
        size: '4x3',
        position: { x: 8, y: 9 }
      }
    ]
  }
];

// Grid collision detection
export function checkCollision(
  widget: Widget,
  otherWidgets: Widget[],
  excludeId?: string
): boolean {
  const { position, size } = widget;
  const widgetBounds = {
    left: position.x,
    top: position.y,
    right: position.x + WIDGET_SIZES[size].width,
    bottom: position.y + WIDGET_SIZES[size].height
  };

  return otherWidgets.some(other => {
    if (other.id === excludeId) return false;
    
    const otherSize = WIDGET_SIZES[other.size];
    const otherBounds = {
      left: other.position.x,
      top: other.position.y,
      right: other.position.x + otherSize.width,
      bottom: other.position.y + otherSize.height
    };

    return !(
      widgetBounds.right <= otherBounds.left ||
      widgetBounds.left >= otherBounds.right ||
      widgetBounds.bottom <= otherBounds.top ||
      widgetBounds.top >= otherBounds.bottom
    );
  });
}

// Find empty position for widget
export function findEmptyPosition(
  widgetSize: WidgetSize,
  widgets: Widget[]
): { x: number; y: number } | null {
  const { width, height } = WIDGET_SIZES[widgetSize];
  
  for (let y = 0; y <= GRID_SIZE - height; y++) {
    for (let x = 0; x <= GRID_SIZE - width; x++) {
      const testWidget: Widget = {
        id: 'test',
        type: 'test',
        title: 'Test',
        size: widgetSize,
        position: { x, y }
      };
      
      if (!checkCollision(testWidget, widgets)) {
        return { x, y };
      }
    }
  }
  
  return null;
}

// Grid layout engine
export function useGridLayout(initialLayout: GridLayout) {
  const [layout, setLayout] = useState<GridLayout>(initialLayout);
  const [expandedWidget, setExpandedWidget] = useState<string | null>(null);

  // Update widget position
  const updateWidgetPosition = useCallback((widgetId: string, position: { x: number; y: number }) => {
    setLayout(prev => ({
      ...prev,
      widgets: prev.widgets.map(widget =>
        widget.id === widgetId ? { ...widget, position } : widget
      )
    }));
  }, []);

  // Update widget size
  const updateWidgetSize = useCallback((widgetId: string, size: WidgetSize) => {
    setLayout(prev => {
      const widget = prev.widgets.find(w => w.id === widgetId);
      if (!widget) return prev;
      
      // Check if new size fits at current position
      const testWidget = { ...widget, size };
      if (checkCollision(testWidget, prev.widgets, widgetId)) {
        // Try to find new position
        const newPosition = findEmptyPosition(size, prev.widgets.filter(w => w.id !== widgetId));
        if (!newPosition) return prev; // No space available
        
        return {
          ...prev,
          widgets: prev.widgets.map(w =>
            w.id === widgetId ? { ...w, size, position: newPosition } : w
          )
        };
      }
      
      return {
        ...prev,
        widgets: prev.widgets.map(w =>
          w.id === widgetId ? { ...w, size } : w
        )
      };
    });
  }, []);

  // Toggle widget expansion
  const toggleWidgetExpansion = useCallback((widgetId: string) => {
    setExpandedWidget(prev => prev === widgetId ? null : widgetId);
  }, []);

  // Add widget
  const addWidget = useCallback((widget: Omit<Widget, 'position'>) => {
    setLayout(prev => {
      const position = findEmptyPosition(widget.size, prev.widgets);
      if (!position) return prev; // No space available
      
      return {
        ...prev,
        widgets: [...prev.widgets, { ...widget, position }]
      };
    });
  }, []);

  // Remove widget
  const removeWidget = useCallback((widgetId: string) => {
    setLayout(prev => ({
      ...prev,
      widgets: prev.widgets.filter(w => w.id !== widgetId)
    }));
  }, []);

  // Load predefined layout
  const loadLayout = useCallback((layoutId: string) => {
    const predefined = PREDEFINED_LAYOUTS.find(l => l.id === layoutId);
    if (predefined) {
      setLayout({ ...predefined, isCustom: false });
      setExpandedWidget(null);
    }
  }, []);

  // Get widget at position
  const getWidgetAtPosition = useCallback((x: number, y: number) => {
    return layout.widgets.find(widget => {
      const { position, size } = widget;
      const { width, height } = WIDGET_SIZES[size];
      
      return x >= position.x && x < position.x + width &&
             y >= position.y && y < position.y + height;
    });
  }, [layout]);

  // Grid state
  const gridState = useMemo(() => ({
    layout,
    expandedWidget,
    widgets: layout.widgets,
    isExpanded: (widgetId: string) => expandedWidget === widgetId,
    getWidgetBounds: (widget: Widget) => {
      const { position, size } = widget;
      const { width, height } = WIDGET_SIZES[size];
      return {
        left: position.x,
        top: position.y,
        right: position.x + width,
        bottom: position.y + height,
        width,
        height
      };
    }
  }), [layout, expandedWidget]);

  return {
    ...gridState,
    updateWidgetPosition,
    updateWidgetSize,
    toggleWidgetExpansion,
    addWidget,
    removeWidget,
    loadLayout,
    getWidgetAtPosition,
    setLayout
  };
}