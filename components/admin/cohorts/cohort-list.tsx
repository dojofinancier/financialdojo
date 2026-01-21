"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getCohortsAction, deleteCohortAction } from "@/app/actions/cohorts";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, Edit, Trash2, Users, Calendar } from "lucide-react";

type CohortWithCounts = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  maxStudents: number;
  enrollmentClosingDate: Date;
  published: boolean;
  instructor: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    enrollments: number;
  };
};

export function CohortList() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<CohortWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [publishedFilter, setPublishedFilter] = useState<string>("all");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cohortToDelete, setCohortToDelete] = useState<string | null>(null);

  const loadCohorts = useCallback(async (cursor?: string | null, reset = false) => {
    try {
      setLoading(true);
      const result = await getCohortsAction({
        cursor: cursor || undefined,
        limit: 20,
        published: publishedFilter !== "all" ? publishedFilter === "true" : undefined,
      });

      if (reset) {
        setCohorts(result.items as CohortWithCounts[]);
      } else {
        setCohorts((prev) => [...prev, ...(result.items as CohortWithCounts[])]);
      }

      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error("Error loading cohorts");
    } finally {
      setLoading(false);
    }
  }, [publishedFilter]);

  useEffect(() => {
    loadCohorts(undefined, true);
  }, [publishedFilter]);

  const handleLoadMore = () => {
    if (hasMore && !loading && nextCursor) {
      loadCohorts(nextCursor, false);
    }
  };

  const handleDelete = async () => {
    if (!cohortToDelete) return;

    try {
      const result = await deleteCohortAction(cohortToDelete);
      if (result.success) {
        toast.success("Cohort deleted successfully");
        setCohorts((prev) => prev.filter((c) => c.id !== cohortToDelete));
        setDeleteDialogOpen(false);
        setCohortToDelete(null);
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      toast.error("Error while deleting the cohort");
    }
  };

  const filteredCohorts = cohorts.filter((cohort) => {
    const matchesSearch = cohort.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("fr-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a cohort..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={publishedFilter} onValueChange={setPublishedFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="true">Publiées</SelectItem>
              <SelectItem value="false">Non publiées</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            params.set("tab", "create");
            router.replace(`/dashboard/admin/cohorts?${params.toString()}`);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Créer une cohorte
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Instructeur</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Étudiants</TableHead>
              <TableHead>Date limite</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && cohorts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Chargement...
                </TableCell>
              </TableRow>
            ) : filteredCohorts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Aucune cohorte trouvée
                </TableCell>
              </TableRow>
            ) : (
              filteredCohorts.map((cohort) => (
                <TableRow key={cohort.id}>
                  <TableCell className="font-medium">{cohort.title}</TableCell>
                  <TableCell>
                    {cohort.instructor
                      ? `${cohort.instructor.firstName || ""} ${cohort.instructor.lastName || ""}`.trim() ||
                        cohort.instructor.email
                      : "Unassigned"}
                  </TableCell>
                  <TableCell>{Number(cohort.price).toFixed(2)} $</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {cohort._count.enrollments} / {cohort.maxStudents}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(cohort.enrollmentClosingDate)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cohort.published ? "default" : "secondary"}>
                      {cohort.published ? "Published" : "Unpublished"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/dashboard/admin/cohorts/${cohort.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setCohortToDelete(cohort.id);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
            {loading ? "Chargement..." : "Charger plus"}
          </Button>
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la cohorte</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette cohorte ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

