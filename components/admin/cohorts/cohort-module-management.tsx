"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCohortAction,
  addModuleToCohortAction,
  removeModuleFromCohortAction,
  reorderCohortModulesAction,
} from "@/app/actions/cohorts";
import { getCoursesAction } from "@/app/actions/courses";
import { getModulesAction } from "@/app/actions/modules";
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Trash2,
  BookOpen,
  Layers,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ModuleWithCourse = {
  id: string;
  title: string;
  description: string | null;
  courseId: string;
  order: number;
  course: {
    id: string;
    title: string;
  };
};

type CohortModule = {
  id: string;
  cohortId: string;
  moduleId: string;
  order: number;
  module: ModuleWithCourse;
};

interface CohortModuleManagementProps {
  cohortId: string;
}

function SortableModuleItem({
  module,
  onRemove,
}: {
  module: CohortModule;
  onRemove: (moduleId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: module.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-4 border rounded-lg bg-card">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{module.module.title}</h4>
          <Badge variant="outline" className="text-xs">
            {module.module.course.title}
          </Badge>
        </div>
        {module.module.description && (
          <p className="text-sm text-muted-foreground mt-1">{module.module.description}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(module.moduleId)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function CohortModuleManagement({ cohortId }: CohortModuleManagementProps) {
  const [cohortModules, setCohortModules] = useState<CohortModule[]>([]);
  const [allCourses, setAllCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [availableModules, setAvailableModules] = useState<ModuleWithCourse[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadCohortModules = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getCohortAction(cohortId);
      if (result.success && result.data) {
        const modules = (result.data.cohortModules || []) as CohortModule[];
        setCohortModules(modules.sort((a, b) => a.order - b.order));
      }
    } catch (error) {
      toast.error("Error loading modules");
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  const loadCourses = useCallback(async () => {
    try {
      const result = await getCoursesAction({ limit: 1000 });
      setAllCourses(result.items.map((course: any) => ({ id: course.id, title: course.title })));
    } catch (error) {
      toast.error("Error loading courses");
    }
  }, []);

  const loadModulesForCourse = useCallback(async (courseId: string) => {
    try {
      const modules = await getModulesAction(courseId);
      const course = allCourses.find((c) => c.id === courseId);
      const modulesWithCourse = (modules as any[]).map((module: any) => ({
        id: module.id,
        title: module.title,
        description: module.description,
        courseId: module.courseId,
        order: module.order,
        course: course || { id: courseId, title: "Unknown course" },
      })) as ModuleWithCourse[];
      setAvailableModules(modulesWithCourse);
    } catch (error) {
      toast.error("Error loading modules");
      setAvailableModules([]);
    }
  }, [allCourses]);

  useEffect(() => {
    loadCohortModules();
    loadCourses();
  }, [loadCohortModules, loadCourses]);

  useEffect(() => {
    if (selectedCourseId) {
      loadModulesForCourse(selectedCourseId);
    } else {
      setAvailableModules([]);
      setSelectedModuleId("");
    }
  }, [selectedCourseId, loadModulesForCourse]);

  const handleAddModule = async () => {
    if (!selectedModuleId) {
      toast.error("Please select a module");
      return;
    }

    // Check if module is already in cohort
    if (cohortModules.some((cm) => cm.moduleId === selectedModuleId)) {
      toast.error("This module is already in the cohort");
      return;
    }

    try {
      const result = await addModuleToCohortAction(cohortId, selectedModuleId);
      if (result.success) {
        toast.success("Module added successfully");
        setAddDialogOpen(false);
        setSelectedCourseId("");
        setSelectedModuleId("");
        loadCohortModules();
      } else {
        toast.error(result.error || "Error adding module");
      }
    } catch (error) {
      toast.error("Error adding module");
    }
  };

  const handleRemoveModule = async (moduleId: string) => {
    try {
      const result = await removeModuleFromCohortAction(cohortId, moduleId);
      if (result.success) {
        toast.success("Module removed successfully");
        loadCohortModules();
      } else {
        toast.error(result.error || "Error deleting module");
      }
    } catch (error) {
      toast.error("Error deleting module");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = cohortModules.findIndex((m) => m.id === active.id);
    const newIndex = cohortModules.findIndex((m) => m.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newModules = arrayMove(cohortModules, oldIndex, newIndex);
    setCohortModules(newModules);

    // Update order in database
    const moduleOrders = newModules.map((module, index) => ({
      moduleId: module.moduleId,
      order: index,
    }));

    try {
      const result = await reorderCohortModulesAction(cohortId, moduleOrders);
      if (!result.success) {
        toast.error(result.error || "Error reordering");
        loadCohortModules(); // Reload on error
      }
    } catch (error) {
      toast.error("Error reordering");
      loadCohortModules(); // Reload on error
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cohort modules</h3>
          <p className="text-sm text-muted-foreground">
            Add existing modules from your courses to this cohort
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add a module
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a module to the cohort</DialogTitle>
              <DialogDescription>
                Select a course and then a module to add to this cohort
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Course</label>
                <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCourses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCourseId && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Module</label>
                  <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a module" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModules
                        .filter(
                          (module) => !cohortModules.some((cm) => cm.moduleId === module.id)
                        )
                        .map((module) => (
                          <SelectItem key={module.id} value={module.id}>
                            {module.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddModule} disabled={!selectedModuleId}>
                  Add
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : cohortModules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No modules in this cohort</p>
            <p className="text-sm mt-2">Click "Add a module" to get started</p>
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={cohortModules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {cohortModules.map((module) => (
                <SortableModuleItem key={module.id} module={module} onRemove={handleRemoveModule} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

