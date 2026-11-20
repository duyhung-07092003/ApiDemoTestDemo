export const initialInvoice = {
  profile: "tt78",
  specialInvoice: "0",
  convert: 0,
  pattern: "1C26TTR",
  serial: "",
  ikey: "acb3a1c2-6573-4b1b-86e7-3a0827fe3205",
  fkey: "",
  payment: "Tiền mặt",
  customerCode: "",
  buyer: "",
  customer: "Công ty TNHH Mẫu",
  tax: "",
  address: "",
  phone: "",
  email: "",
  bankName: "",
  bankNo: "",
  customerEmails: "",
  emailCC: "",
  passportNo: "",
  storeCode: "",
  storeName: "",
  provinceCode: "",
  provinceName: "",
  communeCode: "",
  communeName: "",
  exchangeRate: "",
  budgetaryRelationshipCode: "",
  comAddress: "",
  note: "",
  profileCode: "",
  payOrderOrgTaxCode: "",
  payOrderOrgName: "",
  payOrderOrgAddress: "",
  taxAuthorityCode: "",
  discount: "",
  taxFreeDeductions: "",
  vatRateOther: "",
  date: new Date().toISOString().slice(0, 10),
  currency: "VND",
  vatRate: 10,
  discountAmount: 0,
  amountInWords: "Một trăm mười nghìn đồng chẵn",
  extra: "",
  identification: "",
  locationCode: "",
  locationName: "",
  locationAddress: "",
  listAttachNum: "",
  listAttachDate: "",
  totalOverride: "",
  vatAmountOverride: "",
  amountOverride: "",
  includeGross: false,
  products: [
    {
      code: "",
      name: "Kem que TT01",
      unit: "",
      feature: "1",
      quantity: 1,
      price: 100000,
      vat: 10,
      discountAmount: 0,
      extra: "",
      vatRateOther: "",
      discount: 0,
      totalOverride: "",
      vatAmountOverride: "",
      amountOverride: "",
    },
  ],
  fees: [] as { name: string; amount: string; feeRate: string; vatRate: string; vatRateOther: string; vatAmount: string; totalCharge: string }[],
};

export const VAT_RATES = [
  [-1, "KCT · Không chịu thuế"], [-2, "KKKNT · Không kê khai nộp thuế"],
  [-3, "KHÁC · Nhập VATRateOther"], [-5, "CTTC · Cho thuê tài chính"],
  [-6, "KTPVDC · Không thuộc phạm vi điều chỉnh"], [-7, "KTGTT · Không tính vào giá tính thuế"],
  [0, "0%"], [5, "5%"], [8, "8%"], [10, "10%"],
] as const;
export const FEATURES = [["1", "Hàng hóa, dịch vụ"], ["2", "Khuyến mại"], ["3", "Chiết khấu thương mại"], ["4", "Ghi chú, diễn giải"], ["5", "Hàng hóa đặc trưng"]] as const;

export function calculateProduct(p: typeof initialInvoice.products[number]) {
  const total = p.totalOverride === "" ? p.quantity * p.price - p.discountAmount : Number(p.totalOverride);
  const rate = p.vat === -3 ? Number(p.vatRateOther) : Math.max(0, p.vat);
  const vatAmount = p.vatAmountOverride === "" ? Math.round(total * rate) / 100 : Number(p.vatAmountOverride);
  const amount = p.amountOverride === "" ? total + vatAmount : Number(p.amountOverride);
  return { total, vatAmount, amount };
}

