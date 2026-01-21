"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  saveAvailabilityRulesAction,
  saveAvailabilityExceptionsAction,
  getAvailabilityRulesAction,
  getAvailabilityExceptionsAction,
} from "@/app/actions/availability-rules";
import { getCoursesAction } from "@/app/actions/courses";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Calendar, Clock, Copy } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { WEEKDAYS } from "@/lib/constants/weekdays";

// Generate 30-minute time slots in 24-hour format
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
});

type Course = {
  id: string;
  title: string;
};

type AvailabilityRule = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  courseId: string | null;
};

type AvailabilityException = {
  id: string;
  startDate: string;
  endDate: string;
  isUnavailable: boolean;
  courseId: string | null;
};

// Custom Time Selector Component
interface TimeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function TimeSelector({ value, onChange, className }: TimeSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ""}`}
    >
      {TIME_SLOTS.map((time) => (
        <option key={time} value={time}>
          {time}
        </option>
      ))}
    </select>
  );
}

export function AvailabilityManagement() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Course selection (applies to all rules)
  const [selectedCourse, setSelectedCourse] = useState<string>("none");

  // Recurring availability rules
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);

  // Date exceptions
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);

  // Use ref to prevent concurrent saves
  const isSavingRef = useRef(false);

  useEffect(() => {
    loadCourses();
    loadAvailabilityData();
  }, []);

  const loadCourses = async () => {
    try {
      const result = await getCoursesAction({});
      setCourses(result.items);
    } catch (error) {
      toast.error("Error loading courses");
    }
  };

  const loadAvailabilityData = async () => {
    try {
      setLoading(true);
      const [rulesResult, exceptionsResult] = await Promise.all([
        getAvailabilityRulesAction(),
        getAvailabilityExceptionsAction(),
      ]);

      if (rulesResult.success && rulesResult.data) {
        setAvailabilityRules(
          rulesResult.data.map((rule: any) => ({
            id: rule.id,
            weekday: rule.weekday,
            startTime: rule.startTime,
            endTime: rule.endTime,
            courseId: rule.courseId,
          }))
        );
      }

      if (exceptionsResult.success && exceptionsResult.data) {
        setExceptions(
          exceptionsResult.data.map((ex: any) => ({
            id: ex.id,
            startDate: format(new Date(ex.startDate), "yyyy-MM-dd"),
            endDate: format(new Date(ex.endDate), "yyyy-MM-dd"),
            isUnavailable: ex.isUnavailable,
            courseId: ex.courseId,
          }))
        );
      }
    } catch (error) {
      toast.error("Error loading availabilities");
    } finally {
      setLoading(false);
    }
  };

  const addTimeSlot = (weekday: number) => {
    const newRule: AvailabilityRule = {
      id: `temp-${Date.now()}`,
      weekday,
      startTime: "09:00",
      endTime: "17:00",
      courseId: selectedCourse === "none" ? null : selectedCourse,
    };
    setAvailabilityRules((prev) => [...prev, newRule]);
  };

  const removeTimeSlot = (ruleId: string) => {
    setAvailabilityRules((prev) => prev.filter((rule) => rule.id !== ruleId));
  };

  const updateTimeSlot = (ruleId: string, field: "startTime" | "endTime", value: string) => {
    setAvailabilityRules((prev) =>
      prev.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule))
    );
  };

  const copyTimeSlot = (ruleId: string) => {
    const rule = availabilityRules.find((r) => r.id === ruleId);
    if (rule) {
      const newRule: AvailabilityRule = {
        id: `temp-${Date.now()}`,
        weekday: rule.weekday,
        startTime: rule.startTime,
        endTime: rule.endTime,
        courseId: rule.courseId,
      };
      setAvailabilityRules((prev) => [...prev, newRule]);
    }
  };

  const addException = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const newException: AvailabilityException = {
      id: `temp-${Date.now()}`,
      startDate: format(tomorrow, "yyyy-MM-dd"),
      endDate: format(tomorrow, "yyyy-MM-dd"),
      isUnavailable: true,
      courseId: selectedCourse === "none" ? null : selectedCourse,
    };
    setExceptions((prev) => [...prev, newException]);
  };

  const removeException = (exceptionId: string) => {
    setExceptions((prev) => prev.filter((exp) => exp.id !== exceptionId));
  };

  const updateException = (exceptionId: string, field: "startDate" | "endDate", value: string) => {
    setExceptions((prev) =>
      prev.map((exp) => (exp.id === exceptionId ? { ...exp, [field]: value } : exp))
    );
  };

  const getTimeSlotsForDay = (weekday: number) => {
    return availabilityRules.filter((rule) => rule.weekday === weekday);
  };

  const formatTimeSlot = (startTime: string, endTime: string) => {
    return `${startTime} - ${endTime}`;
  };

  const getSummaryText = () => {
    const activeDays = WEEKDAYS.filter((day) =>
      availabilityRules.some((rule) => rule.weekday === day.id)
    );

    if (activeDays.length === 0) {
      return "No availability defined";
    }

    const dayNames = activeDays.map((day) => day.short.toLowerCase()).join(", ");
    const timeSlots = activeDays
      .map((day) => {
        const slots = getTimeSlotsForDay(day.id);
        return slots.map((slot) => formatTimeSlot(slot.startTime, slot.endTime)).join(", ");
      })
      .join(" ");

    return `${dayNames}, ${timeSlots}`;
  };

  // Save availability rules and exceptions
  const saveAvailability = async () => {
    // Prevent multiple simultaneous saves
    if (isSavingRef.current) {
      return;
    }

    try {
      isSavingRef.current = true;
      setSaving(true);
      setError(null);

      // Prepare rules (remove temp IDs and filter by selected course)
      const rulesToSave = availabilityRules
        .filter((rule) => {
          // If a course is selected, only save rules for that course or all courses
          if (selectedCourse !== "none") {
            return rule.courseId === selectedCourse || rule.courseId === null;
          }
          return true;
        })
        .map((rule) => ({
          courseId: selectedCourse === "none" ? null : selectedCourse,
          weekday: rule.weekday,
          startTime: rule.startTime,
          endTime: rule.endTime,
        }));

      // Prepare exceptions (remove temp IDs)
      const exceptionsToSave = exceptions
        .filter((ex) => {
          if (selectedCourse !== "none") {
            return ex.courseId === selectedCourse || ex.courseId === null;
          }
          return true;
        })
        .map((ex) => ({
          courseId: selectedCourse === "none" ? null : selectedCourse,
          startDate: ex.startDate,
          endDate: ex.endDate,
          isUnavailable: ex.isUnavailable,
        }));

      // Save rules and exceptions
      const [rulesResult, exceptionsResult] = await Promise.all([
        saveAvailabilityRulesAction(rulesToSave),
        saveAvailabilityExceptionsAction(exceptionsToSave),
      ]);

      if (!rulesResult.success) {
        setError(rulesResult.error || "Error saving rules");
        return;
      }

      if (!exceptionsResult.success) {
        setError(exceptionsResult.error || "Error saving exceptions");
        return;
      }

      toast.success("Availabilities saved successfully");
      await loadAvailabilityData();
    } catch (err) {
      setError("Error saving availabilities");
      console.error("Error saving availability:", err);
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Gestion des disponibilités</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Définissez vos heures de disponibilité récurrentes et vos exceptions
          </p>
        </div>
        <Button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isSavingRef.current && !saving) {
              saveAvailability();
            }
          }}
          disabled={saving || isSavingRef.current}
          className="w-full sm:w-auto"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            "Sauvegarder"
          )}
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* Course Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Cours (optionnel)</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Sélectionnez un cours spécifique ou laissez "All courses" pour une disponibilité générale
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedCourse} onValueChange={(value) => setSelectedCourse(value === "none" ? "none" : value)}>
            <SelectTrigger className="w-full sm:w-[400px]">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tous les cours</SelectItem>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Weekly Availability Template */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                Disponibilités récurrentes
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Définissez vos heures de disponibilité pour chaque jour de la semaine
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs sm:text-sm w-full sm:w-auto">
              {getSummaryText()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {WEEKDAYS.map((day) => {
            const daySlots = getTimeSlotsForDay(day.id);
            const isEnabled = daySlots.length > 0;

            return (
              <div key={day.id} className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          addTimeSlot(day.id);
                        } else {
                          setAvailabilityRules((prev) =>
                            prev.filter((rule) => rule.weekday !== day.id)
                          );
                        }
                      }}
                    />
                    <Label className="text-sm sm:text-base font-medium">{day.name}</Label>
                  </div>
                  {isEnabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => addTimeSlot(day.id)}
                      className="w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter
                    </Button>
                  )}
                </div>

                {isEnabled && (
                  <div className="ml-0 sm:ml-8 space-y-2">
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <TimeSelector
                              value={slot.startTime}
                              onChange={(value) => updateTimeSlot(slot.id, "startTime", value)}
                              className="flex-1 min-w-0"
                            />
                            <span className="text-muted-foreground flex-shrink-0">-</span>
                            <TimeSelector
                              value={slot.endTime}
                              onChange={(value) => updateTimeSlot(slot.id, "endTime", value)}
                              className="flex-1 min-w-0"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-1 sm:flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyTimeSlot(slot.id)}
                            className="flex-1 sm:flex-initial"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTimeSlot(slot.id)}
                            className="flex-1 sm:flex-initial"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Separator />

      {/* Exceptions Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
                Exceptions de dates
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Ajoutez les dates où vos disponibilités changent de vos heures quotidiennes
              </CardDescription>
            </div>
            <Button variant="outline" onClick={addException} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une exception
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {exceptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucune exception définie
            </div>
          ) : (
            <div className="space-y-3">
              {exceptions.map((exception) => (
                <div
                  key={exception.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 min-w-0">
                    <Badge
                      variant={exception.isUnavailable ? "destructive" : "default"}
                      className="w-full sm:w-auto justify-center sm:justify-start"
                    >
                      {exception.isUnavailable ? "Indisponible" : "Disponible"}
                    </Badge>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Input
                        type="date"
                        value={exception.startDate}
                        onChange={(e) => updateException(exception.id, "startDate", e.target.value)}
                        className="w-full sm:w-40"
                      />
                      {exception.startDate !== exception.endDate && (
                        <>
                          <span className="text-muted-foreground flex-shrink-0">-</span>
                          <Input
                            type="date"
                            value={exception.endDate}
                            onChange={(e) => updateException(exception.id, "endDate", e.target.value)}
                            className="w-full sm:w-40"
                          />
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeException(exception.id)}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
