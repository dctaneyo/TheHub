"use client";

import { useState, useEffect } from "react";
import { 
  Settings, 
  User, 
  Bell, 
  LogOut,
  Menu
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

interface SimpleHeaderProps {
  title?: string;
  subtitle?: string;
  showNotifications?: boolean;
  showUserMenu?: boolean;
  onMenuToggle?: () => void;
}

export function SimpleHeader({ 
  title = "Dashboard", 
  subtitle, 
  showNotifications = true,
  showUserMenu = true,
  onMenuToggle
}: SimpleHeaderProps) {
  const { user, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toTimeString().slice(0, 5));

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toTimeString().slice(0, 5));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    logout();
    setShowUserDropdown(false);
  };

  return (
    <div className="flex items-center justify-between h-14 px-4 border-b border-border bg-background">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="p-2 rounded-lg hover:bg-muted transition-colors md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary shadow-sm">
            <span className="text-sm font-black text-primary-foreground">H</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-[10px] text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Current time */}
        <div className="hidden md:block text-sm font-mono text-muted-foreground">
          {currentTime}
        </div>

        {/* Notifications */}
        {showNotifications && (
          <button className="p-2 rounded-lg hover:bg-muted transition-colors relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
          </button>
        )}

        {/* User menu */}
        {showUserMenu && user && (
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <User className="h-5 w-5" />
              <span className="hidden md:block text-sm font-medium">
                {user.name}
              </span>
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-50">
                <div className="p-3 border-b border-border">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.userType === 'location' ? 'Location' : 'ARL'}
                  </p>
                </div>
                
                <div className="p-1">
                  <button className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-sm">
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-sm text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}