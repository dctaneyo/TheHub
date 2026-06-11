"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useGridLayout, type GridLayout, type Widget, type WidgetSize } from "./grid-layout";

interface GridContextType {
  // Grid state
  layout: GridLayout;
  widgets: Widget[];
  expandedWidget: string | null;
  isExpanded: (widgetId: string) => boolean;
  
  // Layout operations
  updateWidgetPosition: (widgetId: string, position: { x: number; y: number }) => void;
  updateWidgetSize: (widgetId: string, size: WidgetSize) => void;
  toggleWidgetExpansion: (widgetId: string) => void;
  addWidget: (widget: Omit<Widget, 'position'>) => void;
  removeWidget: (widgetId: string) => void;
  loadLayout: (layoutId: string) => void;
  setLayout: (layout: GridLayout) => void;
  
  // Customization state
  isCustomMode: boolean;
  setIsCustomMode: (enabled: boolean) => void;
  
  // Widget data management
  updateWidgetData: (widgetId: string, data: any) => void;
  getWidgetData: (widgetId: string) => any;
}

const GridContext = createContext<GridContextType | null>(null);

interface GridProviderProps {
  children: ReactNode;
  initialLayout?: GridLayout;
  onLayoutChange?: (layout: GridLayout) => void;
}

export function GridProvider({ 
  children, 
  initialLayout, 
  onLayoutChange 
}: GridProviderProps) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [widgetDataMap, setWidgetDataMap] = useState<Map<string, any>>(new Map());
  
  const gridState = useGridLayout(initialLayout!);

  // Update widget data
  const updateWidgetData = useCallback((widgetId: string, data: any) => {
    setWidgetDataMap(prev => {
      const newMap = new Map(prev);
      newMap.set(widgetId, data);
      return newMap;
    });
  }, []);

  // Get widget data
  const getWidgetData = useCallback((widgetId: string) => {
    return widgetDataMap.get(widgetId);
  }, [widgetDataMap]);

  // Enhanced widget operations with data management
  const enhancedUpdateWidgetPosition = useCallback((widgetId: string, position: { x: number; y: number }) => {
    gridState.updateWidgetPosition(widgetId, position);
  }, [gridState]);

  const enhancedUpdateWidgetSize = useCallback((widgetId: string, size: WidgetSize) => {
    gridState.updateWidgetSize(widgetId, size);
  }, [gridState]);

  const enhancedToggleWidgetExpansion = useCallback((widgetId: string) => {
    gridState.toggleWidgetExpansion(widgetId);
  }, [gridState]);

  const enhancedAddWidget = useCallback((widget: Omit<Widget, 'position'>) => {
    gridState.addWidget(widget);
    if (widget.data) {
      updateWidgetData(widget.id, widget.data);
    }
  }, [gridState.addWidget, updateWidgetData]);

  const enhancedRemoveWidget = useCallback((widgetId: string) => {
    gridState.removeWidget(widgetId);
    setWidgetDataMap(prev => {
      const newMap = new Map(prev);
      newMap.delete(widgetId);
      return newMap;
    });
  }, [gridState.removeWidget]);

  const enhancedLoadLayout = useCallback((layoutId: string) => {
    gridState.loadLayout(layoutId);
    setWidgetDataMap(new Map()); // Clear widget data when loading new layout
  }, [gridState.loadLayout]);

  const enhancedSetLayout = useCallback((layout: GridLayout) => {
    gridState.setLayout(layout);
    onLayoutChange?.(layout);
  }, [gridState.setLayout, onLayoutChange]);

  // Enhanced widgets with data
  const enhancedWidgets = gridState.widgets.map(widget => ({
    ...widget,
    data: getWidgetData(widget.id)
  }));

  const contextValue: GridContextType = {
    // Grid state
    layout: gridState.layout,
    widgets: enhancedWidgets,
    expandedWidget: gridState.expandedWidget,
    isExpanded: gridState.isExpanded,
    
    // Layout operations
    updateWidgetPosition: enhancedUpdateWidgetPosition,
    updateWidgetSize: enhancedUpdateWidgetSize,
    toggleWidgetExpansion: enhancedToggleWidgetExpansion,
    addWidget: enhancedAddWidget,
    removeWidget: enhancedRemoveWidget,
    loadLayout: enhancedLoadLayout,
    setLayout: enhancedSetLayout,
    
    // Customization state
    isCustomMode,
    setIsCustomMode,
    
    // Widget data management
    updateWidgetData,
    getWidgetData
  };

  return (
    <GridContext.Provider value={contextValue}>
      {children}
    </GridContext.Provider>
  );
}

export function useGrid() {
  const context = useContext(GridContext);
  if (!context) {
    throw new Error('useGrid must be used within a GridProvider');
  }
  return context;
}

// Hook for widget-specific operations
export function useWidget(widgetId: string) {
  const grid = useGrid();
  
  const widget = grid.widgets.find(w => w.id === widgetId);
  
  const updateData = useCallback((data: any) => {
    grid.updateWidgetData(widgetId, data);
  }, [grid.updateWidgetData, widgetId]);
  
  const updatePosition = useCallback((position: { x: number; y: number }) => {
    grid.updateWidgetPosition(widgetId, position);
  }, [grid.updateWidgetPosition, widgetId]);
  
  const updateSize = useCallback((size: WidgetSize) => {
    grid.updateWidgetSize(widgetId, size);
  }, [grid.updateWidgetSize, widgetId]);
  
  const toggleExpansion = useCallback(() => {
    grid.toggleWidgetExpansion(widgetId);
  }, [grid.toggleWidgetExpansion, widgetId]);
  
  const remove = useCallback(() => {
    grid.removeWidget(widgetId);
  }, [grid.removeWidget, widgetId]);
  
  return {
    widget,
    data: widget?.data,
    isExpanded: grid.isExpanded(widgetId),
    updateData,
    updatePosition,
    updateSize,
    toggleExpansion,
    remove
  };
}