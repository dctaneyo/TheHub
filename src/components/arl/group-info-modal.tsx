"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  UserPlus,
  UserMinus,
  Crown,
  LogOut,
  Edit2,
  Save,
  X,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface GroupMember {
  id: string;
  memberId: string;
  memberType: "location" | "arl";
  name: string;
  role: "admin" | "member";
  joinedAt: string;
}

interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  avatarColor?: string;
  createdBy: string;
  createdAt: string;
  members: GroupMember[];
  memberCount: number;
}

interface GroupInfoModalProps {
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const AVATAR_COLORS = [
  "#dc2626", // red
  "#ea580c", // orange
  "#ca8a04", // yellow
  "#16a34a", // green
  "#0891b2", // cyan
  "#2563eb", // blue
  "#7c3aed", // purple
  "#c026d3", // fuchsia
  "#db2777", // pink
];

export function GroupInfoModal({
  conversationId,
  isOpen,
  onClose,
  onUpdate,
}: GroupInfoModalProps) {
  const { user } = useAuth();
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedColor, setEditedColor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<
    Array<{ id: string; name: string; type: "location" | "arl" }>
  >([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const currentUserMember = groupInfo?.members.find(
    (m) => m.memberId === user?.id && m.memberType === user?.userType
  );
  const isAdmin = currentUserMember?.role === "admin";
  
  // Check if this is the global chat (which shouldn't be editable)
  const isGlobalChat = groupInfo?.name === "Global Chat" || groupInfo?.id === "global";

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchGroupInfo();
    }
  }, [isOpen, conversationId]);

  const fetchGroupInfo = async () => {
    try {
      const res = await fetch(`/api/messages/groups/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setGroupInfo(data);
        setEditedName(data.name || "");
        setEditedDescription(data.description || "");
        setEditedColor(data.avatarColor || AVATAR_COLORS[0]);
      }
    } catch (error) {
      console.error("Failed to fetch group info:", error);
    }
  };

  const fetchAvailableMembers = async () => {
    try {
      const [locationsRes, arlsRes] = await Promise.all([
        fetch("/api/locations"),
        fetch("/api/arls"),
      ]);

      const locations = locationsRes.ok ? await locationsRes.json() : [];
      const arls = arlsRes.ok ? await arlsRes.json() : [];

      const currentMemberIds = new Set(
        groupInfo?.members.map((m) => `${m.memberType}-${m.memberId}`) || []
      );

      const available = [
        ...locations.map((l: any) => ({
          id: `location-${l.id}`,
          name: l.name,
          type: "location" as const,
          actualId: l.id,
        })),
        ...arls.map((a: any) => ({
          id: `arl-${a.id}`,
          name: a.name,
          type: "arl" as const,
          actualId: a.id,
        })),
      ].filter((m) => !currentMemberIds.has(m.id));

      setAvailableMembers(available);
    } catch (error) {
      console.error("Failed to fetch members:", error);
    }
  };

  const handleSaveEdit = async () => {
    if (!isAdmin) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/messages/groups/${conversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedName,
          description: editedDescription,
          avatarColor: editedColor,
        }),
      });

      if (res.ok) {
        setIsEditing(false);
        await fetchGroupInfo();
        onUpdate?.();
      }
    } catch (error) {
      console.error("Failed to update group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (!isAdmin || selectedMembers.length === 0) return;

    setIsLoading(true);
    try {
      const memberIds = selectedMembers.map((id) => id.split("-")[1]);
      const memberTypes = selectedMembers.map((id) => id.split("-")[0]);

      const res = await fetch(`/api/messages/groups/${conversationId}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds, memberTypes }),
      });

      if (res.ok) {
        setShowAddMember(false);
        setSelectedMembers([]);
        await fetchGroupInfo();
        onUpdate?.();
      }
    } catch (error) {
      console.error("Failed to add members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberType: string) => {
    if (!isAdmin) return;

    if (!confirm("Remove this member from the group?")) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/messages/groups/${conversationId}/members?memberId=${memberId}&memberType=${memberType}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        await fetchGroupInfo();
        onUpdate?.();
      }
    } catch (error) {
      console.error("Failed to remove member:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm("Are you sure you want to leave this group?")) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/messages/groups/${conversationId}/leave`, {
        method: "POST",
      });

      if (res.ok) {
        onClose();
        onUpdate?.();
      }
    } catch (error) {
      console.error("Failed to leave group:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!groupInfo) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: groupInfo.avatarColor || AVATAR_COLORS[0] }}
            >
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-lg font-semibold"
                  placeholder="Group name"
                />
              ) : (
                <span>{groupInfo.name}</span>
              )}
            </div>
            {isAdmin && !isEditing && !isGlobalChat && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {groupInfo.memberCount} members · Created{" "}
            {format(new Date(groupInfo.createdAt), "MMM d, yyyy")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Description */}
            <div>
              <Label>Description</Label>
              {isEditing ? (
                <Textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="What's this group about?"
                  className="mt-2"
                  rows={3}
                />
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  {groupInfo.description || "No description"}
                </p>
              )}
            </div>

            {/* Color Picker */}
            {isEditing && (
              <div>
                <Label className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Group Color
                </Label>
                <div className="flex gap-2 mt-2">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditedColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all",
                        editedColor === color
                          ? "border-foreground scale-110"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Save/Cancel Buttons */}
            {isEditing && (
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveEdit}
                  disabled={isLoading || !editedName.trim()}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedName(groupInfo.name || "");
                    setEditedDescription(groupInfo.description || "");
                    setEditedColor(groupInfo.avatarColor || AVATAR_COLORS[0]);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Members List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Members ({groupInfo.memberCount})</Label>
                {isAdmin && !showAddMember && !isGlobalChat && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddMember(true);
                      fetchAvailableMembers();
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Members
                  </Button>
                )}
              </div>

              {/* Add Members UI */}
              {showAddMember && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Add Members</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddMember(false);
                        setSelectedMembers([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <ScrollArea className="h-48 mb-3">
                    <div className="space-y-2">
                      {availableMembers.map((member) => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-2 rounded hover:bg-background cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              if (e.target.checked) {
                                setSelectedMembers([...selectedMembers, member.id]);
                              } else {
                                setSelectedMembers(
                                  selectedMembers.filter((id) => id !== member.id)
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <span className="flex-1">{member.name}</span>
                          <Badge variant="outline">
                            {member.type === "location" ? "Location" : "ARL"}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>
                  <Button
                    onClick={handleAddMembers}
                    disabled={isLoading || selectedMembers.length === 0}
                    className="w-full"
                  >
                    Add {selectedMembers.length} Member
                    {selectedMembers.length !== 1 ? "s" : ""}
                  </Button>
                </div>
              )}

              {/* Current Members */}
              <div className="space-y-2">
                {groupInfo.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.name}</span>
                        {member.role === "admin" && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {member.memberType === "location" ? "Location" : "ARL"}
                    </Badge>
                    {isAdmin &&
                      !isGlobalChat &&
                      member.memberId !== user?.id &&
                      member.memberType !== user?.userType && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleRemoveMember(member.memberId, member.memberType)
                          }
                          disabled={isLoading}
                        >
                          <UserMinus className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                  </div>
                ))}
              </div>
            </div>

            {/* Leave Group Button - hidden for global chat */}
            {!isGlobalChat && (
              <div className="pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleLeaveGroup}
                  disabled={isLoading}
                  className="w-full"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave Group
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
