const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const path = require("node:path");
const cache = new Map();
let upstreamFetch;
const testEnv = {
  SOFTDREAMS_BASE_URL: "https://test7802.softdreams.vn",
  SOFTDREAMS_USERNAME: "test-user",
  SOFTDREAMS_PASSWORD: "test-password",
};
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (name) => name === "server-only" ? {} : name.startsWith("node:") ? require(name) : load(name.startsWith("@/") ? name.slice(2) + ".ts" : path.resolve(path.dirname(file), name + ".ts"));
  vm.runInNewContext(code, { module, exports: module.exports, require: localRequire, process: { env: testEnv }, Buffer, URL, Headers, Request, Response, AbortController, performance, setTimeout, clearTimeout, fetch: (...args) => upstreamFetch(...args) }, { filename: file });
  return module.exports;
}
async function main() {
  // Fixtures kiểm tra quy tắc nghiệp vụ DOM; phân tích cú pháp XML do DOMParser của browser đảm nhiệm.
  const { validateXmlDocument } = load("lib/softdreams/validate-xml.ts");
  const element = (tagName, content = []) => ({
    tagName, namespaceURI: null,
    children: Array.isArray(content) ? content : [],
    textContent: typeof content === "string" ? content : "",
  });
  const field = (tag, value) => element(tag, String(value));
  const product = () => element("Product", [
    field("ProdName", "Dịch vụ"), field("Feature", "1"), field("ProdQuantity", 1),
    field("ProdPrice", 100), field("VATRate", 10), field("Total", 100), field("VATAmount", 10), field("Amount", 110),
  ]);
  const fixtureInvoice = () => element("Invoice", [
    field("Ikey", "one"), field("PaymentMethod", "TM/CK"), field("ArisingDate", "19/11/2026"),
    field("CusName", "Khách hàng"), field("CurrencyUnit", "VND"), field("AmountInWords", "Một trăm mười đồng"),
    element("Products", [product()]), field("VATRate", 10),
    field("Total", 100), field("VATAmount", 10), field("Amount", 110),
  ]);
  const fixtureDocument = (invoices) => ({ documentElement: element("Invoices", invoices.map((invoice) => element("Inv", [invoice]))) });
  const noConditions = { household: false, businessCustomer: false, specialGoods: false };
  assert.equal(validateXmlDocument(fixtureDocument([fixtureInvoice()]), noConditions).issues.length, 0);
  let invalid = fixtureInvoice();
  invalid.children = invalid.children.filter((child) => child.tagName !== "Ikey");
  assert.ok(validateXmlDocument(fixtureDocument([invalid]), noConditions).issues.some((issue) => issue.path.endsWith("/Ikey") && issue.level === "error"));
  invalid = fixtureInvoice();
  invalid.children.push(field("ArisingDate", "31/02/2026"), field("UnknownTag", "bad"));
  let xmlReport = validateXmlDocument(fixtureDocument([invalid]), noConditions);
  assert.ok(xmlReport.issues.some((issue) => issue.message.includes("lặp")));
  assert.ok(xmlReport.issues.some((issue) => issue.path.endsWith("/UnknownTag")));
  invalid = fixtureInvoice();
  invalid.children.find((child) => child.tagName === "ArisingDate").textContent = "31/02/2026";
  assert.ok(validateXmlDocument(fixtureDocument([invalid]), noConditions).issues.some((issue) => issue.path.endsWith("/ArisingDate")));
  invalid = fixtureInvoice();
  invalid.children.find((child) => child.tagName === "Amount").textContent = "999";
  assert.ok(validateXmlDocument(fixtureDocument([invalid]), noConditions).issues.some((issue) => issue.path.endsWith("/Amount") && issue.level === "warning"));
  xmlReport = validateXmlDocument(fixtureDocument([fixtureInvoice(), fixtureInvoice()]), { household: true, businessCustomer: true, specialGoods: true });
  assert.ok(xmlReport.issues.some((issue) => issue.message.includes("trùng")));
  for (const tag of ["LocationCode", "CusTaxCode", "ProvinceCode", "CommuneName"]) {
    assert.ok(xmlReport.issues.some((issue) => issue.path.endsWith("/" + tag)));
  }
  const { getSoftdreamsDomain, softdreamsEndpoint } = load("lib/softdreams/config.server.ts");
  testEnv.SOFTDREAMS_BASE_URL = "https://changed.example/";
  assert.equal(getSoftdreamsDomain(), "https://changed.example");
  assert.equal(softdreamsEndpoint("invoice"), "https://changed.example/api/publish/importInvoice");
  testEnv.SOFTDREAMS_BASE_URL = "https://changed.example/unexpected-path";
  assert.throws(() => getSoftdreamsDomain());
  testEnv.SOFTDREAMS_BASE_URL = "https://test7802.softdreams.vn";
  const { createAuthen } = load("lib/softdreams/auth.server.ts");
  const nonce = "AbCdEf0123456789AbCdEf0123456789AB";
  const timestamp = 1795000000;
  const generated = createAuthen("post", timestamp, nonce);
  const signature = require("node:crypto").createHash("md5").update("POST" + timestamp + nonce).digest("base64");
  assert.equal(generated.split(":")[0], signature);
  assert.equal(generated.split(":")[1], nonce);
  assert.equal(generated.split(":")[2], String(timestamp));
  assert.equal(generated.split(":")[3], "test-user");
  assert.equal(generated.split(":")[4], "test-password");
  testEnv.SOFTDREAMS_PASSWORD = "changed-password";
  assert.equal(createAuthen("POST", timestamp, nonce).split(":")[4], "changed-password");
  delete testEnv.SOFTDREAMS_PASSWORD;
  assert.throws(() => createAuthen("POST"));
  testEnv.SOFTDREAMS_PASSWORD = "test-password";
  assert.match(createAuthen("POST").split(":")[1], /^[A-Za-z0-9]{32}$/);
  assert.notEqual(createAuthen("POST"), createAuthen("POST"));
  const { initialInvoice, buildInvoice } = load("lib/softdreams/invoice.ts");
  const { validateInvoice } = load("lib/softdreams/validate.ts");
  const { POST } = load("app/api/invoice-drafts/route.ts");
  const invoice = structuredClone(initialInvoice);
  invoice.date = "2026-11-11";
  invoice.buyer = "a]]>b";
  let xml = buildInvoice(validateInvoice(invoice));
  assert.ok(xml.includes("<ArisingDate>11/11/2026</ArisingDate>"));
  assert.ok(xml.includes("<VATAmount>0</VATAmount>"));
  assert.ok(xml.includes("]]]]><![CDATA[>"));
  assert.ok(!xml.includes("<Pattern>"));
  invoice.extra = '{ "note": "A & B", "count": 2 }';
  invoice.products[0].extra = '{"item":"value"}';
  invoice.customerEmails = "a@example.com,b@example.com";
  invoice.passportNo = "P12345";
  xml = buildInvoice(validateInvoice(invoice));
  assert.ok(xml.includes('<Extra>{&quot;note&quot;:&quot;A &amp; B&quot;,&quot;count&quot;:2}</Extra>'));
  assert.ok(xml.includes("<PassportNo>P12345</PassportNo>"));
  assert.ok(xml.includes("<CusEmails>a@example.com,b@example.com</CusEmails>"));
  assert.ok(xml.includes('<Extra>{&quot;item&quot;:&quot;value&quot;}</Extra>'));
  invoice.products[0].discountAmount = 100000;
  xml = buildInvoice(validateInvoice(invoice));
  assert.ok(xml.includes("<Total>900000</Total>"));
  assert.throws(() => validateInvoice({ ...invoice, date: "2026-02-30" }));
  const makeRequest = (value) => new Request("http://localhost/api/invoice-drafts", {
    method: "POST", headers: { "Content-Type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({ invoice: value, auth: { type: "basic", secret: "user:pass" }, domain: "https://attacker.invalid" }),
  });
  let calls = 0;
  upstreamFetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://test7802.softdreams.vn/api/publish/importInvoice");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.get("Authorization"), null);
    const authen = options.headers.get("Authentication");
    assert.ok(authen);
    const parts = authen.split(":");
    assert.equal(parts.length, 5);
    assert.match(parts[1], /^[A-Za-z0-9]{32}$/);
    assert.ok(Math.abs(Number(parts[2]) - Math.floor(Date.now() / 1000)) <= 2);
    assert.equal(authen, createAuthen("POST", Number(parts[2]), parts[1]));
    const payload = JSON.parse(options.body);
    assert.equal(payload.Pattern, invoice.pattern);
    assert.equal(payload.Serial, "");
    assert.equal(payload.Convert, 0);
    assert.equal(payload.updateCus, true);
    assert.equal(payload.XmlData, xml);
    return new Response(JSON.stringify({ Status: 4, ErrorCode: 1, Data: { KeyInvoiceMsg: { test: "Lỗi" } } }), { status: 200 });
  };
  const result = await (await POST(makeRequest(invoice))).json();
  assert.equal(result.status, 200);
  assert.equal(result.ok, false);
  assert.ok(result.body.includes("KeyInvoiceMsg"));
  upstreamFetch = async () => new Response(JSON.stringify({ Status: "2", ErrorCode: "0" }));
  assert.equal((await (await POST(makeRequest(invoice))).json()).ok, true);
  assert.equal((await POST(makeRequest({ ...invoice, ikey: "" }))).status, 400);
  upstreamFetch = async () => { throw new Error("network"); };
  assert.equal((await POST(makeRequest(invoice))).status, 502);
  assert.equal(calls, 1);
  // Regression theo docs/importInvoice_validate.md (TT78/Receipt).
  const fresh = () => ({ ...structuredClone(initialInvoice), date: "2026-11-19" });
  let rules = fresh();
  rules.pattern = ""; rules.serial = ""; rules.date = "";
  assert.doesNotThrow(() => validateInvoice(rules));
  rules = fresh(); rules.amountInWords = "";
  assert.throws(() => validateInvoice(rules), /amountInWords/);
  rules = fresh(); rules.tax = "12345";
  assert.throws(() => validateInvoice(rules), /tax/);
  rules = fresh(); rules.buyer = ""; rules.customer = ""; rules.tax = "";
  assert.throws(() => validateInvoice(rules), /customer/);
  rules = fresh(); rules.date = "2025-11-19";
  assert.throws(() => validateInvoice(rules), /date/);
  rules = fresh(); rules.vatRate = -3; rules.products[0].vat = -3;
  assert.throws(() => validateInvoice(rules), /vatRateOther/);
  rules.vatRateOther = "7.25"; rules.products[0].vatRateOther = "7.25";
  assert.doesNotThrow(() => validateInvoice(rules));
  assert.ok(buildInvoice(rules).includes("<VATRateOther>7.25</VATRateOther>"));
  rules = fresh(); rules.vatRate = -5;
  assert.throws(() => validateInvoice(rules), /CTTC/);
  rules.products[0].vat = -5;
  assert.doesNotThrow(() => validateInvoice(rules));
  for (const rate of [-7, -6, -2, -1, 0, 5, 8, 10]) {
    rules = fresh(); rules.vatRate = rate; rules.products[0].vat = rate;
    assert.doesNotThrow(() => validateInvoice(rules));
  }
  rules = fresh(); rules.products[0].discount = 101;
  assert.throws(() => validateInvoice(rules), /100%/);
  rules = fresh(); rules.products[0].feature = "5";
  assert.throws(() => validateInvoice(rules), /Feature 5/);
  rules.specialInvoice = "2"; rules.products[0].extra = '{"BKSPTVChuyen":"29A-12345"}';
  assert.doesNotThrow(() => validateInvoice(rules));
  rules = fresh(); rules.products[0].extra = '{"SKhung":"test"}';
  assert.throws(() => validateInvoice(rules), /đặc trưng/);
  rules = fresh(); rules.products[0].amountOverride = "123.45";
  assert.ok(buildInvoice(validateInvoice(rules)).includes("<Amount>123.45</Amount>"));
  rules = fresh(); rules.products.push({ ...rules.products[0], feature: "3", price: 100000 });
  assert.ok(buildInvoice(validateInvoice(rules)).includes("<Total>900000</Total>"));
  rules = fresh(); rules.profile = "receipt"; rules.currency = "USD";
  assert.throws(() => validateInvoice(rules), /VND/);
  rules.currency = "VND"; rules.products[0].feature = "3";
  assert.throws(() => validateInvoice(rules), /Biên lai/);
  rules = fresh(); rules.fees.push({ name: "Phí", amount: "100", feeRate: "", vatRate: "", vatRateOther: "", vatAmount: "", totalCharge: "" });
  assert.ok(buildInvoice(validateInvoice(rules)).includes("<InvoiceFee>"));
  assert.ok(!buildInvoice(rules).includes("<BusinessProdGroupCode>"));
  assert.ok(!buildInvoice(rules).includes("<Gross>"));
  rules = fresh(); rules.tax = "010 1234567"; rules.pattern = " 1c26ttr ";
  assert.equal(validateInvoice(rules).tax, "0101234567");
  assert.equal(validateInvoice(rules).pattern, "1C26TTR");
  rules = fresh(); rules.products[0].feature = "";
  assert.ok(!buildInvoice(validateInvoice(rules)).includes("<Feature>"));
  rules = fresh(); rules.specialInvoice = "1";
  assert.throws(() => validateInvoice(rules), /provinceCode/);
  rules = fresh(); rules.products[0].vatRateOther = "100"; rules.products[0].vat = -3;
  assert.throws(() => validateInvoice(rules), /99.99/);
  console.log("PASS: XML, validation, fixed endpoint, auth, business errors, success, network failure. No external requests.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
