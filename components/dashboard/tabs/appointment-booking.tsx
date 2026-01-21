"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { createAppointmentPaymentIntentAction, createMultipleAppointmentsPaymentIntentAction } from "@/app/actions/appointment-payment";
import { getPublishedCoursesAction } from "@/app/actions/courses";
import { toast } from "sonner";
import { Loader2, Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, ShoppingCart, X, DollarSign } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { fr } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { EASTERN_TIMEZONE } from "@/lib/utils/timezone";
import { AppointmentPaymentDialog } from "./appointment-payment-dialog";

type Course = {
  id: string;
  title: string;
  appointmentHourlyRate: number | null;
};

type AvailabilitySlot = {
  start: string;
  end: string;
  available: boolean;
  duration: number;
  price: number;
};

type SelectedSlot = {
  start: string;
  end: string;
  duration: number;
  price: number;
};

export function AppointmentBooking() {
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [availabilities, setAvailabilities] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<60 | 90 | 120>(60);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentData, setPaymentData] = useState<{ clientSecret: string; appointmentId: string; amount?: number } | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  // Load month availability when course, month, or duration changes
  useEffect(() => {
    if (selectedCourse) {
      loadMonthAvailability();
      // Clear loaded slots for the selected date when switching course/month/duration
      setAvailabilities([]);
      setSelectedDate(null);
    } else {
      setAvailabilities([]);
      setAvailabilityMap({});
      setSelectedDate(null);
    }
  }, [selectedCourse, currentMonth, selectedDuration]);

  // Only clear selected slots when course or duration changes (not when navigating months)
  useEffect(() => {
    if (!selectedCourse) {
      setSelectedSlots([]);
    }
  }, [selectedCourse, selectedDuration]);

  useEffect(() => {
    if (selectedDate && selectedCourse) {
      loadAvailabilitiesForDate(selectedDate);
    }
  }, [selectedDate, selectedDuration, selectedCourse]);

  const loadCourses = async () => {
    try {
      const result = await getPublishedCoursesAction({});
      const coursesWithRates = result.items
        .filter((course: any) => {
          const rate = course.appointmentHourlyRate;
          return rate && (typeof rate === "number" ? rate > 0 : rate.toNumber() > 0);
        })
        .map((course: any) => ({
          id: course.id,
          title: course.title,
          appointmentHourlyRate:
            typeof course.appointmentHourlyRate === "number"
              ? course.appointmentHourlyRate
              : course.appointmentHourlyRate?.toNumber() || null,
        }));
      setCourses(coursesWithRates);
    } catch (error) {
      toast.error("Error loading courses");
    }
  };

  const loadMonthAvailability = async () => {
    try {
      setLoading(true);

      // Get calendar days for the month
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const calendarStart = startOfMonth(monthStart);
      const calendarEnd = endOfMonth(monthEnd);
      const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

      // Format dates for API
      const dates = calendarDays.map((date) =>
        formatInTimeZone(date, EASTERN_TIMEZONE, "yyyy-MM-dd")
      );

      // Get availability map for calendar dots
      const response = await fetch("/api/course-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: selectedCourse,
          dates,
          duration: selectedDuration,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAvailabilityMap(data.availabilityMap || {});
      }
    } catch (error) {
      console.error("Error loading month availability:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailabilitiesForDate = async (date: Date) => {
    try {
      setLoading(true);
      const dateStr = formatInTimeZone(date, EASTERN_TIMEZONE, "yyyy-MM-dd");

      const response = await fetch(
        `/api/course-availability?courseId=${selectedCourse}&date=${dateStr}&duration=${selectedDuration}`
      );

      if (response.ok) {
        const data = await response.json();
        setAvailabilities(
          data.slots.map((slot: any) => ({
            start: slot.start,
            end: slot.end,
            available: slot.available,
            duration: slot.duration,
            price: slot.price,
          }))
        );
      } else {
        setAvailabilities([]);
      }
    } catch (error) {
      toast.error("Error loading availabilities");
      setAvailabilities([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if two time slots overlap
  const slotsOverlap = (slot1: SelectedSlot, slot2: SelectedSlot): boolean => {
    const start1 = new Date(slot1.start).getTime();
    const end1 = new Date(slot1.end).getTime();
    const start2 = new Date(slot2.start).getTime();
    const end2 = new Date(slot2.end).getTime();
    return start1 < end2 && start2 < end1;
  };

  const handleSlotSelect = (slot: AvailabilitySlot) => {
    if (!selectedCourse) {
      toast.error("Please select a course");
      return;
    }

    const course = courses.find((c) => c.id === selectedCourse);
    if (!course || !course.appointmentHourlyRate) {
      toast.error("This course has no price configured");
      return;
    }

    // Check if this slot is already selected
    const isAlreadySelected = selectedSlots.some((selected) => {
      return selected.start === slot.start && selected.end === slot.end;
    });

    if (isAlreadySelected) {
      // Remove from selection
      setSelectedSlots(selectedSlots.filter((s) => s.start !== slot.start || s.end !== slot.end));
      return;
    }

    // Check if this slot overlaps with any already selected slot
    const newSlot: SelectedSlot = {
      start: slot.start,
      end: slot.end,
      duration: slot.duration,
      price: slot.price,
    };

    const hasOverlap = selectedSlots.some((selected) => slotsOverlap(newSlot, selected));

    if (hasOverlap) {
      toast.error("You cannot select overlapping time slots");
      return;
    }

    // Add the slot to selected sessions
    setSelectedSlots([...selectedSlots, newSlot]);
  };

  const removeSlot = (index: number) => {
    setSelectedSlots(selectedSlots.filter((_, i) => i !== index));
  };

  const isSlotSelected = (slot: AvailabilitySlot) => {
    return selectedSlots.some((selected) => selected.start === slot.start && selected.end === slot.end);
  };

  const handleProceedToPayment = async () => {
    if (selectedSlots.length === 0) {
      toast.error("Please select at least one time slot");
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Process all selected slots
      const result = await createMultipleAppointmentsPaymentIntentAction({
        courseId: selectedCourse,
        slots: selectedSlots.map((slot) => ({
          scheduledAt: new Date(slot.start).toISOString(),
          durationMinutes: slot.duration,
        })),
      });

      if (result.success && result.data) {
        setPaymentData(result.data);
        setShowPaymentDialog(true);
      } else {
        toast.error(result.error || "Error creating payment");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsProcessingPayment(false);
    }
  };


  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "HH:mm", { locale: fr });
  };

  const calculatePrice = (hourlyRate: number, durationMinutes: number) => {
    return ((hourlyRate * durationMinutes) / 60).toFixed(2);
  };

  const handleDateSelect = (day: Date) => {
    const isPastDate = isPast(day) && !isToday(day);
    if (!isPastDate) {
      setSelectedDate(day);
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      if (direction === "next") {
        return addMonths(prev, 1);
      } else {
        return subMonths(prev, 1);
      }
    });
  };

  // Get calendar days for the month (including previous/next month days for full weeks)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Réserver un rendez-vous</h2>
        <p className="text-muted-foreground">
          Sélectionnez un cours et choisissez un créneau disponible
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paramètres de réservation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="course">Cours</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title} ({course.appointmentHourlyRate}$/h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Durée</Label>
              <Select
                value={selectedDuration.toString()}
                onValueChange={(val) => setSelectedDuration(parseInt(val) as 60 | 90 | 120)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="60">60 minutes</SelectItem>
                  <SelectItem value="90">90 minutes</SelectItem>
                  <SelectItem value="120">120 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCourse && (
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm">
                <strong>Tarif:</strong>{" "}
                {(() => {
                  const course = courses.find((c) => c.id === selectedCourse);
                  if (!course || !course.appointmentHourlyRate) return "N/A";
                  return `${calculatePrice(course.appointmentHourlyRate, selectedDuration)}$ CAD`;
                })()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side - Monthly Calendar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  {format(currentMonth, "MMMM yyyy", { locale: fr })}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth("prev")}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth("next")}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Day headers - Monday to Sunday */}
                {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}

                {/* Date cells */}
                {calendarDays.map((date) => {
                  const isTodayDate = isToday(date);
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  const isPastDate = isPast(date) && !isTodayDate;
                  const dateStr = formatInTimeZone(date, EASTERN_TIMEZONE, "yyyy-MM-dd");
                  const hasSlots = availabilityMap[dateStr] || false;
                  const isAvailable = hasSlots && !isPastDate && isCurrentMonth;

                  return (
                    <Button
                      key={date.toISOString()}
                      variant={isSelected ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-10 w-10 p-0 relative",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isPastDate && "opacity-50 cursor-not-allowed",
                        isTodayDate && !isSelected && "ring-2 ring-primary ring-offset-1",
                        isAvailable && !isSelected && "bg-green-50 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900"
                      )}
                      onClick={() => !isPastDate && isCurrentMonth && handleDateSelect(date)}
                      disabled={isPastDate || !isCurrentMonth}
                    >
                      <span className="text-sm font-medium">{format(date, "d")}</span>
                      {/* Green dot indicator for available dates */}
                      {isAvailable && (
                        <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full" />
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span>Disponible</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Side - Time Slots */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {selectedDate
                  ? format(selectedDate, "EEEE d MMMM yyyy", { locale: fr })
                  : "Select a date"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <div className="text-center py-12">
                  <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Sélectionnez une date dans le calendrier pour voir les créneaux disponibles
                  </p>
                </div>
              ) : loading ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : availabilities.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Aucun créneau disponible pour cette date</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {availabilities.map((slot, index) => {
                    const isSelected = isSlotSelected(slot);
                    return (
                      <Button
                        key={index}
                        variant={isSelected ? "default" : "outline"}
                        className="w-full h-12 flex items-center justify-center"
                        onClick={() => handleSlotSelect(slot)}
                      >
                        <span className="text-sm font-medium">
                          {formatTime(slot.start)} - {formatTime(slot.end)}
                        </span>
                        {isSelected && (
                          <span className="ml-2 text-xs">✓</span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Selected Sessions Summary */}
      {selectedSlots.length > 0 && (
        <Card className="sticky top-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Créneaux sélectionnés ({selectedSlots.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Sessions List */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {selectedSlots.map((slot, index) => {
                const course = courses.find((c) => c.id === selectedCourse);
                const price = slot.price || (course?.appointmentHourlyRate
                  ? calculatePrice(course.appointmentHourlyRate, slot.duration)
                  : "0");

                return (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">
                        {format(new Date(slot.start), "EEEE d MMMM yyyy", { locale: fr })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatTime(slot.start)} - {formatTime(slot.end)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {slot.duration === 60 ? "1h" : slot.duration === 90 ? "1h30" : "2h"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{price}$ CAD</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSlot(index)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Price */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Total</span>
              </div>
              <span className="text-xl font-bold">
                {(() => {
                  const course = courses.find((c) => c.id === selectedCourse);
                  if (!course || !course.appointmentHourlyRate) return "0$ CAD";
                  const total = selectedSlots.reduce((sum, slot) => {
                    const price = slot.price ?? parseFloat(calculatePrice(course.appointmentHourlyRate!, slot.duration));
                    return sum + price;
                  }, 0);
                  return `${total.toFixed(2)}$ CAD`;
                })()}
              </span>
            </div>

            {/* Proceed to Payment Button */}
            <Button
              onClick={handleProceedToPayment}
              className="w-full"
              size="lg"
              disabled={isProcessingPayment || selectedSlots.length === 0}
            >
              {isProcessingPayment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Procéder au paiement ({selectedSlots.length} créneau{selectedSlots.length > 1 ? "x" : ""})
                </>
              )}
            </Button>

            {/* Info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Vous pouvez ajouter plus de créneaux en continuant la sélection</p>
              <p>• Annulation gratuite jusqu&apos;à 2h avant chaque rendez-vous</p>
              <p>• Paiement sécurisé avec Stripe</p>
            </div>
          </CardContent>
        </Card>
      )}

      {showPaymentDialog && paymentData && (
        <AppointmentPaymentDialog
          open={showPaymentDialog}
          onOpenChange={(open) => {
            setShowPaymentDialog(open);
            if (!open) {
              // Clear selected slots after payment dialog closes
              setSelectedSlots([]);
              setSelectedDate(null);
            }
          }}
          clientSecret={paymentData.clientSecret}
          appointmentId={paymentData.appointmentId}
          amount={paymentData.amount}
        />
      )}
    </div>
  );
}
