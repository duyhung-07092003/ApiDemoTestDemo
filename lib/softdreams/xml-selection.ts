export type XmlScope = "invoice" | "product" | "fee";
export type XmlSelection = { tag: string; scope: XmlScope; index?: number; invoiceIndex: number };