export function calculateInvoice(data: typeof initialInvoice) {
  const sums = data.products.reduce((sum, p) => {
    const values = calculateProduct(p);
    const sign = p.feature === "3" ? -1 : 1;
    if (p.feature === "2" || p.feature === "4") return sum;
    return { total: sum.total + (sign < 0 ? -Math.abs(values.total) : values.total),
      vat: sum.vat + (sign < 0 ? -Math.abs(values.vatAmount) : values.vatAmount),
      amount: sum.amount + (sign < 0 ? -Math.abs(values.amount) : values.amount) };
  }, { total: 0, vat: 0, amount: 0 });
  return { subtotal: sums.total, calculatedVat: sums.vat,
    total: data.totalOverride === "" ? sums.total : Number(data.totalOverride),
    vat: data.vatAmountOverride === "" ? sums.vat : Number(data.vatAmountOverride),
    amount: data.amountOverride === "" ? (data.totalOverride !== "" || data.vatAmountOverride !== "" ? Number(data.totalOverride || sums.total) + Number(data.vatAmountOverride || sums.vat) : sums.amount) : Number(data.amountOverride) };
}

export function buildInvoice(data: typeof initialInvoice) {
  return ["<Invoices>", buildInvoiceEntry(data), "</Invoices>"].join("\n");
}

