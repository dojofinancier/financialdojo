"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { rescheduleAppointmentAction } from "@/app/actions/appointments";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { EASTERN_TIMEZONE } from "@/lib/utils/timezone";
import { Calendar, Clock, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type Appointment = {
  id: string;
  scheduledAt: Date | string;
  status: string;
  durationMinutes: number;
  course: {
    id: string;
    title: string;
  } | null;
};

interface RescheduleModalProps {
  appointment: Appointment;
  onRescheduled?: () => void;
}

export function RescheduleModal({ appointment, onRescheduled }: RescheduleModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null);
  const [reason, setReason] = useState("");
  const router = useRouter();

  // Calculate duration from appointment
  const selectedDuration = (appointment.durationMinutes === 60 || 
                            appointment.durationMinutes === 90 || 
                            appointment.durationMinutes === 120) 
    ? appointment.durationMinutes as 60 | 90 | 120 
    : 60; // Default to 60 if invalid

  const handleSlotSelect = (slot: { start: string; end: string; duration: number; price: number }) => {
    setSelectedSlot({
      start: slot.start,
      end: slot.end,
    });
  };

  const onSubmit = async () => {
    if (!selectedSlot) {
      toast.error("Please select an available time slot");
      return;
    }

    if (!reason.trim() || reason.trim().length < 10) {
      toast.error("Please explain the reason for the change (minimum 10 characters)");
      return;
    }

    setIsSubmitting(true);

    try {
      const newScheduledAt = new Date(selectedSlot.start);
      const result = await rescheduleAppointmentAction(
        appointment.id,
        newScheduledAt,
        reason
      );

      if (result.success) {
        toast.success("Appointment rescheduled successfully");
        setIsOpen(false);
        setSelectedSlot(null);
        setReason("");
        if (onRescheduled) {
          onRescheduled();
        } else {
          router.refresh();
        }
      } else {
        toast.error(result.error || "Error during rescheduling");
      }
    } catch (error) {
      console.error("Error rescheduling appointment:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const appointmentDate = appointment.scheduledAt instanceof Date 
    ? appointment.scheduledAt 
    : new Date(appointment.scheduledAt);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reprogrammer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reprogrammer le rendez-vous
          </DialogTitle>
          <CardDescription>
            Choisissez une nouvelle date et heure
          </CardDescription>
        </DialogHeader>

        {/* Current Appointment Details */}
        <div className="p-4 bg-muted rounded-lg mb-6">
          <h3 className="font-medium mb-2">
            {appointment.course?.title || "Rendez-vous"}
          </h3>
          <p className="text-sm text-muted-foreground mb-1">
            <strong>Actuel:</strong> {format(appointmentDate, "d MMMM yyyy, HH:mm", { locale: fr })}
          </p>
          <p className="text-sm text-muted-foreground">
            Durée: {appointment.durationMinutes} minutes
          </p>
        </div>

        <div className="space-y-6">
          {/* Calendar Component - Modified AppointmentBooking for rescheduling */}
          <div className="space-y-2">
            <Label>Créneaux disponibles *</Label>
            {appointment.course && (
              <RescheduleBooking
                courseId={appointment.course.id}
                selectedDuration={selectedDuration}
                onSlotSelect={handleSlotSelect}
              />
            )}
            {!selectedSlot && (
              <p className="text-sm text-muted-foreground mt-2">
                Veuillez sélectionner un créneau dans le calendrier
              </p>
            )}
            {selectedSlot && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Créneau sélectionné:
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  {format(new Date(selectedSlot.start), "d MMMM yyyy, HH:mm", { locale: fr })}
                </p>
              </div>
            )}
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Raison du changement *</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Expliquez pourquoi vous reprogrammez ce rendez-vous..."
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 10 caractères requis
            </p>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">Important :</p>
                <ul className="space-y-1 text-xs">
                  <li>• Seuls les créneaux disponibles sont affichés</li>
                  <li>• Même cours et même durée que le rendez-vous original ({appointment.durationMinutes} minutes)</li>
                  <li>• Reprogrammation possible jusqu'à 2h avant le rendez-vous</li>
                  <li>• Pour annuler et demander un remboursement, veuillez créer un ticket de support</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setSelectedSlot(null);
                setReason("");
              }}
              disabled={isSubmitting}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || !selectedSlot || !reason.trim() || reason.trim().length < 10}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reprogrammation...
                </>
              ) : (
                "Confirmer"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Simplified booking component for rescheduling
function RescheduleBooking({
  courseId,
  selectedDuration,
  onSlotSelect,
}: {
  courseId: string;
  selectedDuration: 60 | 90 | 120;
  onSlotSelect: (slot: { start: string; end: string; duration: number; price: number }) => void;
}) {
  const [availabilities, setAvailabilities] = useState<Array<{
    start: string;
    end: string;
    available: boolean;
    duration: number;
    price: number;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string; duration: number; price: number } | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (courseId) {
      loadMonthAvailability();
    }
  }, [courseId, currentMonth, selectedDuration]);

  useEffect(() => {
    if (selectedDate && courseId) {
      loadAvailabilitiesForDate(selectedDate);
    }
  }, [selectedDate, selectedDuration, courseId]);

  const loadMonthAvailability = async () => {
    try {
      setLoading(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const calendarStart = startOfMonth(monthStart);
      const calendarEnd = endOfMonth(monthEnd);
      const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

      const dates = calendarDays.map((date: Date) =>
        formatInTimeZone(date, EASTERN_TIMEZONE, "yyyy-MM-dd")
      );

      const response = await fetch("/api/course-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
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
        `/api/course-availability?courseId=${courseId}&date=${dateStr}&duration=${selectedDuration}`
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
      console.error("Error loading availabilities:", error);
      setAvailabilities([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (slot: typeof availabilities[0]) => {
    if (!slot.available) return;
    
    const newSlot = {
      start: slot.start,
      end: slot.end,
      duration: slot.duration,
      price: slot.price,
    };
    
    setSelectedSlot(newSlot);
    onSlotSelect(newSlot);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-semibold">
            {format(currentMonth, "MMMM yyyy", { locale: fr })}
          </h3>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
              {day}
            </div>
          ))}
          {calendarDays.map((date: Date) => {
            const dateStr = formatInTimeZone(date, EASTERN_TIMEZONE, "yyyy-MM-dd");
            const hasAvailability = availabilityMap[dateStr] === true;
            const isSelected = selectedDate && isSameDay(date, selectedDate);
            const isCurrentDay = isToday(date);
            const isPastDate = isPast(date) && !isCurrentDay;
            const isOtherMonth = !isSameMonth(date, currentMonth);

            return (
              <button
                key={dateStr}
                onClick={() => {
                  if (!isPastDate && !isOtherMonth && hasAvailability) {
                    setSelectedDate(date);
                  }
                }}
                disabled={isPastDate || isOtherMonth || !hasAvailability}
                className={cn(
                  "aspect-square p-2 text-sm rounded-md transition-colors",
                  isOtherMonth && "text-muted-foreground/30",
                  isPastDate && "text-muted-foreground/50 cursor-not-allowed",
                  isCurrentDay && "ring-2 ring-primary",
                  isSelected && "bg-primary text-primary-foreground",
                  !isSelected && !isPastDate && !isOtherMonth && hasAvailability && "hover:bg-accent",
                  !isSelected && !isPastDate && !isOtherMonth && !hasAvailability && "cursor-not-allowed opacity-50"
                )}
              >
                {format(date, "d")}
                {hasAvailability && !isOtherMonth && (
                  <span className="block w-1 h-1 mx-auto mt-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Créneaux disponibles</h3>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
        {selectedDate ? (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {availabilities.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun créneau disponible pour cette date
              </p>
            ) : (
              availabilities
                .filter((slot) => slot.available)
                .map((slot, index) => {
                  const slotStart = new Date(slot.start);
                  const isSelected = selectedSlot?.start === slot.start;
                  return (
                    <button
                      key={index}
                      onClick={() => handleSlotClick(slot)}
                      className={cn(
                        "w-full p-3 text-left border rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-accent border-border"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">
                          {format(slotStart, "HH:mm")} - {format(new Date(slot.end), "HH:mm")}
                        </span>
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Sélectionnez une date dans le calendrier
          </p>
        )}
      </div>
    </div>
  );
}

