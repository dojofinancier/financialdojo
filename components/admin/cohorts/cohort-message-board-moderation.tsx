"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Search, Edit, Trash2, Pin, X, Upload, Paperclip, Plus } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getCohortMessagesAction,
  updateCohortMessageAction,
  deleteCohortMessageAction,
  pinCohortMessageAction,
} from "@/app/actions/cohort-messages";
import { uploadCohortFileAction } from "@/app/actions/cohort-file-upload";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/admin/courses/rich-text-editor";

type CohortMessage = {
  id: string;
  cohortId: string;
  authorId: string;
  content: string;
  attachments: string[];
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  };
};

interface CohortMessageBoardModerationProps {
  cohortId: string;
}

export function CohortMessageBoardModeration({
  cohortId,
}: CohortMessageBoardModerationProps) {
  const [messages, setMessages] = useState<CohortMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<CohortMessage | null>(null);
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const result = await getCohortMessagesAction({ cohortId });
      const sortedMessages = (result.items as CohortMessage[]).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setMessages(sortedMessages);
    } catch (error) {
      toast.error("Error loading messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [cohortId]);

  // Auto-scroll to top when messages change (newest messages are at top)
  useEffect(() => {
    // Scroll to top since messages are sorted newest first
    const scrollContainer = messagesEndRef.current?.closest('[data-radix-scroll-area-viewport]') || 
                           messagesEndRef.current?.parentElement?.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [messages]);

  const handleCreate = async () => {
    if (!content.trim()) {
      toast.error("Le contenu est requis");
      return;
    }

    try {
      const { createCohortMessageAction } = await import("@/app/actions/cohort-messages");
      const result = await createCohortMessageAction({
        cohortId,
        content,
        attachments,
      });

      if (result.success && result.data) {
        // Optimistically add the new message to the list
        const newMessage = {
          ...result.data,
          createdAt: new Date(result.data.createdAt),
          updatedAt: new Date(result.data.updatedAt),
          readBy: [],
        } as CohortMessage;
        
        setMessages((prev) => {
          // Add new message at the beginning (newest first)
          const updated = [newMessage, ...prev];
          // Re-sort to maintain pinned messages first
          return updated.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        });
        
        toast.success("Message published successfully");
        setCreateDialogOpen(false);
        setContent("");
        setAttachments([]);
        setAttachmentNames([]);
        
        // Scroll to top (newest message) after a short delay
        setTimeout(() => {
          const scrollContainer = document.querySelector('[data-radix-scroll-area-viewport]');
          if (scrollContainer) {
            scrollContainer.scrollTop = 0;
          }
        }, 200);
      } else {
        toast.error(result.error || "Error publishing");
        // Reload messages on error to ensure consistency
        loadMessages();
      }
    } catch (error) {
      toast.error("Error publishing message");
      // Reload messages on error
      loadMessages();
    }
  };

  const handleEdit = async () => {
    if (!selectedMessage || !content.trim()) {
      return;
    }

    try {
      const result = await updateCohortMessageAction(selectedMessage.id, {
        content,
        attachments,
      });

      if (result.success) {
        toast.success("Message edited successfully");
        setEditDialogOpen(false);
        setSelectedMessage(null);
        setContent("");
        setAttachments([]);
        setAttachmentNames([]);
        loadMessages();
      } else {
        toast.error(result.error || "Error editing");
      }
    } catch (error) {
      toast.error("Error modifying the message");
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) {
      return;
    }

    try {
      const result = await deleteCohortMessageAction(messageId);
      if (result.success) {
        toast.success("Message deleted successfully");
        loadMessages();
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      toast.error("Error deleting the message");
    }
  };

  const handlePin = async (messageId: string, pinned: boolean) => {
    try {
      const result = await pinCohortMessageAction(messageId, pinned);
      if (result.success) {
        // Optimistically update the message in the list
        setMessages((prev) => {
          const updated = prev.map((msg) =>
            msg.id === messageId ? { ...msg, pinned } : msg
          );
          // Re-sort to maintain pinned messages first
          return updated.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          });
        });
        toast.success(pinned ? "Message pinned" : "Message unpinned");
      } else {
        toast.error(result.error || "Erreur");
        // Reload on error to ensure consistency
        loadMessages();
      }
    } catch (error) {
      toast.error("Erreur");
      loadMessages();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isCreate: boolean = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check file size (32MB max)
    const maxSize = 32 * 1024 * 1024; // 32MB in bytes
    const oversizedFiles = Array.from(files).filter((file) => file.size > maxSize);

    if (oversizedFiles.length > 0) {
      toast.error("Some files exceed the 32MB limit");
      return;
    }

    setUploading(true);

    try {
      // Upload all files
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return await uploadCohortFileAction(formData);
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter((r) => r.success);
      const failedUploads = results.filter((r) => !r.success);

      if (successfulUploads.length > 0) {
        const newUrls = successfulUploads.map((r) => r.url!);
        const newNames = successfulUploads.map((r) => r.fileName!);
        setAttachments([...attachments, ...newUrls]);
        setAttachmentNames([...attachmentNames, ...newNames]);
        toast.success(`${successfulUploads.length} fichier(s) téléversé(s) avec succès`);
      }

      if (failedUploads.length > 0) {
        toast.error(
          `${failedUploads.length} fichier(s) n'ont pas pu être téléversés: ${failedUploads[0]?.error || "Unknown error"}`
        );
      }
    } catch (error) {
      toast.error("Error uploading files");
    } finally {
      setUploading(false);
      const ref = isCreate ? createFileInputRef.current : fileInputRef.current;
      if (ref) {
        ref.value = "";
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
    setAttachmentNames(attachmentNames.filter((_, i) => i !== index));
  };

  const openCreateDialog = () => {
    setContent("");
    setAttachments([]);
    setAttachmentNames([]);
    setSelectedMessage(null);
    setCreateDialogOpen(true);
  };

  const openEditDialog = (message: CohortMessage) => {
    setSelectedMessage(message);
    setContent(message.content);
    setAttachments(message.attachments || []);
    // Extract file names from URLs for display
    const names = (message.attachments || []).map((url) => {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split("/");
        const fileName = pathParts[pathParts.length - 1];
        // Remove timestamp prefix if present
        return fileName.replace(/^\d+-/, "");
      } catch {
        return `Fichier ${message.attachments?.indexOf(url) || 0 + 1}`;
      }
    });
    setAttachmentNames(names);
    setEditDialogOpen(true);
  };

  const filteredMessages = messages.filter((message) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      message.content.toLowerCase().includes(query) ||
      message.author.email.toLowerCase().includes(query) ||
      (message.author.firstName && message.author.firstName.toLowerCase().includes(query)) ||
      (message.author.lastName && message.author.lastName.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Modération du tableau de messages</h3>
          <p className="text-sm text-muted-foreground">
            Gérez les messages de cette cohorte
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nouveau message
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nouveau message</DialogTitle>
              <DialogDescription>
                Publiez un message pour tous les membres de la cohorte
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Contenu</label>
                <RichTextEditor
                  content={content}
                  onChange={setContent}
                  placeholder="Write your message..."
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Pièces jointes (max 32MB par fichier)</label>
                <div className="flex items-center gap-2">
                  <Input
                    ref={createFileInputRef}
                    type="file"
                    multiple
                    onChange={(e) => handleFileSelect(e, true)}
                    className="hidden"
                    disabled={uploading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => createFileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploading ? "Uploading..." : "Add files"}
                  </Button>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((url, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                        <Paperclip className="h-3 w-3" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex-1"
                        >
                          {attachmentNames[index] || `Fichier ${index + 1}`}
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAttachment(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreate}>Publier</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher dans les messages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Messages */}
      {loading ? (
        <div className="text-center py-8">Chargement...</div>
      ) : filteredMessages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Aucun message</h3>
            <p className="text-muted-foreground">
              {searchQuery ? "No results for your search" : "No messages in this cohort"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-4">
            {/* Separate pinned and unpinned messages */}
            {filteredMessages.filter((m) => m.pinned).length > 0 && (
              <>
                <div className="flex items-center gap-2 py-2">
                  <Pin className="h-4 w-4 text-yellow-600" />
                  <h4 className="text-sm font-semibold text-yellow-600">Messages épinglés</h4>
                  <div className="flex-1 border-t border-yellow-300"></div>
                </div>
                {filteredMessages
                  .filter((m) => m.pinned)
                  .map((message) => (
                    <Card
                      key={message.id}
                      className="border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-base">
                                {message.author.firstName || message.author.lastName
                                  ? `${message.author.firstName || ""} ${message.author.lastName || ""}`.trim()
                                  : message.author.email}
                              </CardTitle>
                              <Badge variant="default" className="flex items-center gap-1 bg-yellow-500 hover:bg-yellow-600 text-white">
                                <Pin className="h-3 w-3 fill-current" />
                                Épinglé
                              </Badge>
                              {message.author.role === "ADMIN" && (
                                <Badge variant="default">Admin</Badge>
                              )}
                              {message.author.role === "INSTRUCTOR" && (
                                <Badge variant="secondary">Instructeur</Badge>
                              )}
                            </div>
                            <CardDescription>
                              {format(new Date(message.createdAt), "d MMMM yyyy 'at' HH:mm", { locale: fr })}
                              {message.updatedAt.getTime() !== message.createdAt.getTime() && " (modified)"}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePin(message.id, !message.pinned)}
                              title={message.pinned ? "Unpin" : "Pin"}
                            >
                              <Pin className={`h-4 w-4 ${message.pinned ? "fill-current" : ""}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(message)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(message.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div
                          className="prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: message.content }}
                        />
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-4 space-y-2">
                            <p className="text-sm font-medium">Pièces jointes:</p>
                            <div className="flex flex-wrap gap-2">
                              {message.attachments.map((url, index) => (
                                <Button
                                  key={index}
                                  variant="outline"
                                  size="sm"
                                  asChild
                                >
                                  <a href={url} target="_blank" rel="noopener noreferrer">
                                    Fichier {index + 1}
                                  </a>
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                <div className="flex items-center gap-2 py-2 mt-4">
                  <div className="flex-1 border-t border-gray-300"></div>
                  <h4 className="text-sm font-semibold text-muted-foreground">Autres messages</h4>
                  <div className="flex-1 border-t border-gray-300"></div>
                </div>
              </>
            )}
            {filteredMessages.filter((m) => !m.pinned).map((message) => (
              <Card key={message.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">
                          {message.author.firstName || message.author.lastName
                            ? `${message.author.firstName || ""} ${message.author.lastName || ""}`.trim()
                            : message.author.email}
                        </CardTitle>
                        {message.author.role === "ADMIN" && (
                          <Badge variant="default">Admin</Badge>
                        )}
                        {message.author.role === "INSTRUCTOR" && (
                          <Badge variant="secondary">Instructeur</Badge>
                        )}
                      </div>
                      <CardDescription>
                        {format(new Date(message.createdAt), "d MMMM yyyy 'at' HH:mm", { locale: fr })}
                        {message.updatedAt.getTime() !== message.createdAt.getTime() && " (modified)"}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePin(message.id, !message.pinned)}
                        title={message.pinned ? "Unpin" : "Pin"}
                      >
                        <Pin className={`h-4 w-4 ${message.pinned ? "fill-current" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(message)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(message.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: message.content }}
                  />
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Pièces jointes:</p>
                      <div className="flex flex-wrap gap-2">
                        {message.attachments.map((url, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              Fichier {index + 1}
                            </a>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le message</DialogTitle>
            <DialogDescription>
              Modifiez le contenu du message. Les modifications seront visibles par tous les membres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Contenu</label>
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Edit your message..."
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Pièces jointes (max 32MB par fichier)</label>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Add files"}
                </Button>
              </div>
              {attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachments.map((url, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                      <Paperclip className="h-3 w-3" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex-1"
                      >
                        {attachmentNames[index] || `Fichier ${index + 1}`}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleEdit}>Enregistrer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

