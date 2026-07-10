#!/usr/bin/env python3
"""Port remaining French features (phases 5-8) into financial_dojo."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FR = Path(r"C:\Users\User\Desktop\Dojo_Financier_App")

ADMIN_PATH = "/dashboard/admin"
ADMIN_PATH_FR = "/tableau-de-bord/admin"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def write(p: Path, content: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")


def fix_admin_paths(content: str) -> str:
    return content.replace(ADMIN_PATH_FR, ADMIN_PATH)


def copy_client(fr_rel: str, en_rel: str, extra_replacements: dict[str, str] | None = None) -> None:
    src = FR / fr_rel
    dst = ROOT / en_rel
    content = fix_admin_paths(read(src))
    replacements = {
        "Retour à la liste": "Back to list",
        "Détails de la commande": "Order details",
        "Étudiant": "Student",
        "Erreur lors du téléchargement du reçu": "Error downloading receipt",
        "Télécharger le reçu": "Download receipt",
        "Voir les détails": "View details",
        "Erreur lors du chargement des données": "Error loading data",
        "Erreur lors du chargement des données financières": "Error loading financial data",
        "Export CSV généré": "CSV export generated",
        "Erreur lors de l'export": "Export error",
    }
    if extra_replacements:
        replacements.update(extra_replacements)
    for old, new in replacements.items():
        content = content.replace(old, new)
    write(dst, content)


def thin_page(client_import: str, client_name: str) -> str:
    return f'''import {{ {client_name} }} from "@/components/admin/{client_import}";

export default function Page() {{
  return <{client_name} />;
}}
'''


def port_receipt_route() -> None:
    route = ROOT / "app" / "api" / "admin" / "receipt" / "[paymentIntentId]" / "route.ts"
    content = read(FR / "app" / "api" / "admin" / "receipt" / "[paymentIntentId]" / "route.ts")
    content = content.replace("Numéro de transaction manquant", "Missing transaction ID")
    content = content.replace("Reçu introuvable", "Receipt not found")
    content = content.replace("Erreur lors de la génération du reçu", "Error generating receipt")
    write(route, content)


def port_payments_admin_action() -> None:
    path = ROOT / "app" / "actions" / "payments.ts"
    content = read(path)
    if "getReceiptDataForAdminAction" in content:
        return
    if "requireAdmin" not in content:
        content = content.replace(
            'import { requireAuth } from "@/lib/auth/require-auth";',
            'import { requireAuth, requireAdmin } from "@/lib/auth/require-auth";',
        )
    insert = '''

/**
 * Fetches receipt for any paymentIntentId without user ownership check.
 */
export async function getReceiptDataForAdminAction(
  paymentIntentId: string
): Promise<{ success: boolean; error?: string; data?: ReceiptData }> {
  try {
    await requireAdmin();

    const currency = "CAD";
    const currencyDisplay = currency;
    const formatAmount = (amount: number) =>
      new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency,
      }).format(amount);

    const enrollment = await prisma.enrollment.findFirst({
      where: { paymentIntentId },
      include: {
        course: true,
        user: true,
        couponUsage: { include: { coupon: true } },
      },
    });

    if (enrollment) {
      let paymentIntent;
      let charge = null;
      let status: ReceiptData["status"] = "Paid";

      try {
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge"],
        });
        charge =
          typeof paymentIntent.latest_charge === "object" &&
          paymentIntent.latest_charge !== null
            ? paymentIntent.latest_charge
            : null;
        if (paymentIntent.status !== "succeeded") {
          status = "Failed";
        } else if (charge && "amount_refunded" in charge && charge.amount_refunded > 0) {
          status = "Refunded";
        }
      } catch (stripeError: unknown) {
        const msg = stripeError instanceof Error ? stripeError.message : "Stripe error";
        await logServerError({
          errorMessage: `Stripe retrieve failed in getReceiptDataForAdminAction: ${msg}`,
          stackTrace: stripeError instanceof Error ? stripeError.stack : undefined,
          severity: "MEDIUM",
        });
        return {
          success: false,
          error:
            process.env.NODE_ENV === "development"
              ? `Stripe: ${msg}`
              : "Unable to retrieve payment details.",
        };
      }

      const paymentMethodDetails = charge?.payment_method_details as
        | { card?: { brand?: string; last4?: string } }
        | undefined;
      const card = paymentMethodDetails?.card;
      const paymentMethod =
        card?.brand && card?.last4
          ? `Card (${card.brand} •••• ${card.last4})`
          : "Card";

      const user = enrollment.user;
      const purchaseDate = enrollment.purchaseDate;
      const amount = paymentIntent.amount / 100;
      let discount: string | null = null;
      let originalAmount: number | null = null;
      if (enrollment.couponUsage?.discountAmount != null) {
        const discountAmount = Number(enrollment.couponUsage.discountAmount);
        discount = `-${formatAmount(discountAmount)}`;
        originalAmount = Number(enrollment.course.price);
      }

      const data: ReceiptData = {
        productName: enrollment.course.title,
        price: originalAmount ?? amount,
        currency: currencyDisplay,
        userName:
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
        userEmail: user.email,
        orderNumber: enrollment.orderNumber ?? null,
        paymentMethod,
        dateShort: format(purchaseDate, "MM/dd/yyyy"),
        dateLong: format(purchaseDate, "MMMM d, yyyy", { locale: enCA }),
        tps: null,
        tvq: null,
        tpsNumber: null,
        tvqNumber: null,
        discount,
        couponCode: enrollment.couponUsage?.coupon?.code ?? null,
        originalAmount,
        total: amount,
        status,
      };

      return { success: true, data };
    }

    const cohortEnrollment = await prisma.cohortEnrollment.findFirst({
      where: { paymentIntentId },
      include: { cohort: true, user: true },
    });

    if (cohortEnrollment) {
      let paymentIntent;
      let charge = null;
      let status: ReceiptData["status"] = "Paid";

      try {
        paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ["latest_charge"],
        });
        charge =
          typeof paymentIntent.latest_charge === "object" &&
          paymentIntent.latest_charge !== null
            ? paymentIntent.latest_charge
            : null;
        if (paymentIntent.status !== "succeeded") {
          status = "Failed";
        } else if (charge && "amount_refunded" in charge && charge.amount_refunded > 0) {
          status = "Refunded";
        }
      } catch (stripeError: unknown) {
        const msg = stripeError instanceof Error ? stripeError.message : "Stripe error";
        await logServerError({
          errorMessage: `Stripe retrieve failed (cohort) in getReceiptDataForAdminAction: ${msg}`,
          stackTrace: stripeError instanceof Error ? stripeError.stack : undefined,
          severity: "MEDIUM",
        });
        return {
          success: false,
          error:
            process.env.NODE_ENV === "development"
              ? `Stripe: ${msg}`
              : "Unable to retrieve payment details.",
        };
      }

      const paymentMethodDetails = charge?.payment_method_details as
        | { card?: { brand?: string; last4?: string } }
        | undefined;
      const card = paymentMethodDetails?.card;
      const paymentMethod =
        card?.brand && card?.last4
          ? `Card (${card.brand} •••• ${card.last4})`
          : "Card";

      const user = cohortEnrollment.user;
      const purchaseDate = cohortEnrollment.purchaseDate;
      const amount = paymentIntent.amount / 100;

      const data: ReceiptData = {
        productName: cohortEnrollment.cohort.title,
        price: amount,
        currency: currencyDisplay,
        userName:
          `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
        userEmail: user.email,
        orderNumber: cohortEnrollment.orderNumber ?? null,
        paymentMethod,
        dateShort: format(purchaseDate, "MM/dd/yyyy"),
        dateLong: format(purchaseDate, "MMMM d, yyyy", { locale: enCA }),
        tps: null,
        tvq: null,
        tpsNumber: null,
        tvqNumber: null,
        discount: null,
        total: amount,
        status,
      };

      return { success: true, data };
    }

    return { success: false, error: "Payment not found" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await logServerError({
      errorMessage: `Failed to get receipt data (admin): ${message}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return {
      success: false,
      error:
        process.env.NODE_ENV === "development"
          ? `Error retrieving receipt: ${message}`
          : "Error retrieving receipt",
    };
  }
}
'''
    marker = "/**\n * Create enrollment from payment intent"
    if marker not in content:
        raise SystemExit("payments.ts marker not found")
    write(path, content.replace(marker, insert + "\n" + marker))


def port_order_list() -> None:
    path = ROOT / "components" / "admin" / "orders" / "order-list.tsx"
    content = read(path)
    if "handleDownloadReceipt" in content:
        return
    content = content.replace(
        'import { Loader2, Eye, Download, FileText } from "lucide-react";',
        'import { Loader2, Eye, Download, FileDown } from "lucide-react";',
    )
    content = content.replace(
        "  const [hasMore, setHasMore] = useState(false);\n",
        "  const [hasMore, setHasMore] = useState(false);\n  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);\n",
    )
    handler = '''
  const handleDownloadReceipt = async (paymentIntentId: string) => {
    setDownloadingReceiptId(paymentIntentId);
    try {
      const res = await fetch(`/api/admin/receipt/${paymentIntentId}`, {
        method: "GET",
        credentials: "same-origin",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          (err as { error?: string }).error ?? "Error downloading receipt"
        );
        return;
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      const match = contentDisposition?.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? `receipt-${paymentIntentId}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error downloading receipt");
    } finally {
      setDownloadingReceiptId(null);
    }
  };

'''
    content = content.replace("  const handleExportCSV = async () => {", handler + "  const handleExportCSV = async () => {")
    old_btn = '''                        {order.paymentIntentId && (
                          <a
                            href={`/api/receipt/${order.paymentIntentId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                          >
                            <Button variant="ghost" size="icon" title="Download Receipt">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </a>
                        )}'''
    new_btn = '''                        {order.paymentIntentId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownloadReceipt(order.paymentIntentId!)}
                              disabled={downloadingReceiptId === order.paymentIntentId}
                              title="Download receipt"
                            >
                              {downloadingReceiptId === order.paymentIntentId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4" />
                              )}
                            </Button>
                          )}'''
    content = content.replace(old_btn, new_btn)
    write(path, content)


def port_financials() -> None:
    path = ROOT / "app" / "actions" / "financials.ts"
    content = read(path)
    if "includeStripeRefunds" in content:
        return

    content = content.replace(
        "export async function getRevenueByPeriodAction(\n  year: number,\n  month?: number\n): Promise<FinancialActionResult> {\n  try {",
        "export async function getRevenueByPeriodAction(\n  year: number,\n  month?: number,\n  options?: { includeStripeRefunds?: boolean }\n): Promise<FinancialActionResult> {\n  const includeStripeRefunds = options?.includeStripeRefunds ?? true;\n  try {",
    )
    content = content.replace(
        "    // Get refunds in period - batch process for efficiency\n    let totalRefunds = 0;\n    const refundsByCourse: Record<string, number> = {};\n\n    // Get unique payment intent IDs",
        "    // Get refunds in period - optional Stripe round-trips\n    let totalRefunds = 0;\n    const refundsByCourse: Record<string, number> = {};\n\n    if (includeStripeRefunds) {\n    // Get unique payment intent IDs",
    )
    content = re.sub(
        r"(    // Calculate net revenue\n    const netRevenue = grossRevenue - totalRefunds;)",
        "    }\n\n\\1",
        content,
        count=1,
    )

    content = content.replace(
        "export async function getTotalRevenueAction(): Promise<FinancialActionResult> {\n  try {",
        "export async function getTotalRevenueAction(options?: {\n  includeStripeRefunds?: boolean;\n}): Promise<FinancialActionResult> {\n  const includeStripeRefunds = options?.includeStripeRefunds ?? true;\n  try {",
    )
    content = content.replace(
        "    // Calculate total refunds - batch process for efficiency\n    let totalRefunds = 0;\n    const paymentIntentIds = Array.from(",
        "    // Calculate total refunds - optional Stripe round-trips\n    let totalRefunds = 0;\n    if (includeStripeRefunds) {\n    const paymentIntentIds = Array.from(",
    )
    content = content.replace(
        "      );\n    }\n\n    return {\n      success: true,\n      data: {\n        grossRevenue,\n        totalRefunds,\n        netRevenue: grossRevenue - totalRefunds,\n        revenueByCourse: Object.values(revenueByCourse),\n      },\n    };",
        "      );\n    }\n    }\n\n    return {\n      success: true,\n      data: {\n        grossRevenue,\n        totalRefunds,\n        netRevenue: grossRevenue - totalRefunds,\n        revenueByCourse: Object.values(revenueByCourse),\n      },\n    };",
        1,
    )

    content = content.replace(
        "export async function getSubscriptionStatisticsAction(): Promise<FinancialActionResult> {\n  try {",
        "export async function getSubscriptionStatisticsAction(options?: {\n  includeStripeRevenue?: boolean;\n}): Promise<FinancialActionResult> {\n  const includeStripeRevenue = options?.includeStripeRevenue ?? true;\n  try {",
    )
    content = content.replace(
        "    // Get subscription revenue from Stripe (estimate based on active subscriptions)\n    let estimatedMonthlyRevenue = 0;\n    const batchSize = 10;",
        "    // Optional Stripe revenue estimate\n    let estimatedMonthlyRevenue = 0;\n    if (includeStripeRevenue) {\n    const batchSize = 10;",
    )
    content = content.replace(
        "      estimatedMonthlyRevenue += amounts.reduce((sum, a) => sum + a, 0);\n    }\n\n    return {\n      success: true,\n      data: {\n        totalSubscriptions: subscriptions.length,",
        "      estimatedMonthlyRevenue += amounts.reduce((sum, a) => sum + a, 0);\n    }\n    }\n\n    return {\n      success: true,\n      data: {\n        totalSubscriptions: subscriptions.length,",
    )

    content = content.replace(
        "export async function getRevenueTrendsAction(): Promise<FinancialActionResult> {\n  try {",
        "export async function getRevenueTrendsAction(options?: {\n  includeStripeRefunds?: boolean;\n}): Promise<FinancialActionResult> {\n  const includeStripeRefunds = options?.includeStripeRefunds ?? true;\n  try {",
    )
    content = content.replace(
        "    // Batch fetch refunds with concurrency limit\n    const paymentIntentIds = Array.from(",
        "    // Batch fetch refunds with concurrency limit (optional)\n    const refundsByEnrollment: Record<string, Array<{ date: Date; amount: number }>> = {};\n\n    if (includeStripeRefunds) {\n    const paymentIntentIds = Array.from(",
    )
    content = content.replace(
        "    const batchSize = 10;\n    const refundsByEnrollment: Record<string, Array<{ date: Date; amount: number }>> = {};\n\n    for (let i = 0; i < paymentIntentIds.length; i += batchSize) {",
        "    const batchSize = 10;\n\n    for (let i = 0; i < paymentIntentIds.length; i += batchSize) {",
    )
    # close includeStripeRefunds block before applying refunds to monthData
    content = content.replace(
        "    // Apply refunds to month data\n    for (const paymentIntentId in refundsByEnrollment) {",
        "    }\n\n    // Apply refunds to month data\n    for (const paymentIntentId in refundsByEnrollment) {",
    )

    write(path, content)


def port_overview_dashboard() -> None:
    src = FR / "components" / "admin" / "overview-dashboard.tsx"
    dst = ROOT / "components" / "admin" / "overview-dashboard.tsx"
    content = read(src)
    content = content.replace("Erreur lors du chargement des données", "Error loading data")
    content = content.replace(
        "Erreur lors du chargement des données financières",
        "Error loading financial data",
    )
    content = content.replace("Export CSV généré", "CSV export generated")
    content = content.replace("Erreur lors de l'export", "Export error")
    write(dst, content)


def port_courses_actions() -> None:
    path = ROOT / "app" / "actions" / "courses.ts"
    content = read(path)
    if "getCourseLearningShellAction" in content:
        return

    block = '''

/** Admin course editor — auth-gated wrapper around getCourseAction. */
export async function getCourseAdminPageAction(courseId: string) {
  try {
    await requireAdmin();
    return getCourseAction(courseId);
  } catch (error) {
    await logServerError({
      errorMessage: `Failed to get admin course page: ${error instanceof Error ? error.message : "Unknown error"}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return null;
  }
}

/** Derive a display title for a content item from its type and relations. */
function contentItemDisplayTitle(item: {
  contentType: string;
  order: number;
  quiz?: { title: string } | null;
  notes?: { id: string }[];
}): string {
  if (item.contentType === "QUIZ" && item.quiz) return item.quiz.title;
  if (item.contentType === "VIDEO") return `Video ${item.order}`;
  if (item.contentType === "NOTE" && item.notes && item.notes.length > 0) return `Note ${item.order}`;
  if (item.contentType === "FLASHCARD") return `Flashcard ${item.order}`;
  return `Content ${item.order}`;
}

/**
 * Lightweight course shell for the learning page — module tree metadata only.
 */
export async function getCourseLearningShellAction(courseId: string) {
  try {
    const user = await requireAuth();
    const { validateCourseAccess } = await import("@/lib/utils/access-validation");

    const accessResult = await validateCourseAccess(user.id, courseId);
    if (!accessResult.hasAccess) {
      return { success: false as const, error: accessResult.reason || "Access denied" };
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        slug: true,
        title: true,
        componentVisibility: true,
        pdfUrl: true,
        category: true,
        recommendedStudyHoursMin: true,
        recommendedStudyHoursMax: true,
        orientationVideoUrl: true,
        orientationText: true,
        modules: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            shortTitle: true,
            description: true,
            order: true,
            pdfUrl: true,
            contentItems: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                contentType: true,
                order: true,
                quiz: { select: { title: true } },
                notes: { where: { type: "ADMIN" }, select: { id: true }, take: 1 },
              },
            },
          },
        },
      },
    });

    if (!course) {
      return { success: false as const, error: "Course not found" };
    }

    return {
      success: true as const,
      data: {
        ...course,
        recommendedStudyHoursMin: course.recommendedStudyHoursMin ?? 6,
        recommendedStudyHoursMax: course.recommendedStudyHoursMax ?? 10,
        orientationVideoUrl: course.orientationVideoUrl ?? null,
        orientationText: course.orientationText ?? null,
        modules: course.modules.map((module) => ({
          ...module,
          contentItems: module.contentItems.map((item) => ({
            id: item.id,
            contentType: item.contentType,
            order: item.order,
            title: contentItemDisplayTitle(item),
          })),
        })),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await logServerError({
      errorMessage: `Failed to get course learning shell: ${errorMessage}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return { success: false as const, error: "Error loading course content" };
  }
}

/**
 * Load a single content item's heavy data (video, quiz) on demand.
 */
export async function getLearningContentItemAction(contentItemId: string) {
  try {
    const user = await requireAuth();
    const { validateCourseAccess } = await import("@/lib/utils/access-validation");

    const contentItem = await prisma.contentItem.findUnique({
      where: { id: contentItemId },
      select: {
        id: true,
        contentType: true,
        order: true,
        module: { select: { courseId: true, title: true } },
        video: {
          select: { id: true, vimeoUrl: true, duration: true },
        },
        quiz: {
          select: {
            id: true,
            title: true,
            passingScore: true,
            timeLimit: true,
            questions: {
              orderBy: { order: "asc" },
              select: {
                id: true,
                order: true,
                type: true,
                question: true,
                options: true,
                correctAnswer: true,
              },
            },
          },
        },
      },
    });

    if (!contentItem) {
      return { success: false as const, error: "Content not found" };
    }

    const accessResult = await validateCourseAccess(user.id, contentItem.module.courseId);
    if (!accessResult.hasAccess) {
      return { success: false as const, error: accessResult.reason || "Access denied" };
    }

    return {
      success: true as const,
      data: {
        id: contentItem.id,
        contentType: contentItem.contentType,
        order: contentItem.order,
        title: contentItemDisplayTitle({
          contentType: contentItem.contentType,
          order: contentItem.order,
          quiz: contentItem.quiz,
        }),
        moduleTitle: contentItem.module.title,
        video: contentItem.video,
        quiz: contentItem.quiz,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await logServerError({
      errorMessage: `Failed to get learning content item: ${errorMessage}`,
      stackTrace: error instanceof Error ? error.stack : undefined,
      severity: "MEDIUM",
    });
    return { success: false as const, error: "Error loading content" };
  }
}
'''
    marker = "/**\n * Get a single course by ID\n * @deprecated"
    if marker not in content:
        marker = "export async function getCourseAction(courseId: string) {"
        idx = content.find(marker)
        if idx == -1:
            raise SystemExit("courses.ts insert point not found")
        write(path, content[:idx] + block + "\n" + content[idx:])
    else:
        write(path, content.replace(marker, block + "\n" + marker))


def port_learning_interface() -> None:
    src = FR / "components" / "course" / "learning-interface.tsx"
    dst = ROOT / "components" / "course" / "learning-interface.tsx"
    content = read(src)
    content = content.replace("/apprendre/", "/learn/")
    content = content.replace("Poser une question", "Ask a question")
    write(dst, content)


def port_learn_page() -> None:
    for rel in [
        "app/learn/[courseId]/page.tsx",
        "app/apprendre/[courseId]/page.tsx",
    ]:
        path = ROOT / rel
        if not path.exists():
            continue
        content = read(path)
        content = content.replace("getCourseContentAction", "getCourseLearningShellAction")
        content = content.replace("getCourseContentAction failed", "getCourseLearningShellAction failed")
        content = content.replace(
            'errorMessage.includes("error loading")',
            'errorMessage.includes("error loading course content")',
        )
        write(path, content)


def port_admin_layout() -> None:
    layout = ROOT / "app" / "(dashboard)" / "dashboard" / "admin" / "layout.tsx"
    if layout.exists():
        return
    write(
        layout,
        read(FR / "app" / "tableau-de-bord" / "admin" / "layout.tsx"),
    )
    tb_layout = ROOT / "app" / "tableau-de-bord" / "admin" / "layout.tsx"
    if not tb_layout.exists():
        write(tb_layout, read(layout))


def port_detail_clients() -> None:
    clients = [
        ("components/admin/students/student-detail-page-client.tsx", "students/student-detail-page-client.tsx", "StudentDetailPageClient"),
        ("components/admin/orders/order-detail-page-client.tsx", "orders/order-detail-page-client.tsx", "OrderDetailPageClient"),
        ("components/admin/appointments/appointment-detail-page-client.tsx", "appointments/appointment-detail-page-client.tsx", "AppointmentDetailPageClient"),
        ("components/admin/support-tickets/support-ticket-detail-page-client.tsx", "support-tickets/support-ticket-detail-page-client.tsx", "SupportTicketDetailPageClient"),
        ("components/admin/messages/message-thread-page-client.tsx", "messages/message-thread-page-client.tsx", "MessageThreadPageClient"),
    ]
    for fr_rel, en_rel, _ in clients:
        copy_client(fr_rel, en_rel)

    # Course detail client — English tabs (no clone / consolidated notes / case studies)
    course_client = ROOT / "components" / "admin" / "courses" / "course-detail-page-client.tsx"
    if not course_client.exists():
        write(
            course_client,
            read(ROOT / "scripts" / "course-detail-page-client.tsx.template")
            if (ROOT / "scripts" / "course-detail-page-client.tsx.template").exists()
            else "",
        )


def port_thin_pages() -> None:
    pages = [
        ("app/(dashboard)/dashboard/admin/courses/[courseId]/page.tsx", "courses/course-detail-page-client.tsx", "CourseDetailPageClient"),
        ("app/(dashboard)/dashboard/admin/students/[studentId]/page.tsx", "students/student-detail-page-client.tsx", "StudentDetailPageClient"),
        ("app/(dashboard)/dashboard/admin/orders/[orderId]/page.tsx", "orders/order-detail-page-client.tsx", "OrderDetailPageClient"),
        ("app/(dashboard)/dashboard/admin/appointments/[appointmentId]/page.tsx", "appointments/appointment-detail-page-client.tsx", "AppointmentDetailPageClient"),
        ("app/(dashboard)/dashboard/admin/support-tickets/[ticketId]/page.tsx", "support-tickets/support-ticket-detail-page-client.tsx", "SupportTicketDetailPageClient"),
        ("app/(dashboard)/dashboard/admin/messages/[threadId]/page.tsx", "messages/message-thread-page-client.tsx", "MessageThreadPageClient"),
        ("app/tableau-de-bord/admin/courses/[courseId]/page.tsx", "courses/course-detail-page-client.tsx", "CourseDetailPageClient"),
        ("app/tableau-de-bord/admin/students/[studentId]/page.tsx", "students/student-detail-page-client.tsx", "StudentDetailPageClient"),
        ("app/tableau-de-bord/admin/orders/[orderId]/page.tsx", "orders/order-detail-page-client.tsx", "OrderDetailPageClient"),
        ("app/tableau-de-bord/admin/appointments/[appointmentId]/page.tsx", "appointments/appointment-detail-page-client.tsx", "AppointmentDetailPageClient"),
        ("app/tableau-de-bord/admin/support-tickets/[ticketId]/page.tsx", "support-tickets/support-ticket-detail-page-client.tsx", "SupportTicketDetailPageClient"),
        ("app/tableau-de-bord/admin/messages/[threadId]/page.tsx", "messages/message-thread-page-client.tsx", "MessageThreadPageClient"),
    ]
    for page_rel, client_rel, client_name in pages:
        write(ROOT / page_rel, thin_page(client_rel, client_name))


def main() -> None:
    port_payments_admin_action()
    port_receipt_route()
    port_order_list()
    port_financials()
    port_overview_dashboard()
    port_courses_actions()
    port_learning_interface()
    port_learn_page()
    port_admin_layout()
    port_detail_clients()
    port_thin_pages()
    print("Port complete.")


if __name__ == "__main__":
    main()
