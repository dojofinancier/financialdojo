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
} from "@/components/ui/dialog";
import { getCoursesAction, deleteCourseAction, getCourseCategoriesAction } from "@/app/actions/courses";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, Edit, Trash2, Download, Eye } from "lucide-react";
import type { Course, CourseCategory } from "@prisma/client";

type CourseWithCounts = Omit<Course, "price" | "appointmentHourlyRate"> & {
  // Server actions serialize Prisma Decimals for client usage
  price: number;
  appointmentHourlyRate: number | null;
  category: CourseCategory;
  _count: {
    enrollments: number;
    modules: number;
  };
};

export function CourseList() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseWithCounts[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [publishedFilter, setPublishedFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"title" | "createdAt" | "price">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<string | null>(null);

  const loadCourses = useCallback(async (cursor?: string | null, reset = false) => {
    try {
      setLoading(true);
      const result = await getCoursesAction({
        cursor: cursor || undefined,
        limit: 20,
        categoryId: categoryFilter !== "all" ? categoryFilter : undefined,
        published: publishedFilter !== "all" ? publishedFilter === "true" : undefined,
      });

      if (reset) {
        setCourses(result.items as CourseWithCounts[]);
      } else {
        setCourses((prev) => [...prev, ...(result.items as CourseWithCounts[])]);
      }

      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (error) {
      toast.error("Error loading courses");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, publishedFilter]);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await getCourseCategoriesAction();
      setCategories(cats);
    } catch (error) {
      toast.error("Error loading categories");
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadCourses(undefined, true);
  }, [loadCourses, sortBy, sortOrder]);

  const handleLoadMore = () => {
    if (hasMore && !loading && nextCursor) {
      loadCourses(nextCursor, false);
    }
  };

  const handleDelete = async () => {
    if (!courseToDelete) return;

    try {
      const result = await deleteCourseAction(courseToDelete);
      if (result.success) {
        toast.success("Course deleted successfully");
        setCourses((prev) => prev.filter((c) => c.id !== courseToDelete));
        setDeleteDialogOpen(false);
        setCourseToDelete(null);
      } else {
        toast.error(result.error || "Error while deleting");
      }
    } catch (error) {
      toast.error("Error deleting the course");
    }
  };

  const handleExport = () => {
    const filteredCourses = courses.filter((course) => {
      const matchesSearch =
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.category.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });

    const sortedCourses = [...filteredCourses].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "title") {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "price") {
        comparison = Number(a.price) - Number(b.price);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    const csv = [
      ["Titre", "Category", "Prix", "Payment type", "Published", "Students", "Modules", "Creation date"].join(","),
      ...sortedCourses.map((course) =>
        [
          `"${course.title}"`,
          `"${course.category.name}"`,
          Number(course.price).toFixed(2),
          course.paymentType === "ONE_TIME" ? "One-time payment" : "Abonnement",
          course.published ? "Oui" : "Non",
          course._count.enrollments,
          course._count.modules,
          new Date(course.createdAt).toLocaleDateString("fr-CA"),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `cours_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.category.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const sortedCourses = [...filteredCourses].sort((a, b) => {
    let comparison = 0;
    if (sortBy === "title") {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy === "createdAt") {
      comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortBy === "price") {
      comparison = Number(a.price) - Number(b.price);
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={publishedFilter} onValueChange={setPublishedFilter}>
            <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="true">Published</SelectItem>
              <SelectItem value="false">Unpublished</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => router.push("/dashboard/admin/courses?tab=create")} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New course
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => {
                    if (sortBy === "title") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("title");
                      setSortOrder("asc");
                    }
                  }}
                  className="flex items-center gap-1 hover:text-primary"
                >
                  Title
                  {sortBy === "title" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
              </TableHead>
              <TableHead>Category</TableHead>
              <TableHead>
                <button
                  onClick={() => {
                    if (sortBy === "price") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("price");
                      setSortOrder("asc");
                    }
                  }}
                  className="flex items-center gap-1 hover:text-primary"
                >
                  Price
                  {sortBy === "price" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Students</TableHead>
              <TableHead>Modules</TableHead>
              <TableHead>
                <button
                  onClick={() => {
                    if (sortBy === "createdAt") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("createdAt");
                      setSortOrder("desc");
                    }
                  }}
                  className="flex items-center gap-1 hover:text-primary"
                >
                  Date
                  {sortBy === "createdAt" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : sortedCourses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No courses found
                </TableCell>
              </TableRow>
            ) : (
              sortedCourses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium">{course.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{course.category.name}</Badge>
                  </TableCell>
                  <TableCell>{Number(course.price).toFixed(2)} $</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {course.paymentType === "ONE_TIME" ? "One-time" : "Subscription"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={course.published ? "default" : "secondary"}>
                      {course.published ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>{course._count.enrollments}</TableCell>
                  <TableCell>{course._count.modules}</TableCell>
                  <TableCell>
                    {new Date(course.createdAt).toLocaleDateString("fr-CA")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/dashboard/admin/courses/${course.id}/preview`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View (student preview)
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/dashboard/admin/courses/${course.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setCourseToDelete(course.id);
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
          <Button
            onClick={handleLoadMore}
            disabled={loading}
            variant="outline"
          >
            {loading ? "Chargement..." : "Charger plus"}
          </Button>
        </div>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer le cours</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this course? This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
