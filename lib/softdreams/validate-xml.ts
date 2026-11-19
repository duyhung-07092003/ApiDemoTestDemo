export type XmlIssue = { level: "error" | "warning"; path: string; message: string; suggestion: string };
export type XmlOptions = { household: boolean; businessCustomer: boolean; specialGoods: boolean };
export type XmlReport = { issues: XmlIssue[]; invoices: number; formatted: string; normalizedXml?: string; extractedFromRequest?: boolean };
const children = (node: Element, name: string) => Array.from(node.children).filter((child) => child.tagName === name);
const text = (node: Element, name: string) => children(node, name)[0]?.textContent?.trim() || "";
const invoiceTags = new Set(("Ikey Fkey InvNo LocationCode LocationName LocationAddress StoreCode StoreName CusCode Buyer CusName CusEmails Email EmailCC CusAddress CusBankName CusBankNo CusPhone CusTaxCode CusIdentification PassportNo ProvinceCode ProvinceName CommuneCode CommuneName PaymentMethod ArisingDate ExchangeRate CurrencyUnit Extra Products Total VATRate VATRateOther VATAmount Amount Discount DiscountAmount AmountInWords ListAttachNum ListAttachDate GrossValue GrossValue0 GrossValue5 GrossValue8 GrossValue10 GrossValueNDeclared GrossValueContractor VatAmount0 VatAmount5 VatAmount8 VatAmount10 VatAmountNDeclared VatAmountContractor Amount0 Amount5 Amount8 Amount10 AmountNDeclared AmountOther GrossCTTC VatAmountCTTC AmountCTTC").split(" "));
const productTags = new Set("Code No Feature IsSum ProdName ProdUnit ProdQuantity ProdPrice Discount DiscountAmount Total VATRate VATRateOther VATAmount Amount Extra".split(" "));
for (const name of "PaymentType PaymentStatus BudgetaryRelationshipCode TaxFreeDeductions ComAddress TaxAuthorityCode Note ProfileCode PayOrderOrgTaxCode PayOrderOrgName PayOrderOrgAddress InvoiceFees VatAmountNoVAT AmountNoVAT GrossKTPVDC VatAmountKTPVDC AmountKTPVDC GrossKTGTT VatAmountKTGTT AmountKTGTT".split(" ")) invoiceTags.add(name);

