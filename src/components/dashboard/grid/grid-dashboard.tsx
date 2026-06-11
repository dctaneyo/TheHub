"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LayoutGrid, Settings, RefreshCw } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { PREDEFINED_LAYOUTS, type GridLayout, type Widget } from "./grid-layout";
import { GridProvider, useGrid } from "./grid-context";
import { WidgetContainer } from "./widget-container";

// Widget components will be imported separately
import { Timeline } from "@/components/dashboard/timeline";
import { MiniCalendar } from "@/components/dashboard/mini-calendar";
import { RestaurantChat } from "@/components/dashboard/restaurant-chat";
import { FormsViewer } from "@/components/dashboard/forms-viewer";
import { Leaderboard } from "@/components/dashboard/leaderboard";
import { StatsWidget } from "@/components/dashboard/widgets/stats-widget";

interface GridDashboardProps {
  initialLayout?: GridLayout;
  onLayoutChange?: (layout: GridLayout) => void;
  showLayoutSwitcher?: boolean;
  allowCustomization?: boolean;
}

// Widget renderer component
function WidgetRenderer({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case 'timeline':
      return (
        <Timeline 
          tasks={widget.data?.tasks || []}
          onComplete={widget.data?.onComplete || (() => {})}
          onUncomplete={widget.data?.onUncomplete || (() => {})}
          currentTime={widget.data?.currentTime || ''}
        />
      );
    
    case 'calendar':
      return (
        <MiniCalendar 
          upcomingTasks={widget.data?.upcomingTasks || {}}
          onEarlyComplete={widget.data?.onEarlyComplete}
        />
      );
    
    case 'chat':
      return (
        <RestaurantChat
          isOpen={widget.data?.isOpen || false}
          onClose={widget.data?.onClose || (() => {})}
          unreadCount={widget.data?.unreadCount || 0}
          onUnreadChange={widget.data?.onUnreadChange || (() => {})}
        />
      );
    
    case 'forms':
      return (
        <FormsViewer 
          onClose={() => {}}
        />
      );
    
    case 'leaderboard':
      return (
        <Leaderboard 
          currentLocationId={widget.data?.currentLocationId || ''}
          compact={widget.size !== '12x12'}
        />
      );
    
    case 'stats':
      return (
        <StatsWidget 
          completedTasks={widget.data?.completedTasks || 0}
          totalTasks={widget.data?.totalTasks || 0}
          pointsToday={widget.data?.pointsToday || 0}
          missedTasks={widget.data?.missedTasks || 0}
          loading={widget.data?.loading || false}
          compact={widget.size !== '12x12'}
        />
      );
    
    default:
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          <div className="text-center">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-sm">Unknown widget: {widget.type}</p>
          </div>
        </div>
      );
  }
}

