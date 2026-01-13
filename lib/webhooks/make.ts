import { prisma } from '@/lib/prisma'

export type MakeEventType =
  | 'payment.success'
  | 'payment.failed'
  | 'appointment.created'
  | 'appointment.payment.confirmed'
  | 'appointment.cancelled'
  | 'appointment.rescheduled'
  | 'appointment.completed'
  | 'message.sent'
  | 'instructor.response'
  | 'cohort.enrollment.created'
  | 'cohort.message.created'
  | 'ticket.created'
  | 'ticket.status_changed'
  | 'ticket.reply_added'
  | 'error.occurred'
  | 'contact.form.submitted'
  | 'investor.diagnostic.completed'
  // Admin operations (optional, for future use)
  | 'course.created'
  | 'course.updated'
  | 'cohort.created'
  | 'cohort.updated'

function getUrlForType(type: MakeEventType): string | undefined {
  switch (type) {
    case 'payment.success':
    case 'payment.failed':
      return process.env.MAKE_WEBHOOK_PAYMENTS_URL
    case 'appointment.created':
    case 'appointment.payment.confirmed':
    case 'appointment.cancelled':
    case 'appointment.rescheduled':
    case 'appointment.completed':
      return process.env.MAKE_WEBHOOK_APPOINTMENTS_URL
    case 'message.sent':
    case 'instructor.response':
      return process.env.MAKE_WEBHOOK_MESSAGES_URL
    case 'cohort.enrollment.created':
      return process.env.MAKE_WEBHOOK_COHORT_ENROLLMENTS_URL || process.env.MAKE_WEBHOOK_PAYMENTS_URL
    case 'cohort.message.created':
      return process.env.MAKE_WEBHOOK_COHORT_MESSAGES_URL || process.env.MAKE_WEBHOOK_MESSAGES_URL
    case 'ticket.created':
    case 'ticket.status_changed':
    case 'ticket.reply_added':
      return process.env.MAKE_WEBHOOK_SUPPORT_TICKETS_URL
    case 'error.occurred':
      return process.env.MAKE_WEBHOOK_ERRORS_URL
    case 'contact.form.submitted':
      return process.env.MAKE_WEBHOOK_CONTACT_URL
    case 'investor.diagnostic.completed':
      return process.env.MAKE_WEBHOOK_INVESTOR_DIAGNOSTIC_URL || process.env.MAKE_WEBHOOK_CONTACT_URL
    // Admin operations (optional)
    case 'course.created':
    case 'course.updated':
    case 'cohort.created':
    case 'cohort.updated':
      return process.env.MAKE_WEBHOOK_ADMIN_URL || process.env.MAKE_WEBHOOK_PAYMENTS_URL
    default:
      // Unknown event types should not trigger webhooks
      return undefined
  }
}

/**
 * Centralized webhook sender with retry logic
 * Sends events TO make.com for automation, notifications, and bookkeeping
 */
