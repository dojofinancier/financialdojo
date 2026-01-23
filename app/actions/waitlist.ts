"use server";

import { z } from "zod";
import { logServerError } from "@/lib/utils/error-logging";

const waitlistSchema = z.object({
  email: z.string().email("Invalid email"),
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  type: z.enum(["investisseur", "entrepreneur"]),
});

export type WaitlistSubmission = z.infer<typeof waitlistSchema>;

export async function submitWaitlistAction(data: WaitlistSubmission) {
  try {
    const parsed = waitlistSchema.parse(data);

    // Get the appropriate Make.com webhook URL from environment variables
    const webhookUrl =
      parsed.type === "investisseur"
        ? process.env.MAKE_WEBHOOK_INVESTISSEUR
        : process.env.MAKE_WEBHOOK_ENTREPRENEUR;

    if (!webhookUrl) {
      console.error(`Make.com webhook URL not configured for type: ${parsed.type}`);
      await logServerError({
        errorMessage: `Make.com webhook URL not configured for type: ${parsed.type}`,
        severity: "MEDIUM",
      });
      return {
        success: false,
        error: "Configuration error. Please contact support.",
      };
    }

    // Submit to Make.com webhook
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: parsed.email,
        firstName: parsed.firstName || "",
        lastName: parsed.lastName || "",
        type: parsed.type,
        submittedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`Make.com webhook error: ${response.status} - ${errorText}`);
      await logServerError({
        errorMessage: `Make.com webhook error: ${response.status} - ${errorText}`,
        severity: "MEDIUM",
      });
      return {
        success: false,
        error: "Error sending. Please try again.",
      };
    }

    return {
      success: true,
      message: "Thank you! You have been added to the waiting list.",
    };
  } catch (error) {
    console.error("Waitlist submission error:", error);
    await logServerError({
      errorMessage: `Waitlist submission error: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    return {
      success: false,
      error: "An error occurred. Please try again.",
    };
  }
}
