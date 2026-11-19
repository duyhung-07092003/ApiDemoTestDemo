// Metadata dùng chung cho UI và server; domain/credential chỉ đọc trên server.
export const SOFTDREAMS_APIS = {
  invoice: { path: "/api/publish/importInvoice", method: "POST" },
  "adjust-invoice": { path: "/api/business/adjustInvoice", method: "POST" },
  "external-digest": { path: "/api/publish/externalGetDigestForImportation", method: "POST" },
  "lookup-invoices": { path: "/api/publish/getInvoicesByIkeys", method: "POST" },
} as const;