export async function sendMakeWebhook(
  type: MakeEventType,
  payload: any,
  attempt = 1
): Promise<void> {
  const url = getUrlForType(type)

  // Validate URL exists and is not empty
  if (!url || url.trim() === '') {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`No webhook URL configured for event type: ${type}`)
    }
    return
  }

  // Validate URL format
  try {
    new URL(url)
  } catch {
    console.error(`Invalid webhook URL for event type ${type}: ${url}`)
    return
  }

  const eventId = `make_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  for (let currentAttempt = attempt; currentAttempt <= 3; currentAttempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({
          type,
          payload,
          event_id: eventId,
          sent_at: new Date().toISOString()
        }),
      })

      if (!response.ok) {
        throw new Error(`Make webhook failed: ${response.status} ${response.statusText}`)
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`Webhook sent successfully: ${type}`)
      }
      return
    } catch (err) {
      // Next.js can reject fetch during prerender completion (especially if work continues after render).
      // If that happens, we just skip silently; webhooks should not run during prerendering anyway.
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage.includes('prerender') || errorMessage.includes('HANGING_PROMISE_REJECTION')) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`Skipping webhook during prerendering for event type: ${type}`)
        }
        return
      }

      if (currentAttempt >= 3) {
        if (process.env.NODE_ENV === 'development') {
          console.error(`Make webhook error after ${currentAttempt} attempts:`, err)
        }
        return
      }
    }
  }
}

/**
 * Send webhook to Make.com for payment success events
 */
export async function sendPaymentSuccessWebhook(data: {
  paymentIntentId: string
  userId: string
  courseId?: string
  courseTitle?: string | null
  cohortId?: string
  cohortTitle?: string | null
  enrollmentId: string
  orderNumber: number | null
  amount: number
  originalAmount: number
  discountAmount: number
  couponCode?: string | null
  type: 'course' | 'cohort'
  userName: string
  userEmail: string
  userPhone?: string | null
  timestamp: string
}) {
  await sendMakeWebhook('payment.success', {
    payment_intent_id: data.paymentIntentId,
    user_id: data.userId,
    user_name: data.userName,
    user_email: data.userEmail,
    user_phone: data.userPhone || null,
    course_id: data.courseId || null,
    course_title: data.courseTitle || null,
    cohort_id: data.cohortId || null,
    cohort_title: data.cohortTitle || null,
    enrollment_id: data.enrollmentId,
    order_number: data.orderNumber,
    amount: data.amount,
    original_amount: data.originalAmount,
    discount_amount: data.discountAmount,
    coupon_code: data.couponCode || null,
    type: data.type,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for payment failed events
 */
export async function sendPaymentFailedWebhook(data: {
  paymentIntentId: string
  userId: string
  courseId?: string
  cohortId?: string
  amount: number
  errorMessage: string
  timestamp: string
}) {
  await sendMakeWebhook('payment.failed', {
    payment_intent_id: data.paymentIntentId,
    user_id: data.userId,
    course_id: data.courseId || null,
    cohort_id: data.cohortId || null,
    amount: data.amount,
    error_message: data.errorMessage,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for appointment created events
 */
export async function sendAppointmentCreatedWebhook(data: {
  appointmentId: string
  userId: string
  studentEmail: string
  studentName: string
  courseId?: string | null
  courseTitle?: string | null
  contentItemId?: string | null
  contentItemTitle?: string | null
  scheduledAt: string
  scheduledDate?: string
  scheduledTime?: string
  durationMinutes: number
  status: string
  timestamp: string
}) {
  await sendMakeWebhook('appointment.created', {
    appointment_id: data.appointmentId,
    user_id: data.userId,
    student_email: data.studentEmail,
    student_name: data.studentName,
    course_id: data.courseId || null,
    course_title: data.courseTitle || null,
    content_item_id: data.contentItemId || null,
    content_item_title: data.contentItemTitle || null,
    scheduled_at: data.scheduledAt,
    scheduled_date: data.scheduledDate || null,
    scheduled_time: data.scheduledTime || null,
    duration_minutes: data.durationMinutes,
    status: data.status,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for appointment payment confirmed events
 */
export async function sendAppointmentPaymentConfirmedWebhook(data: {
  appointmentId: string
  paymentIntentId: string
  userId: string
  studentEmail: string
  studentName?: string
  courseId?: string | null
  courseTitle?: string | null
  scheduledAt?: string
  scheduledDate?: string
  scheduledTime?: string
  durationMinutes?: number
  amount: number
  confirmedAt: string
}) {
  await sendMakeWebhook('appointment.payment.confirmed', {
    appointment_id: data.appointmentId,
    payment_intent_id: data.paymentIntentId,
    user_id: data.userId,
    student_email: data.studentEmail,
    student_name: data.studentName || data.studentEmail,
    course_id: data.courseId || null,
    course_title: data.courseTitle || null,
    scheduled_at: data.scheduledAt || null,
    scheduled_date: data.scheduledDate || null,
    scheduled_time: data.scheduledTime || null,
    duration_minutes: data.durationMinutes || null,
    amount: data.amount,
    confirmed_at: data.confirmedAt,
  })
}

/**
 * Send webhook to Make.com for appointment cancelled events
 */
export async function sendAppointmentCancelledWebhook(data: {
  appointmentId: string
  userId: string
  studentEmail: string
  courseId?: string | null
  courseTitle?: string | null
  cancelledBy: 'student' | 'admin'
  cancellationReason?: string | null
  scheduledAt: string
  timestamp: string
}) {
  await sendMakeWebhook('appointment.cancelled', {
    appointment_id: data.appointmentId,
    user_id: data.userId,
    student_email: data.studentEmail,
    course_id: data.courseId || null,
    course_title: data.courseTitle || null,
    cancelled_by: data.cancelledBy,
    cancellation_reason: data.cancellationReason || null,
    scheduled_at: data.scheduledAt,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for appointment rescheduled events
 */
export async function sendAppointmentRescheduledWebhook(data: {
  appointmentId: string
  userId: string
  studentEmail: string
  courseId?: string | null
  rescheduledBy: 'student' | 'admin'
  reason: string
  oldScheduledAt: string
  newScheduledAt: string
  timestamp: string
}) {
  await sendMakeWebhook('appointment.rescheduled', {
    appointment_id: data.appointmentId,
    user_id: data.userId,
    student_email: data.studentEmail,
    course_id: data.courseId || null,
    rescheduled_by: data.rescheduledBy,
    reason: data.reason,
    old_scheduled_at: data.oldScheduledAt,
    new_scheduled_at: data.newScheduledAt,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for appointment completed events
 */
export async function sendAppointmentCompletedWebhook(data: {
  appointmentId: string
  userId: string
  studentEmail: string
  courseId?: string | null
  scheduledAt: string
  durationMinutes: number
  completedAt: string
}) {
  await sendMakeWebhook('appointment.completed', {
    appointment_id: data.appointmentId,
    user_id: data.userId,
    student_email: data.studentEmail,
    course_id: data.courseId || null,
    scheduled_at: data.scheduledAt,
    duration_minutes: data.durationMinutes,
    completed_at: data.completedAt,
  })
}

/**
 * Send webhook to Make.com for student message/question to instructor
 */
export async function sendMessageWebhook(data: {
  messageId: string
  threadId: string
  studentId: string
  studentEmail: string
  studentName: string
  instructorId?: string | null
  instructorEmail?: string | null
  instructorName?: string | null
  content: string
  contentItemId?: string | null
  contentItemTitle?: string | null
  courseId?: string | null
  courseTitle?: string | null
  timestamp: string
}) {
  await sendMakeWebhook('message.sent', {
    message_id: data.messageId,
    thread_id: data.threadId,
    student_id: data.studentId,
    student_email: data.studentEmail,
    student_name: data.studentName,
    instructor_id: data.instructorId || null,
    instructor_email: data.instructorEmail || null,
    instructor_name: data.instructorName || null,
    content: data.content,
    content_item_id: data.contentItemId || null,
    content_item_title: data.contentItemTitle || null,
    course_id: data.courseId || null,
    course_title: data.courseTitle || null,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for instructor response to student message
 */
export async function sendInstructorResponseWebhook(data: {
  messageId: string
  threadId: string
  instructorId: string
  instructorEmail: string
  instructorName: string
  studentId: string
  studentEmail: string
  studentName: string
  content: string
  courseId?: string | null
  courseTitle?: string | null
  timestamp: string
}) {
  await sendMakeWebhook('instructor.response', {
    message_id: data.messageId,
    thread_id: data.threadId,
    instructor_id: data.instructorId,
    instructor_email: data.instructorEmail,
    instructor_name: data.instructorName,
    student_id: data.studentId,
    student_email: data.studentEmail,
    student_name: data.studentName,
    content: data.content,
    course_id: data.courseId || null,
    course_title: data.courseTitle || null,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for cohort enrollment created events
 */
export async function sendCohortEnrollmentWebhook(data: {
  enrollmentId: string
  userId: string
  userEmail: string
  userName: string
  cohortId: string
  cohortTitle: string
  paymentIntentId: string
  amount: number | null
  expiresAt: string
  createdAt: string
}) {
  await sendMakeWebhook('cohort.enrollment.created', {
    enrollment_id: data.enrollmentId,
    user_id: data.userId,
    user_email: data.userEmail,
    user_name: data.userName,
    cohort_id: data.cohortId,
    cohort_title: data.cohortTitle,
    payment_intent_id: data.paymentIntentId,
    amount: data.amount,
    expires_at: data.expiresAt,
    created_at: data.createdAt,
  })
}

/**
 * Send webhook to Make.com for cohort message board posts
 */
export async function sendCohortMessageWebhook(data: {
  messageId: string
  cohortId: string
  cohortTitle: string
  authorId: string
  authorEmail: string
  authorName: string
  content: string
  hasAttachments: boolean
  timestamp: string
}) {
  await sendMakeWebhook('cohort.message.created', {
    message_id: data.messageId,
    cohort_id: data.cohortId,
    cohort_title: data.cohortTitle,
    author_id: data.authorId,
    author_email: data.authorEmail,
    author_name: data.authorName,
    content: data.content,
    has_attachments: data.hasAttachments,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for support ticket created events
 */
export async function sendTicketCreatedWebhook(data: {
  ticketId: string
  ticketNumber: string
  userId: string
  userEmail: string
  userName: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  createdAt: string
}) {
  await sendMakeWebhook('ticket.created', {
    ticket_id: data.ticketId,
    ticket_number: data.ticketNumber,
    user_id: data.userId,
    user_email: data.userEmail,
    user_name: data.userName,
    subject: data.subject,
    description: data.description,
    category: data.category,
    priority: data.priority,
    status: data.status,
    created_at: data.createdAt,
  })
}

/**
 * Send webhook to Make.com for support ticket status changed events
 */
export async function sendTicketStatusChangedWebhook(data: {
  ticketId: string
  ticketNumber: string
  userId: string
  userEmail: string
  userName: string
  oldStatus: string
  newStatus: string
  changedBy: string
  reason?: string | null
  timestamp: string
}) {
  await sendMakeWebhook('ticket.status_changed', {
    ticket_id: data.ticketId,
    ticket_number: data.ticketNumber,
    user_id: data.userId,
    user_email: data.userEmail,
    user_name: data.userName,
    old_status: data.oldStatus,
    new_status: data.newStatus,
    changed_by: data.changedBy,
    reason: data.reason || null,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for support ticket reply added events
 */
export async function sendTicketReplyWebhook(data: {
  ticketId: string
  ticketNumber: string
  replyId: string
  userId: string
  userEmail: string
  userName: string
  senderRole: string
  message: string
  isInternal: boolean
  timestamp: string
}) {
  await sendMakeWebhook('ticket.reply_added', {
    ticket_id: data.ticketId,
    ticket_number: data.ticketNumber,
    reply_id: data.replyId,
    user_id: data.userId,
    user_email: data.userEmail,
    user_name: data.userName,
    sender_role: data.senderRole,
    message: data.message,
    is_internal: data.isInternal,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for error occurred events (HIGH/CRITICAL only)
 */
export async function sendErrorOccurredWebhook(data: {
  errorId: string
  errorType: string
  errorMessage: string
  severity: string
  userId?: string | null
  userEmail?: string | null
  url?: string | null
  stackTrace?: string | null
  userAgent?: string | null
  timestamp: string
}) {
  await sendMakeWebhook('error.occurred', {
    error_id: data.errorId,
    error_type: data.errorType,
    error_message: data.errorMessage,
    severity: data.severity,
    user_id: data.userId || null,
    user_email: data.userEmail || null,
    url: data.url || null,
    stack_trace: data.stackTrace || null,
    user_agent: data.userAgent || null,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for contact form submissions
 */
export async function sendContactFormWebhook(data: {
  name: string
  email: string
  subject: string
  message: string
  timestamp: string
}) {
  await sendMakeWebhook('contact.form.submitted', {
    name: data.name,
    email: data.email,
    subject: data.subject,
    message: data.message,
    timestamp: data.timestamp,
  })
}

/**
 * Send webhook to Make.com for investor diagnostic completions
 */
export async function sendInvestorDiagnosticCompletedWebhook(data: {
  diagnosticId: string
  diagnosticVersion: string
  language: string
  firstName: string
  email: string
  reportUrl: string
  reportToken: string
  reportTemplateId: string
  reportTemplateVersion: string
  responses: Record<string, string>
  scores: Record<string, number>
  primaryProfile: { id: string; name: string; score: number }
  secondaryProfile: { id: string; name: string; score: number } | null
  confidence: 'low' | 'medium' | 'high'
  completedAt: string
}) {
  await sendMakeWebhook('investor.diagnostic.completed', {
    diagnostic_id: data.diagnosticId,
    diagnostic_version: data.diagnosticVersion,
    language: data.language,
    first_name: data.firstName,
    email: data.email,
    report_url: data.reportUrl,
    report_token: data.reportToken,
    report_template_id: data.reportTemplateId,
    report_template_version: data.reportTemplateVersion,
    responses: data.responses,
    scores: data.scores,
    primary_profile: data.primaryProfile,
    secondary_profile: data.secondaryProfile,
    confidence: data.confidence,
    completed_at: data.completedAt,
  })
}