// Không dùng regex để phân tích XML; DOMParser kiểm tra cú pháp trước khi chạy nghiệp vụ.
export function validateXmlDocument(document: Document, options: XmlOptions): XmlReport {
  const issues: XmlIssue[] = [];
  const add = (level: XmlIssue["level"], path: string, message: string, suggestion: string) => issues.push({ level, path, message, suggestion });
  const error = (path: string, message: string, suggestion: string) => add("error", path, message, suggestion);
  const warn = (path: string, message: string, suggestion: string) => add("warning", path, message, suggestion);
  const root = document.documentElement;
  if (!root || root.tagName !== "Invoices" || root.namespaceURI) {
    error("/", "Thẻ gốc phải là Invoices và không có namespace.", "Dùng <Invoices><Inv><Invoice>...</Invoice></Inv></Invoices>.");
    return { issues, invoices: 0, formatted: "" };
  }
  const required = (node: Element, name: string, path: string) => {
    if (!text(node, name)) error(path + "/" + name, "Thiếu hoặc rỗng thẻ " + name + ".", "Bổ sung giá trị cho <" + name + ">.");
  };
  const inspect = (node: Element, allowed: Set<string>, path: string) => {
    const seen = new Set<string>();
    for (const child of Array.from(node.children)) {
      const childPath = path + "/" + child.tagName;
      if (!allowed.has(child.tagName) || child.namespaceURI) error(childPath, "Thẻ không đúng tên hoặc sai vị trí.", "Kiểm tra chữ hoa/thường và chuyển thẻ về đúng cấp theo tài liệu importInvoice.");
      if (seen.has(child.tagName)) error(childPath, "Thẻ bị lặp.", "Giữ một thẻ " + child.tagName + " tại cấp này.");
      seen.add(child.tagName);
      if (!["Products", "InvoiceFees"].includes(child.tagName) && child.children.length) error(childPath, "Thẻ dữ liệu có thẻ con không hợp lệ.", "Escape ký tự <, >, & hoặc dùng CDATA cho nội dung.");
    }
  };
  const number = (node: Element, name: string, path: string, mandatory = true) => {
    const value = text(node, name);
    if (!value && !mandatory) return undefined;
    if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value))) {
      error(path + "/" + name, "Cần giá trị số hợp lệ.", "Dùng dấu chấm thập phân, không dùng dấu phân cách hàng nghìn.");
      return undefined;
    }
    return Number(value);
  };
  const compare = (path: string, actual: number | undefined, expected: number | undefined, label: string) => {
    if (actual !== undefined && expected !== undefined && Math.abs(actual - expected) > 0.01) {
      warn(path, label + ": đang là " + actual + ", đối chiếu ra " + Number(expected.toFixed(4)) + ".", "Kiểm tra chiết khấu, loại dòng Feature và quy tắc làm tròn; điều chỉnh giá trị theo nghiệp vụ thực tế.");
    }
  };
  const date = (node: Element, name: string, path: string) => {
    const value = text(node, name);
    if (!value) return;
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
    const iso = match ? match[3] + "-" + match[2] + "-" + match[1] : "";
    if (!match || !Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso) error(path + "/" + name, "Ngày không hợp lệ hoặc sai định dạng.", "Dùng dd/MM/yyyy, ví dụ 19/11/2026.");
  };
  const extra = (node: Element, path: string) => {
    const value = text(node, "Extra");
    if (!value) return;
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    } catch { if (value.startsWith("{")) warn(path + "/Extra", "Extra có dạng JSON nhưng chưa hợp lệ.", 'Sửa JSON hoặc giữ dưới dạng ghi chú; hóa đơn thường cho phép chuỗi văn bản.'); }
  };
  for (const child of Array.from(root.children)) {
    if (child.tagName !== "Inv") error("/Invoices/" + child.tagName, "Invoices chỉ chứa các thẻ Inv.", "Bọc mỗi Invoice trong một Inv.");
  }
  const wrappers = children(root, "Inv");
  if (!wrappers.length) error("/Invoices", "Chưa có hóa đơn.", "Thêm ít nhất một <Inv><Invoice>...</Invoice></Inv>.");
  if (wrappers.length > 5000) error("/Invoices", "Vượt giới hạn 5000 hóa đơn/request.", "Chia thành nhiều request tối đa 5000 hóa đơn.");
  const keys = new Set<string>();
  let count = 0;
  wrappers.forEach((wrapper, index) => {
    const path = "/Invoices/Inv[" + (index + 1) + "]/Invoice";
    const invoices = children(wrapper, "Invoice");
    if (invoices.length !== 1 || Array.from(wrapper.children).some((child) => !["Invoice", "key"].includes(child.tagName))) error(path, "Mỗi Inv cần một Invoice, có thể kèm thẻ key.", "Tách từng Invoice thành một Inv riêng.");
    invoices.forEach((invoice) => {
      count++;
      inspect(invoice, invoiceTags, path);
      if (!text(invoice, "Ikey") && !text(wrapper, "key")) required(invoice, "Ikey", path);
      required(invoice, "PaymentMethod", path);
      const key = text(invoice, "Ikey") || text(wrapper, "key");
      if (key && keys.has(key)) error(path + "/Ikey", "Ikey bị trùng trong XML.", "Dùng Ikey duy nhất cho mỗi hóa đơn.");
      keys.add(key);
      if (!text(invoice, "ArisingDate")) warn(path + "/ArisingDate", "Không có ngày phát sinh; API mặc định ngày hiện tại.", "Bổ sung ngày nếu cần xác định chính xác ngày lập.");
      date(invoice, "ArisingDate", path);
      date(invoice, "ListAttachDate", path);
      if (options.household) for (const name of ["LocationCode", "LocationName", "LocationAddress"]) required(invoice, name, path);
      if (options.businessCustomer) required(invoice, "CusTaxCode", path);
      if (options.specialGoods) for (const name of ["CusName", "CusAddress", "CusPhone", "CusTaxCode", "ProvinceCode", "ProvinceName", "CommuneCode", "CommuneName"]) required(invoice, name, path);
      required(invoice, "CurrencyUnit", path);
      required(invoice, "AmountInWords", path);
      if (!text(invoice, "Buyer") && !text(invoice, "CusName")) required(invoice, "CusName", path);
      if (text(invoice, "CusTaxCode")) { required(invoice, "CusName", path); required(invoice, "CusAddress", path); }
      if (children(invoice, "PaymentType").length && !text(invoice, "PaymentType")) error(path + "/PaymentType", "PaymentType rỗng có thể gây lỗi 500.", "Bỏ thẻ hoặc gửi số nguyên.");
      if (text(invoice, "InvNo") && Number(text(invoice, "InvNo")) !== 0) warn(path + "/InvNo", "Import tạo hóa đơn nháp chưa cấp số.", "Để InvNo rỗng hoặc 0 theo mẫu; không coi đây là thao tác phát hành.");
      extra(invoice, path);
      if (text(invoice, "ExchangeRate")) {
        const rate = number(invoice, "ExchangeRate", path);
        if (rate !== undefined && rate <= 0) error(path + "/ExchangeRate", "Tỷ giá phải lớn hơn 0.", "Nhập tỷ giá hợp lệ.");
      }
      const checkVat = (node: Element, nodePath: string) => {
        const rate = number(node, "VATRate", nodePath, false) ?? (node !== invoice ? number(invoice, "VATRate", path, false) : undefined);
        if (rate === -3) {
          const other = number(node, "VATRateOther", nodePath);
          if (other !== undefined && (other < 0 || other > 99.99 || !/^\d{1,2}(?:\.\d{1,2})?$/.test(text(node, "VATRateOther")))) error(nodePath + "/VATRateOther", "Thuế suất khác cần từ 0 đến 99.99, tối đa 2 số thập phân.", "Nhập VATRateOther theo phần trăm.");
        } else if (rate !== undefined && ![-7, -6, -5, -3, -2, -1, 0, 5, 8, 10].includes(rate)) {
          warn(nodePath + "/VATRate", "Mã thuế suất chưa có quy tắc đối chiếu trong bộ kiểm tra.", "Đối chiếu phụ lục VII.3 của mẫu hóa đơn; không tự đổi mã thuế.");
        }
        return rate;
      };
      checkVat(invoice, path);
      const containers = children(invoice, "Products");
      const products = containers[0] ? children(containers[0], "Product") : [];
      if (!products.length) error(path + "/Products", "Không có dòng Product.", "Bổ sung <Products><Product>...</Product></Products>.");
      if (containers[0]) for (const child of Array.from(containers[0].children)) if (child.tagName !== "Product") error(path + "/Products/" + child.tagName, "Thẻ con của Products phải là Product.", "Đổi tên hoặc chuyển thẻ về đúng vị trí.");
      let sumTotal = 0, sumVat = 0, sumAmount = 0, canSum = true;
      products.forEach((product, i) => {
        const pp = path + "/Products/Product[" + (i + 1) + "]";
        inspect(product, productTags, pp);
        required(product, "ProdName", pp);
        const total = number(product, "Total", pp, false);
        const vat = number(product, "VATAmount", pp, false);
        const amount = number(product, "Amount", pp);
        const rate = checkVat(product, pp);
        if (rate === undefined) error(pp + "/VATRate", "Thiếu VATRate ở cả dòng và hóa đơn.", "Gửi VATRate tại dòng hoặc cấp Invoice.");
        if (rate !== undefined && !Number.isInteger(rate)) error(pp + "/VATRate", "VATRate dòng phải là số nguyên.", "Dùng mã -7,-6,-5,-3,-2,-1,0,5,8,10.");
        const feature = text(product, "Feature");
        if (feature && !["1", "2", "3", "4", "5"].includes(feature)) error(pp + "/Feature", "Feature không hợp lệ.", "Chọn 1–5 hoặc bỏ thẻ để API tự suy.");
        const discountPercent = number(product, "Discount", pp, false);
        if (discountPercent !== undefined && discountPercent > 100) error(pp + "/Discount", "Discount vượt 100%, có thể gây lỗi lưu 500.", "Giảm tỷ lệ chiết khấu xuống tối đa 100%.");
        const quantity = number(product, "ProdQuantity", pp, false);
        const price = number(product, "ProdPrice", pp, false);
        const discount = number(product, "DiscountAmount", pp, false);
        extra(product, pp);
        // Chỉ tính đối chiếu dòng hàng thông thường; chưa suy diễn quy tắc các Feature đặc biệt.
        if (text(product, "Feature") === "1") {
          compare(pp + "/Total", total, quantity !== undefined && price !== undefined ? quantity * price - (discount ?? 0) : undefined, "Total lệch số lượng × đơn giá − chiết khấu");
          compare(pp + "/Amount", amount, total !== undefined && vat !== undefined ? total + vat : undefined, "Amount lệch Total + VATAmount");
          if (rate !== undefined && [0, 5, 8, 10].includes(rate)) compare(pp + "/VATAmount", vat, total !== undefined ? total * rate / 100 : undefined, "Tiền thuế lệch đối chiếu");
        } else {
          canSum = false;
          warn(pp + "/Feature", "Chưa đối chiếu phép tính của dòng Feature này.", "Kiểm tra loại dòng theo phụ lục V.11, đặc biệt dòng chiết khấu/ghi chú.");
        }
        if (total === undefined || vat === undefined || amount === undefined) canSum = false;
        sumTotal += total ?? 0; sumVat += vat ?? 0; sumAmount += amount ?? 0;
      });
      const total = number(invoice, "Total", path);
      const vat = number(invoice, "VATAmount", path, false);
      const amount = number(invoice, "Amount", path);
      if (canSum && products.length) {
        compare(path + "/Total", total, sumTotal, "Total lệch tổng dòng hàng");
        compare(path + "/VATAmount", vat, sumVat, "VATAmount lệch tổng dòng hàng");
        compare(path + "/Amount", amount, sumAmount, "Amount lệch tổng dòng hàng");
      }
    });
  });
  return { issues, invoices: count, formatted: "" };
}