// Main dashboard content with context
function GridDashboardContent({ 
  onLayoutChange,
  showLayoutSwitcher = true,
  allowCustomization = true
}: Omit<GridDashboardProps, 'initialLayout'>) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  
  const {
    layout,
    widgets,
    expandedWidget,
    updateWidgetPosition,
    updateWidgetSize,
    toggleWidgetExpansion,
    addWidget,
    removeWidget,
    loadLayout,
    setLayout,
    setIsCustomMode: setContextCustomMode
  } = useGrid();

  // Sync custom mode state
  const syncCustomMode = useCallback((enabled: boolean) => {
    setIsCustomMode(enabled);
    setContextCustomMode(enabled);
  }, [setContextCustomMode]);

  // Handle layout changes
  const handleLayoutChange = useCallback((newLayout: GridLayout) => {
    setLayout(newLayout);
    onLayoutChange?.(newLayout);
  }, [setLayout, onLayoutChange]);

  // Handle widget removal
  const handleWidgetRemove = useCallback((widgetId: string) => {
    removeWidget(widgetId);
  }, [removeWidget]);

  // Handle widget settings
  const handleWidgetSettings = useCallback((widgetId: string) => {
    // TODO: Implement widget settings modal
    console.log('Settings for widget:', widgetId);
  }, []);

  // Add new widget
  const handleAddWidget = useCallback((type: string) => {
    const newWidget: Omit<Widget, 'position'> = {
      id: `${type}-${Date.now()}`,
      type,
      title: type.charAt(0).toUpperCase() + type.slice(1),
      size: '4x4',
      data: {}
    };
    
    addWidget(newWidget);
    syncCustomMode(true);
  }, [addWidget, syncCustomMode]);

  // Toggle custom mode
  const toggleCustomMode = useCallback(() => {
    const newMode = !isCustomMode;
    syncCustomMode(newMode);
    
    if (!newMode) {
      // Save custom layout when exiting custom mode
      handleLayoutChange({
        ...layout,
        id: 'custom',
        name: 'Custom Layout',
        description: 'User customized layout',
        isCustom: true
      });
    }
  }, [isCustomMode, layout, handleLayoutChange, syncCustomMode]);

  // Reset to predefined layout
  const resetLayout = useCallback((layoutId: string) => {
    loadLayout(layoutId);
    syncCustomMode(false);
    setShowLayoutMenu(false);
  }, [loadLayout, syncCustomMode]);

  // Grid styles
  const gridStyles = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: 'repeat(12, 1fr)',
    gridTemplateRows: 'repeat(12, 1fr)',
    gap: '4px',
    height: '100%',
    padding: '4px'
  }), []);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header Controls */}
      {showLayoutSwitcher && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {layout.name}
            </h2>
            {layout.isCustom && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                Custom
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Layout Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <LayoutGrid className="h-4 w-4" />
                Layouts
              </button>

              <AnimatePresence>
                {showLayoutMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 top-full mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50"
                  >
                    <div className="p-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                        Predefined Layouts
                      </div>
                      {PREDEFINED_LAYOUTS.map(preset => (
                        <button
                          key={preset.id}
                          onClick={() => resetLayout(preset.id)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                            "hover:bg-muted",
                            layout.id === preset.id && "bg-primary/10 text-primary"
                          )}
                        >
                          <div className="font-medium">{preset.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {preset.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Custom Mode Toggle */}
            {allowCustomization && (
              <button
                onClick={toggleCustomMode}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg transition-colors",
                  isCustomMode 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-card border-border hover:bg-muted"
                )}
              >
                <Settings className="h-4 w-4" />
                {isCustomMode ? 'Editing' : 'Customize'}
              </button>
            )}

            {/* Add Widget (only in custom mode) */}
            {isCustomMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleAddWidget('timeline')}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                >
                  + Tasks
                </button>
                <button
                  onClick={() => handleAddWidget('chat')}
                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                >
                  + Chat
                </button>
                <button
                  onClick={() => handleAddWidget('calendar')}
                  className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                >
                  + Calendar
                </button>
                <button
                  onClick={() => handleAddWidget('forms')}
                  className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                >
                  + Forms
                </button>
                <button
                  onClick={() => handleAddWidget('leaderboard')}
                  className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                >
                  + Leaderboard
                </button>
                <button
                  onClick={() => handleAddWidget('stats')}
                  className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded hover:bg-pink-200 transition-colors"
                >
                  + Stats
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid Container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Grid Background (only visible in custom mode) */}
        {isCustomMode && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={gridStyles}
          >
            {Array.from({ length: 144 }).map((_, i) => (
              <div
                key={i}
                className="border border-border/20 rounded-sm"
              />
            ))}
          </div>
        )}

        {/* Widgets Grid */}
        <div 
          className="relative h-full"
          style={gridStyles}
        >
          <AnimatePresence>
            {widgets.map(widget => (
              <WidgetContainer
                key={widget.id}
                widget={widget}
                onRemove={isCustomMode ? handleWidgetRemove : undefined}
                onSettings={handleWidgetSettings}
                isDraggable={isCustomMode}
                isResizable={isCustomMode}
                showControls={true}
              >
                <WidgetRenderer widget={widget} />
              </WidgetContainer>
            ))}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {widgets.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No widgets yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add widgets to customize your dashboard
              </p>
              {allowCustomization && (
                <button
                  onClick={() => syncCustomMode(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Start Customizing
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function GridDashboard({ 
  initialLayout,
  onLayoutChange,
  showLayoutSwitcher = true,
  allowCustomization = true
}: GridDashboardProps) {
  return (
    <GridProvider 
      initialLayout={initialLayout} 
      onLayoutChange={onLayoutChange}
    >
      <GridDashboardContent 
        showLayoutSwitcher={showLayoutSwitcher}
        allowCustomization={allowCustomization}
        onLayoutChange={onLayoutChange}
      />
    </GridProvider>
  );
}