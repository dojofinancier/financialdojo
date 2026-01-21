import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/slots/generator";
import { addDays, set } from "date-fns";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import { EASTERN_TIMEZONE } from "@/lib/utils/timezone";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");
    const date = searchParams.get("date"); // YYYY-MM-DD format
    const duration = parseInt(searchParams.get("duration") || "60");

    if (!courseId || !date) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Parse the date - interpret as Eastern Time, convert to UTC
    const [year, month, day] = date.split("-").map(Number);
    const referenceDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    const easternDate = toZonedTime(referenceDate, EASTERN_TIMEZONE);
    const midnightEastern = set(easternDate, {
      hours: 0,
      minutes: 0,
      seconds: 0,
      milliseconds: 0,
    });
    const targetDate = fromZonedTime(midnightEastern, EASTERN_TIMEZONE);
    const fromDate = targetDate;
    const toDate = addDays(targetDate, 1);

    // Get available slots
    const availableSlots = await getAvailableSlots(courseId, fromDate, toDate);

    // Transform slots to match component expectations
    const transformedSlots = availableSlots.flatMap((slot) => {
      // Find the duration option that matches our requested duration
      const durationOption = slot.availableDurations.find((d) => d.minutes === duration);
      if (!durationOption) return [];

      // Create a slot for this specific duration
      const endTime = new Date(slot.startDatetime.getTime() + duration * 60000);

      return [
        {
          start: slot.startDatetime,
          end: endTime,
          available: true,
          duration: duration,
          price: durationOption.price,
        },
      ];
    });

    // Filter slots for the specific date
    const filteredSlots = transformedSlots.filter((slot) => {
      const slotDate = formatInTimeZone(slot.start, EASTERN_TIMEZONE, "yyyy-MM-dd");
      return slotDate === date;
    });

    // Check if the date has any availability (for calendar dots)
    const hasAvailability = filteredSlots.length > 0;

    const response = {
      hasAvailability,
      slots: filteredSlots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        available: true,
        duration: slot.duration,
        price: slot.price,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error in course availability API:", error);
    return NextResponse.json(
      {
        error: "An error occurred",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// New endpoint to check availability for multiple dates (for calendar dots)
export async function POST(request: NextRequest) {
  try {
    const { courseId, dates, duration } = await request.json();

    if (!courseId || !dates || !Array.isArray(dates)) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    // Get date range
    const dateObjects = dates.map((d: string) => {
      const [year, month, day] = d.split("-").map(Number);
      const referenceDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      const easternDate = toZonedTime(referenceDate, EASTERN_TIMEZONE);
      const midnightEastern = set(easternDate, {
        hours: 0,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      });
      return fromZonedTime(midnightEastern, EASTERN_TIMEZONE);
    });

    const startDate = new Date(Math.min(...dateObjects.map((d) => d.getTime())));
    const endDate = new Date(Math.max(...dateObjects.map((d) => d.getTime())));
    endDate.setDate(endDate.getDate() + 1); // Add one day to include the last date

    // Get available slots for the entire range
    const availableSlots = await getAvailableSlots(courseId, startDate, endDate);

    // Transform slots to match component expectations
    const transformedSlots = availableSlots.flatMap((slot) => {
      const durationOption = slot.availableDurations.find((d) => d.minutes === duration);
      if (!durationOption) return [];

      const endTime = new Date(slot.startDatetime.getTime() + duration * 60000);

      return [
        {
          start: slot.startDatetime,
          end: endTime,
          available: true,
          duration: duration,
          price: durationOption.price,
        },
      ];
    });

    // Create a map of date -> has availability
    const availabilityMap: Record<string, boolean> = {};

    dates.forEach((dateStr: string) => {
      const hasSlots = transformedSlots.some((slot) => {
        const slotDate = formatInTimeZone(slot.start, EASTERN_TIMEZONE, "yyyy-MM-dd");
        return slotDate === dateStr;
      });
      availabilityMap[dateStr] = hasSlots;
    });

    return NextResponse.json({ availabilityMap });
  } catch (error) {
    console.error("Error checking multiple dates availability:", error);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}




