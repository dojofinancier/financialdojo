export type ReceiptData = {
  productName: string;
  price: number;
  currency: string;
  userName: string;
  userEmail: string;
  orderNumber: number | null;
  paymentMethod: string;
  dateShort: string;
  dateLong: string;
  tps?: string | null;
  tvq?: string | null;
  tpsNumber?: string | null;
  tvqNumber?: string | null;
  /** Formatted discount amount when coupon applied */
  discount?: string | null;
  /** Coupon code when discount applied */
  couponCode?: string | null;
  /** Original amount before discount */
  originalAmount?: number | null;
  total?: number;
  status?: "Paid" | "Failed" | "Refunded";
};
