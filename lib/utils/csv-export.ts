/**
 * Export financials to CSV format
 */
export function exportFinancialsToCSV(
  data: any,
  year: number,
  month: number | null
) {
  const headers = ["Period", "Revenu brut", "Remboursements", "Revenu net"];

  const period = month
    ? `${year}-${String(month).padStart(2, "0")}`
    : `${year}`;

  const rows = [
    [
      period,
      data.grossRevenue?.toFixed(2) || "0.00",
      data.totalRefunds?.toFixed(2) || "0.00",
      data.netRevenue?.toFixed(2) || "0.00",
    ],
  ];

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `finances_${period}_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export orders to CSV format
 */
export function exportOrdersToCSV(orders: any[]) {
  const headers = [
    "ID Commande",
    "Date",
    "Student",
    "Email",
    "Cours",
    "Prix original",
    "Discount",
    "Montant final",
    "Coupon",
    "Statut",
    "Payment ID",
  ];

  const rows = orders.map((order) => {
    const discount = order.couponUsage
      ? Number(order.couponUsage.coupon.discountAmount)
      : 0;
    const originalPrice = Number(order.course.price);
    const finalPrice = Math.max(0, originalPrice - discount);

    return [
      order.id,
      new Date(order.purchaseDate).toLocaleDateString("fr-CA"),
      order.user.firstName && order.user.lastName
        ? `${order.user.firstName} ${order.user.lastName}`.trim()
        : "",
      order.user.email,
      order.course.title,
      originalPrice.toFixed(2),
      discount.toFixed(2),
      finalPrice.toFixed(2),
      order.couponUsage?.coupon.code || "",
      order.refunded ? "Refunded" : order.paymentStatus,
      order.paymentIntentId || "",
    ];
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `commandes_${new Date().toISOString().split("T")[0]}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