export function buildInvoiceEntry(data: typeof initialInvoice) {
  const esc = (v: string | number) =>
    String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  const tag = (name: string, value: string | number) => `<${name}>${esc(value)}</${name}>`;
  const cdata = (name: string, value: string) =>
    value ? `<${name}><![CDATA[${value.replace(/\]\]>/g, "]]]]><![CDATA[>")}]]></${name}>` : `<${name}></${name}>`;
  const indent = (depth: number, s: string) => `${"  ".repeat(depth)}${s}`;
  const fmtDate = (d: string) => {
    if (!d) return "";
    const p = d.split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
  };

  const products = data.products.map((p, i) => {
    const rate = Number(p.vat);
    return { ...p, no: i + 1, rate, ...calculateProduct(p) };
  });

  const { total, vat, amount } = calculateInvoice(data);

  const productXml = products.map((p) => [
    indent(4, "<Product>"),
    indent(5, tag("No", p.no)),
    indent(5, tag("Code", p.code)),
    indent(5, cdata("ProdName", p.name)),
    indent(5, tag("ProdUnit", p.unit)),
    indent(5, tag("ProdQuantity", p.quantity)),
    indent(5, tag("ProdPrice", p.price)),
    indent(5, tag("Total", p.total)),
    indent(5, tag("DiscountAmount", p.discountAmount ?? 0)),
    indent(5, tag("VATRate", p.rate)),
    indent(5, tag("VATAmount", p.vatAmount)),
    indent(5, tag("Amount", p.amount)),
    indent(5, tag("Extra", normalizeExtra(p.extra))),
    ...(p.feature ? [indent(5, tag("Feature", p.feature))] : []),
    ...(p.vat === -3 ? [indent(5, tag("VATRateOther", p.vatRateOther))] : []),
    indent(5, tag("Discount", p.discount)),
    indent(4, "</Product>"),
  ].join("\n")).join("\n");


  return [
    "  <Inv>",
    "    <Invoice>",
    indent(3, tag("Ikey", data.ikey)),
    indent(3, tag("Fkey", data.fkey || "")),
    indent(3, `<InvNo/>`),
    indent(3, tag("CusCode", data.customerCode.replace(/\s/g, ""))),
    indent(3, cdata("Buyer", data.buyer)),
    indent(3, tag("CusName", data.customer)),
    indent(3, cdata("CusAddress", data.address)),
    indent(3, tag("CusBankName", data.bankName || "")),
    indent(3, tag("CusBankNo", data.bankNo || "")),
    indent(3, tag("CusPhone", data.phone || "")),
    indent(3, tag("CusTaxCode", data.tax.replace(/\s/g, ""))),
    indent(3, tag("Email", data.email)),
    indent(3, tag("CusEmails", data.customerEmails)),
    indent(3, tag("EmailCC", data.emailCC)),
    indent(3, tag("PaymentMethod", data.payment)),
    indent(3, tag("ArisingDate", fmtDate(data.date))),
    indent(3, tag("CurrencyUnit", data.currency)),
    ...([
      ["BudgetaryRelationshipCode", data.budgetaryRelationshipCode], ["ComAddress", data.comAddress],
      ["Note", data.note], ["ProfileCode", data.profileCode], ["PayOrderOrgTaxCode", data.payOrderOrgTaxCode],
      ["PayOrderOrgName", data.payOrderOrgName], ["PayOrderOrgAddress", data.payOrderOrgAddress],
      ["Discount", data.discount], ["TaxFreeDeductions", data.taxFreeDeductions],
      ["TaxAuthorityCode", data.pattern.trim().toUpperCase()[4] === "M" ? data.taxAuthorityCode : ""],
    ] as const).filter(([, value]) => value !== "").map(([key, value]) => indent(3, tag(key, value))),
    ...(data.exchangeRate ? [indent(3, tag("ExchangeRate", data.exchangeRate))] : []),
    ...([
      ["StoreCode", data.storeCode], ["StoreName", data.storeName],
      ["ProvinceCode", data.provinceCode], ["ProvinceName", data.provinceName],
      ["CommuneCode", data.communeCode], ["CommuneName", data.communeName],
    ] as const).filter(([, value]) => value).map(([key, value]) => indent(3, tag(key, value))),
    ...(data.listAttachNum ? [indent(3, tag("ListAttachNum", data.listAttachNum))] : []),
    ...(data.listAttachDate ? [indent(3, tag("ListAttachDate", fmtDate(data.listAttachDate)))] : []),
    "      <Products>",
    productXml,
    "      </Products>",
    indent(3, tag("Total", total)),
    indent(3, tag("DiscountAmount", data.discountAmount || 0)),
    indent(3, tag("VATRate", Number(data.vatRate))),
    ...(data.vatRate === -3 ? [indent(3, tag("VATRateOther", data.vatRateOther))] : []),
    indent(3, tag("VATAmount", vat)),
    indent(3, tag("Amount", amount)),
    indent(3, tag("AmountInWords", data.amountInWords)),
    ...(data.extra ? [indent(3, tag("Extra", normalizeExtra(data.extra)))] : []),
    ...(data.identification ? [indent(3, tag("CusIdentification", data.identification))] : []),
    indent(3, tag("PassportNo", data.passportNo)),
    ...(data.locationCode ? [indent(3, tag("LocationCode", data.locationCode))] : []),
    ...(data.locationName ? [indent(3, tag("LocationName", data.locationName))] : []),
    ...(data.locationAddress ? [indent(3, tag("LocationAddress", data.locationAddress))] : []),
    ...(data.fees.length ? [indent(3, "<InvoiceFees>"), ...data.fees.map((fee) => [
      indent(4, "<InvoiceFee>"), indent(5, tag("Name", fee.name)), indent(5, tag("Amount", fee.amount)),
      ...([["FeeRate", fee.feeRate], ["VATRate", fee.vatRate], ["VATRateOther", fee.vatRateOther], ["VATAmount", fee.vatAmount], ["TotalCharge", fee.totalCharge]] as const)
        .filter(([, value]) => value !== "").map(([key, value]) => indent(5, tag(key, value))),
      indent(4, "</InvoiceFee>"),
    ].join("\n")), indent(3, "</InvoiceFees>")] : []),
    "    </Invoice>",
    "  </Inv>",
  ].filter(Boolean).join("\n");
}


export type InvoiceInput = typeof initialInvoice;

export function createEmptyInvoice(): InvoiceInput {
  const empty = structuredClone(initialInvoice);
  for (const key of Object.keys(empty) as (keyof InvoiceInput)[]) {
    if (typeof empty[key] === "string") Reflect.set(empty, key, "");
  }
  empty.profile = "tt78"; empty.specialInvoice = "0"; empty.currency = "VND";
  empty.products = [{ ...initialInvoice.products[0], code: "", name: "", unit: "", quantity: 0, price: 0 }];
  return empty;
}

// JSON object được gửi thành chuỗi JSON gọn; nội dung thường vẫn giữ nguyên.
export function normalizeExtra(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return JSON.stringify(parsed);
  } catch { /* Cho phép ghi chú văn bản. */ }
  return value;
}
