"use server";

import { z } from "zod";
import { sendContactFormWebhook } from "@/lib/webhooks/make";
import { logServerError } from "@/lib/utils/error-logging";

const contactFormSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Invalid email"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

export type ContactFormResult = {
  success: boolean;
  error?: string;
};

/**
 * Submit contact form and send webhook to Make.com
 */
export async function submitContactFormAction(
  data: z.infer<typeof contactFormSchema>
): Promise<ContactFormResult> {
  try {
    const validatedData = contactFormSchema.parse(data);

    // Send webhook to Make.com
    await sendContactFormWebhook({
      name: validatedData.name,
      email: validatedData.email,
      subject: validatedData.subject,
      message: validatedData.message,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message || "Invalid data",
      };
    }

    await logServerError({
      errorMessage: `Failed to submit contact form: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });

    return {
      success: false,
      error: "Error sending the message. Please try again.",
    };
  }
}