export function validateXmlData(source: string, options: XmlOptions): XmlReport {
  const fail = (message: string, suggestion: string): XmlReport => ({ issues: [{ level: "error", path: "/", message, suggestion }], invoices: 0, formatted: "" });
  if (!source.trim()) return fail("Chưa nhập XmlData.", "Dán XML bắt đầu bằng <Invoices>.");
  const unescapeTagSlashes = (value: string) => value.replace(/\\([<>])/g, "$1");
  let input = unescapeTagSlashes(source.trim().replace(/^\uFEFF/, ""));
  let extractedFromRequest = false;
  const requestLine = /^(?:POST|PUT|PATCH|GET)\s+\S+/i.test(input);
  if (!input.startsWith("<")) {
    let jsonText = input;
    if (requestLine) {
      const headerEnd = input.search(/\r?\n\r?\n/);
      if (headerEnd >= 0) jsonText = input.slice(headerEnd).replace(/^\r?\n\r?\n/, "").trim();
      else {
        const bodyStart = input.search(/\r?\n\s*\{/);
        if (bodyStart >= 0) jsonText = input.slice(bodyStart).trim();
      }
    }
    try {
      const requestBody: unknown = JSON.parse(jsonText);
      if (requestBody && typeof requestBody === "object" && !Array.isArray(requestBody) && typeof (requestBody as Record<string, unknown>).XmlData === "string") {
        input = unescapeTagSlashes((requestBody as { XmlData: string }).XmlData.trim());
        extractedFromRequest = true;
      }
    } catch { /* Keep malformed JSON/request text for a useful format error below. */ }
    if (!input.startsWith("<")) {
      return fail(
        "Không tìm thấy XML bắt đầu bằng < hoặc trường XmlData trong request JSON.",
        "Dán XML thuần, JSON có trường XmlData, hoặc toàn bộ request HTTP gồm POST, headers và JSON body.",
      );
    }
  }
  if (new TextEncoder().encode(input).length > 2 * 1024 * 1024) return fail("XML vượt giới hạn kiểm tra 2 MB.", "Chia thành các phần nhỏ hơn.");
  if (/<!DOCTYPE|<!ENTITY/i.test(input)) return fail("Không hỗ trợ DOCTYPE/ENTITY.", "Dùng XML hóa đơn thuần, không khai báo thực thể ngoài.");
  const document = new DOMParser().parseFromString(input, "application/xml");
  const parseError = document.querySelector("parsererror");
  if (parseError) return fail("XML sai cú pháp: " + (parseError.textContent || "").slice(0, 1000), "Sửa thẻ đóng/mở, ký tự & hoặc CDATA ở vị trí trình phân tích thông báo.");
  return { ...validateXmlDocument(document, options), normalizedXml: input, extractedFromRequest };
}
