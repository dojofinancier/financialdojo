"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Video, Edit, Trash2, Plus, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  getGroupCoachingSessionsAction,
  createGroupCoachingSessionAction,
  updateGroupCoachingSessionAction,
  deleteGroupCoachingSessionAction,
} from "@/app/actions/group-coaching-sessions";
import { toast } from "sonner";
import { RichTextEditor } from "@/components/admin/courses/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GroupCoachingSession = {
  id: string;
  cohortId: string;
  title: string;
  description: string | null;
  scheduledAt: Date;
  zoomLink: string | null;
  teamsLink: string | null;
  recordingVimeoUrl: string | null;
  adminNotes: string | null;
  status: "UPCOMING" | "COMPLETED";
};

interface GroupCoachingSessionManagementProps {
  cohortId: string;
}

export function GroupCoachingSessionManagement({
  cohortId,
}: GroupCoachingSessionManagementProps) {
  const [sessions, setSessions] = useState<GroupCoachingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<GroupCoachingSession | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    scheduledAt: "",
    scheduledTime: "",
    zoomLink: "",
    teamsLink: "",
    recordingVimeoUrl: "",
    adminNotes: "",
    status: "UPCOMING" as "UPCOMING" | "COMPLETED",
  });

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getGroupCoachingSessionsAction(cohortId);
      if (result.success && result.data) {
        setSessions(result.data as GroupCoachingSession[]);
      }
    } catch (error) {
      toast.error("Error loading sessions");
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      scheduledAt: "",
      scheduledTime: "",
      zoomLink: "",
      teamsLink: "",
      recordingVimeoUrl: "",
      adminNotes: "",
      status: "UPCOMING",
    });
    setSelectedSession(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (session: GroupCoachingSession) => {
    setSelectedSession(session);
    const scheduledDate = new Date(session.scheduledAt);
    setFormData({
      title: session.title,
      description: session.description || "",
      scheduledAt: format(scheduledDate, "yyyy-MM-dd"),
      scheduledTime: format(scheduledDate, "HH:mm"),
      zoomLink: session.zoomLink || "",
      teamsLink: session.teamsLink || "",
      recordingVimeoUrl: session.recordingVimeoUrl || "",
      adminNotes: session.adminNotes || "",
      status: session.status,
    });
    setEditDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.scheduledAt || !formData.scheduledTime) {
      toast.error("Le titre, la date et l'heure sont requis");
      return;
    }

    try {
      const scheduledAt = new Date(`${formData.scheduledAt}T${formData.scheduledTime}`);
      const result = await createGroupCoachingSessionAction({
        cohortId,
        title: formData.title,
        description: formData.description || undefined,
        scheduledAt,
        zoomLink: formData.zoomLink || undefined,
        teamsLink: formData.teamsLink || undefined,
        recordingVimeoUrl: formData.recordingVimeoUrl || undefined,
        adminNotes: formData.adminNotes || undefined,
        status: formData.status,
      });

      if (result.success) {
        toast.success("Session created successfully");
        setCreateDialogOpen(false);
        resetForm();
        loadSessions();
      } else {
        toast.error(result.error || "Error creating");
      }
    } catch (error) {
      toast.error("Error creating the session");
    }
  };

  const handleUpdate = async () => {
    if (!selectedSession || !formData.title.trim() || !formData.scheduledAt || !formData.scheduledTime) {
      return;
    }

    try {
      const scheduledAt = new Date(`${formData.scheduledAt}T${formData.scheduledTime}`);
      const result = await updateGroupCoachingSessionAction(selectedSession.id, {
        title: formData.title,
        description: formData.description || undefined,
        scheduledAt,
        zoomLink: formData.zoomLink || undefined,
        teamsLink: formData.teamsLink || undefined,
        recordingVimeoUrl: formData.recordingVimeoUrl || undefined,
        adminNotes: formData.adminNotes || undefined,
        status: formData.status,
      });

      if (result.success) {
        toast.success("Session updated successfully");
        setEditDialogOpen(false);
        resetForm();
        loadSessions();
      } else {
        toast.error(result.error || "Error updating");
      }
    } catch (error) {
      toast.error("Error updating the session");
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm("Are you sure you want to delete this session?")) {
      return;
    }

    try {
      const result = await deleteGroupCoachingSessionAction(sessionId);
      if (result.success) {
        toast.success("Session deleted successfully");
        loadSessions();
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      toast.error("Error deleting the session");
    }
  };

  const upcomingSessions = sessions.filter((s) => s.status === "UPCOMING");
  const completedSessions = sessions.filter((s) => s.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Group coaching sessions</h3>
          <p className="text-sm text-muted-foreground">
            Manage coaching sessions for this cohort
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              New session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New coaching session</DialogTitle>
              <DialogDescription>
                Schedule a new coaching session for this cohort
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ex: Session 1 - Introduction"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <RichTextEditor
                  content={formData.description}
                  onChange={(value) => setFormData({ ...formData, description: value })}
                  placeholder="Describe the session (optional)..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.scheduledAt}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time *</Label>
                  <Input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Zoom link</Label>
                <Input
                  value={formData.zoomLink}
                  onChange={(e) => setFormData({ ...formData, zoomLink: e.target.value })}
                  placeholder="https://zoom.us/j/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Teams link</Label>
                <Input
                  value={formData.teamsLink}
                  onChange={(e) => setFormData({ ...formData, teamsLink: e.target.value })}
                  placeholder="https://teams.microsoft.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Vimeo recording URL</Label>
                <Input
                  value={formData.recordingVimeoUrl}
                  onChange={(e) => setFormData({ ...formData, recordingVimeoUrl: e.target.value })}
                  placeholder="https://vimeo.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Admin notes</Label>
                <RichTextEditor
                  content={formData.adminNotes}
                  onChange={(value) => setFormData({ ...formData, adminNotes: value })}
                  placeholder="Internal notes (optional)..."
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "UPCOMING" | "COMPLETED") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UPCOMING">Upcoming</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Sessions */}
          {upcomingSessions.length > 0 && (
            <div>
              <h4 className="text-md font-semibold mb-3">Upcoming sessions</h4>
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingSessions.map((session) => (
                  <Card key={session.id} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{session.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {format(new Date(session.scheduledAt), "EEEE d MMMM yyyy 'at' HH:mm", {
                              locale: enUS,
                            })}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(session)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(session.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {session.description && (
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: session.description }}
                        />
                      )}
                      {session.zoomLink && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={session.zoomLink} target="_blank" rel="noopener noreferrer">
                            <Video className="h-3 w-3 mr-1" />
                            Zoom
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      )}
                      {session.teamsLink && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={session.teamsLink} target="_blank" rel="noopener noreferrer">
                            <Video className="h-3 w-3 mr-1" />
                            Teams
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Completed Sessions */}
          {completedSessions.length > 0 && (
            <div>
              <h4 className="text-md font-semibold mb-3">Completed sessions</h4>
              <div className="grid gap-4 md:grid-cols-2">
                {completedSessions.map((session) => (
                  <Card key={session.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{session.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {format(new Date(session.scheduledAt), "EEEE d MMMM yyyy 'at' HH:mm", {
                              locale: enUS,
                            })}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(session)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(session.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {session.recordingVimeoUrl && (
                        <div className="text-sm text-muted-foreground">
                          Recording available
                        </div>
                      )}
                      {session.adminNotes && (
                        <div
                          className="prose prose-sm max-w-none bg-muted p-2 rounded"
                          dangerouslySetInnerHTML={{ __html: session.adminNotes }}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {sessions.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Video className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No sessions</h3>
                <p className="text-muted-foreground">
                  Create your first coaching session
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                content={formData.description}
                onChange={(value) => setFormData({ ...formData, description: value })}
                placeholder="Describe the session (optional)..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Time *</Label>
                <Input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Zoom link</Label>
              <Input
                value={formData.zoomLink}
                onChange={(e) => setFormData({ ...formData, zoomLink: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Teams link</Label>
              <Input
                value={formData.teamsLink}
                onChange={(e) => setFormData({ ...formData, teamsLink: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Vimeo recording URL</Label>
              <Input
                value={formData.recordingVimeoUrl}
                onChange={(e) => setFormData({ ...formData, recordingVimeoUrl: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Admin notes</Label>
              <RichTextEditor
                content={formData.adminNotes}
                onChange={(value) => setFormData({ ...formData, adminNotes: value })}
                placeholder="Internal notes (optional)..."
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "UPCOMING" | "COMPLETED") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPCOMING">Upcoming</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

