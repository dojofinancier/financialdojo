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
    discount?: string | null;
    total?: number;
    status?: "Paid" | "Failed" | "Refunded";
};
