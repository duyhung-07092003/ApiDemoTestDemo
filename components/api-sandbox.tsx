"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Braces,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Moon,
  Play,
  Plus,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { ResponsePanel, HighlightedJson } from "./response-panel";
import { DateInput } from "./date-input";
import { XmlValidator } from "./xml-validator";
import { InvoiceOptions, InvoiceAdvanced } from "./invoice-options";
import { SpecialExtraFields } from "./special-extra-fields";
import { StyledSelect } from "./styled-select";
import { initialInvoice, buildInvoice, calculateInvoice, calculateProduct, createEmptyInvoice, VAT_RATES, FEATURES } from "@/lib/softdreams/invoice";
import { validateInvoice, invoiceIssues, INVOICE_LIMITS } from "@/lib/softdreams/validate";
import { SOFTDREAMS_APIS } from "@/lib/softdreams/endpoints";

type TemplateId =
  | "invoice"
  | "adjust-invoice"
  | "external-digest"
  | "lookup-invoices";
type AuthType = "none" | "bearer" | "basic" | "apikey";
const InvoiceValidationContext = createContext<Map<string, string[]>>(new Map());
type XmlScope = "invoice" | "product" | "fee";
type XmlSelection = { tag: string; scope: XmlScope; index?: number };
const XML_TAG_NAMES = [
  "PayOrderOrgAddress", "BudgetaryRelationshipCode", "PayOrderOrgTaxCode", "PayOrderOrgName", "TaxFreeDeductions",
  "CusIdentification", "AmountInWords", "DiscountAmount", "VATRateOther", "TotalCharge", "LocationAddress",
  "LocationCode", "LocationName", "CusBankName", "CusBankNo", "CusTaxCode", "CusAddress", "CusEmails", "CusPhone",
  "ProvinceCode", "ProvinceName", "CommuneCode", "CommuneName", "ListAttachNum", "ListAttachDate", "ProfileCode",
  "TaxAuthorityCode", "ExchangeRate", "StoreCode", "StoreName", "PaymentMethod", "ArisingDate", "CurrencyUnit",
  "ProdQuantity", "ProdPrice", "ProdName", "ProdUnit", "VATAmount", "VATRate", "Discount",
  "InvoiceFees", "InvoiceFee", "EmailCC",
  "Total", "Amount", "Extra", "Feature", "Fkey", "Ikey", "InvNo", "CusCode", "Buyer", "CusName", "Email",
  "Note", "ComAddress", "No", "Code", "PassportNo", "Name", "FeeRate",
].sort((a, b) => b.length - a.length);
function resolveXmlTag(label: string) { return XML_TAG_NAMES.find((tag) => label.includes(tag)); }
type Result = {
  status: number;
  statusText: string;
  duration: number;
  size: number;
  headers: Record<string, string>;
  body: string;
  ok: boolean;
  simulated?: boolean;
} | null;

const templates: {
  id: TemplateId;
  name: string;
  path: string;
  method: string;
}[] = [
  {
    id: "invoice",
    name: "Import hóa đơn",
    ...SOFTDREAMS_APIS.invoice,
  },
  {
    id: "adjust-invoice",
    name: "Điều chỉnh hóa đơn",
    ...SOFTDREAMS_APIS["adjust-invoice"],
  },
  {
    id: "external-digest",
    name: "Lấy digest để import",
    ...SOFTDREAMS_APIS["external-digest"],
  },
  {
    id: "lookup-invoices",
    name: "Tra cứu hóa đơn theo Ikeys",
    ...SOFTDREAMS_APIS["lookup-invoices"],
  },
];

function Help({ children }: { children: string }) {
  return (
    <span className="help-tip" tabIndex={0} aria-label={children}>
      <CircleHelp size={13} />
      <span role="tooltip">{children}</span>
    </span>
  );
}

function HighlightedXml({ text, selection }: { text: string; selection: XmlSelection | null }) {
  const segments = text.split(/(<\/?[A-Za-z_][\w:.-]*(?:\s[^<>]*?)?\/?>)/g);
  let insideElementValue = false;
  let productCount = -1;
  let feeCount = -1;
  let activeProduct: number | null = null;
  let activeFee: number | null = null;

  return (
    <>
      {segments.map((segment, index) => {
        const isTag = /^<\/?[A-Za-z_][\w:.-]*(?:\s[^<>]*?)?\/?>$/.test(segment);
        if (!isTag) {
          return insideElementValue && /\S/.test(segment) ? (
            <span className="xml-value" key={index}>
              {segment}
            </span>
          ) : (
            <span key={index}>{segment}</span>
          );
        }

        const isClosingTag = /^<\//.test(segment);
        const isSelfClosingTag = /\/>$/.test(segment);
        const tagName = segment.match(/^<\/?([A-Za-z_][\w:.-]*)/)?.[1];
        if (tagName === "Product") {
          if (isClosingTag) activeProduct = null;
          else { productCount += 1; activeProduct = productCount; }
        }
        if (tagName === "InvoiceFee") {
          if (isClosingTag) activeFee = null;
          else { feeCount += 1; activeFee = feeCount; }
        }
        const matchesScope = selection?.scope === "product" ? activeProduct === selection.index
          : selection?.scope === "fee" ? activeFee === selection.index
          : activeProduct === null && activeFee === null;
        const isFocused = tagName === selection?.tag && matchesScope;
        if (isClosingTag) insideElementValue = false;
        else if (!isSelfClosingTag) insideElementValue = true;

        return (
          <span className={`xml-tag${isFocused ? " xml-tag-focused" : ""}`} key={index}>
            {segment}
          </span>
        );
      })}
    </>
  );
}

function findRawXmlHighlightRanges(requestText: string, xmlText: string, selection: XmlSelection | null) {
  const bodyStart = requestText.indexOf("\n\n") + 2;
  const serializedXml = JSON.stringify(xmlText);
  const xmlValueStart = requestText.indexOf(serializedXml, bodyStart);
  if (bodyStart < 2 || xmlValueStart < 0) return [];
  const matches: Array<{ start: number; end: number; className: string }> = [];
  let productCount = -1;
  let feeCount = -1;
  let activeProduct: number | null = null;
  let activeFee: number | null = null;
  const segments = xmlText.split(/(<\/?[A-Za-z_][\w:.-]*(?:\s[^<>]*?)?\/?>)/g);
  let xmlOffset = 0;
  let insideElementValue = false;
  for (const segment of segments) {
    const isTag = /^<\/?[A-Za-z_][\w:.-]*(?:\s[^<>]*?)?\/?>$/.test(segment);
    let className: string | undefined;
    if (isTag) {
      const closing = /^<\//.test(segment);
      const selfClosing = /\/>$/.test(segment);
      const name = segment.match(/^<\/?([A-Za-z_][\w:.-]*)/)?.[1];
      if (name === "Product") {
        if (closing) activeProduct = null;
        else { productCount += 1; activeProduct = productCount; }
      }
      if (name === "InvoiceFee") {
        if (closing) activeFee = null;
        else { feeCount += 1; activeFee = feeCount; }
      }
      const matchesScope = selection?.scope === "product" ? activeProduct === selection.index
        : selection?.scope === "fee" ? activeFee === selection.index
        : activeProduct === null && activeFee === null;
      className = selection?.tag === name && matchesScope ? "json-focus" : "raw-xml-tag";
      if (closing) insideElementValue = false;
      else if (!selfClosing) insideElementValue = true;
    } else if (insideElementValue && /\S/.test(segment)) className = "raw-xml-value";
    if (className) {
      const start = xmlValueStart + JSON.stringify(xmlText.slice(0, xmlOffset)).length - 1;
      const end = xmlValueStart + JSON.stringify(xmlText.slice(0, xmlOffset + segment.length)).length - 1;
      matches.push({ start, end, className });
    }
    xmlOffset += segment.length;
  }
  return matches;
}

function findRawXmlValueRange(requestText: string, xmlText: string) {
  const bodyStart = requestText.indexOf("\n\n") + 2;
  const serializedXml = JSON.stringify(xmlText);
  const start = requestText.indexOf(serializedXml, bodyStart);
  return bodyStart >= 2 && start >= 0 ? { start, end: start + serializedXml.length } : undefined;
}

export function ApiSandbox({ domain }: { domain: string }) {
  const [workspaceView, setWorkspaceView] = useState<"request" | "xml">("request");
  const [template, setTemplate] = useState<TemplateId>("invoice");
  const [templateOpen, setTemplateOpen] = useState(false);
  const templateTriggerRef = useRef<HTMLButtonElement>(null);
  const templateOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const method: string = SOFTDREAMS_APIS[template].method;
  const selectedTemplate =
    templates.find((item) => item.id === template) ?? templates[0];
  const apiPath = selectedTemplate.path;
  const isInvoice = template === "invoice" || template === "adjust-invoice";
  const [auth, setAuth] = useState<AuthType>("none");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("x-api-key");
  const [invoice, setInvoice] = useState(initialInvoice);
  const [adjustment, setAdjustment] = useState({
    originalIkey: "inv-original-001",
    reason: "Điều chỉnh thông tin hóa đơn",
  });
  const [digest, setDigest] = useState({
    taxCode: "",
    fromDate: "",
    toDate: "",
  });
  const [invoiceKeys, setInvoiceKeys] = useState("inv-demo-2026-001");
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"request" | "xml" | "response">(
    "request",
  );
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [showConfig, setShowConfig] = useState(false);
  const [prettyPreview, setPrettyPreview] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState<"single" | "multi">("multi");
  const [focusedXml, setFocusedXml] = useState<XmlSelection | null>(null);

  const xmlBody = useMemo(
    () => buildInvoice(invoice),
    [invoice],
  );
  const body = useMemo(() => {
    if (template === "invoice")
      return JSON.stringify({ XmlData: xmlBody, Pattern: invoice.pattern.trim().toUpperCase(), Serial: invoice.serial, Convert: invoice.convert }, null, 2);
    if (template === "adjust-invoice")
      return JSON.stringify(
        {
          OriginalIkey: adjustment.originalIkey,
          AdjustReason: adjustment.reason,
          XmlData: xmlBody,
          Pattern: invoice.pattern || "",
          Serial: invoice.serial || "",
        },
        null,
        2,
      );
    if (template === "external-digest")
      return JSON.stringify(
        {
          TaxCode: digest.taxCode,
          FromDate: digest.fromDate,
          ToDate: digest.toDate,
        },
        null,
        2,
      );
    return JSON.stringify(
      {
        Ikeys: invoiceKeys
          .split(/[\n,;]+/)
          .map((key) => key.trim())
          .filter(Boolean),
      },
      null,
      2,
    );
  }, [template, xmlBody, adjustment, digest, invoiceKeys, invoice.pattern, invoice.serial, invoice.convert]);
  const requestPreview = useMemo(() => {
    const headers = method === "GET" ? [] : ["Content-Type: application/json"];
    if (template === "invoice") headers.push("Authentication: •••••••• (tự sinh trên server)");
    if (template !== "invoice" && auth === "bearer") headers.push("Authorization: Bearer ••••••••");
    if (template !== "invoice" && auth === "basic") headers.push("Authorization: Basic ••••••••");
    if (template !== "invoice" && auth === "apikey")
      headers.push(`${apiKeyName || "x-api-key"}: ••••••••`);
    const requestBody = body;
    return `${method} ${domain.replace(/\/+$/, "")}${apiPath}${headers.length ? `\n${headers.join("\n")}` : ""}${method !== "GET" ? `\n\n${requestBody}` : ""}`;
  }, [auth, method, domain, apiPath, body, apiKeyName, isInvoice, xmlBody, template]);
  const invoiceTotals = useMemo(() => calculateInvoice(invoice), [invoice]);
  const formIssues = useMemo(() => invoiceIssues({ ...invoice, tax: invoice.tax.replace(/\s/g, "") }), [invoice]);
  const invoiceIssuesByField = useMemo(() => {
    const grouped = new Map<string, string[]>();
    for (const issue of formIssues) grouped.set(issue.field, [...(grouped.get(issue.field) ?? []), issue.message]);
    return grouped;
  }, [formIssues]);
  function clearForm() {
    setInvoice(createEmptyInvoice());
    setAdjustment({ originalIkey: "", reason: "" });
    setDigest({ taxCode: "", fromDate: "", toDate: "" });
    setInvoiceKeys("");
    setSecret("");
    setAuth("none");
    setApiKeyName("x-api-key");
    setResult(null);
    setError("");
  }

  function changeTemplate(id: TemplateId) {
    setTemplate(id);
    setActiveTab("request");
    setResult(null);
    setError("");
  }

  function handleTemplatePickerKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
  ) {
    if (event.key === "Escape" && templateOpen) {
      event.preventDefault();
      setTemplateOpen(false);
      templateTriggerRef.current?.focus();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const options = templateOptionRefs.current.filter(
      (option): option is HTMLButtonElement => option !== null,
    );
    if (!templateOpen) {
      event.preventDefault();
      setTemplateOpen(true);
      window.requestAnimationFrame(() =>
        templateOptionRefs.current[
          event.key === "ArrowDown" ? 0 : templates.length - 1
        ]?.focus(),
      );
      return;
    }

    const currentIndex = options.findIndex(
      (option) => option === document.activeElement,
    );
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + direction + options.length) % options.length;
    event.preventDefault();
    options[nextIndex]?.focus();
  }

  async function sendRequest() {
    setError("");
    setResult(null);
    if (template === "invoice") {
      try {
        validateInvoice(invoice);
        setLoading(true);
        const response = await fetch("/api/invoice-drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice }),
          signal: AbortSignal.timeout(35000),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Không thể gửi hóa đơn.");
        setResult(data);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Không thể gửi hóa đơn.");
      } finally {
        setLoading(false);
      }
      return;
    }
    let endpoint: URL;
    try {
      const base = new URL(domain);
      if (!["http:", "https:"].includes(base.protocol)) {
        setError("Chỉ hỗ trợ domain HTTP hoặc HTTPS.");
        return;
      }
      if (base.pathname !== "/" || base.search || base.hash) {
        setError(
          "Chỉ nhập domain gốc; path API sẽ được thêm tự động theo mẫu đã chọn.",
        );
        return;
      }
      endpoint = new URL(apiPath, base.origin);
    } catch {
      setError(
        "Domain chưa hợp lệ. Hãy nhập domain đầy đủ, ví dụ https://api.example.com",
      );
      return;
    }
    let parsedBody: unknown;
    if (method !== "GET" && body) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        setError("Body cần là JSON hợp lệ trước khi gửi.");
        return;
      }
    }
    setLoading(true);
    const started = performance.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    try {
      const requestHeaders = new Headers();
      if (method !== "GET")
        requestHeaders.set("Content-Type", "application/json");
      if (auth === "bearer" && secret)
        requestHeaders.set("Authorization", `Bearer ${secret}`);
      if (auth === "basic" && secret)
        requestHeaders.set("Authorization", `Basic ${btoa(secret)}`);
      if (auth === "apikey" && secret)
        requestHeaders.set(apiKeyName || "x-api-key", secret);
      let requestUrl = endpoint.toString();
      if (method === "GET" && parsedBody && typeof parsedBody === "object") {
        Object.entries(parsedBody).forEach(([key, value]) =>
          endpoint.searchParams.set(
            key,
            Array.isArray(value) ? value.join(",") : String(value),
          ),
        );
        requestUrl = endpoint.toString();
      }
      const response = await fetch(requestUrl, {
        method,
        headers: requestHeaders,
        body:
          method === "GET"
            ? undefined
            : body
              ? JSON.stringify(parsedBody)
              : undefined,
        signal: controller.signal,
      });
      const responseText = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      setResult({
        status: response.status,
        statusText: response.statusText,
        duration: Math.round(performance.now() - started),
        size: new Blob([responseText]).size,
        headers: responseHeaders,
        body: responseText,
        ok: response.ok,
      });
    } catch (caught) {
      const message =
        caught instanceof Error && caught.name === "AbortError"
          ? "Yêu cầu quá thời gian (30 giây)."
          : "Không thể kết nối. Kiểm tra URL, mạng và CORS của API đích.";
      setError(message);
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  }

  function simulateResponse() {
    const isInvoiceResponse = template === "invoice";
    const responseDate = (date: Date) => `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
    const now = new Date();
    const currentDate = responseDate(now);
    const pattern = invoice.pattern.trim().toUpperCase();
    const serial = invoice.serial.trim() || "SERIAL_SELECTED_BY_API";
    const products = invoice.products.map((product, index) => {
      const values = calculateProduct(product);
      const feature = product.feature || (values.amount < 0 ? "3" : values.amount === 0 ? "4" : "1");
      const isDiscount = feature === "3";
      return {
        No: index + 1,
        ProdName: product.name,
        ProdPrice: product.price,
        Feature: Number(feature),
        ProdQuantity: product.quantity,
        ProdUnit: product.unit,
        VATRate: product.vat,
        ...(product.vat === -3 && product.vatRateOther !== "" ? { VATRateOther: Number(product.vatRateOther) } : {}),
        Discount: product.discount,
        VATAmount: isDiscount ? -Math.abs(values.vatAmount) : values.vatAmount,
        DiscountAmount: product.discountAmount,
        Amount: isDiscount ? -Math.abs(values.amount) : values.amount,
        ProdType: 1,
        IsSum: false,
        ...(product.code ? { Code: product.code } : {}),
        Total: isDiscount ? -Math.abs(values.total) : values.total,
      };
    });
    const responseData = isInvoiceResponse
      ? {
          Status: 2,
          Message: "Ok",
          ErrorCode: 0,
          Data: {
            Pattern: pattern,
            Serial: serial,
            Ikeys: [invoice.ikey],
            Invoices: [{
              InvoiceStatus: 0,
              Buyer: invoice.buyer,
              TaxAmount: invoiceTotals.vat,
              Type: 0,
              Products: products,
              Pattern: pattern,
              Serial: serial,
              No: "0",
              Ikey: invoice.ikey,
              ArisingDate: invoice.date ? invoice.date.split("-").reverse().join("/") : currentDate,
              IssueDate: currentDate,
              CustomerName: invoice.customer,
              CustomerAddress: invoice.address,
              CustomerCode: invoice.customerCode.trim() || invoice.tax.replace(/\s/g, ""),
              CustomerTaxCode: invoice.tax.replace(/\s/g, ""),
              Total: invoiceTotals.total,
              Amount: invoiceTotals.amount,
              LookupCode: invoice.fkey || "FKEY_GENERATED_BY_API",
              ModifiedDate: `${currentDate} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
              IsSentTCTSummary: false,
              TCTCheckStatus: "Chưa gửi thuế",
              ...(invoice.taxAuthorityCode ? { TaxAuthorityCode: invoice.taxAuthorityCode } : {}),
              ...(invoice.identification ? { CusIdentification: invoice.identification } : {}),
              ...(invoice.budgetaryRelationshipCode ? { BudgetaryRelationshipCode: invoice.budgetaryRelationshipCode } : {}),
              ...(invoice.passportNo ? { PassportNo: invoice.passportNo } : {}),
              ...(invoice.storeCode ? { StoreCode: invoice.storeCode } : {}),
              ...(invoice.storeName ? { StoreName: invoice.storeName } : {}),
              ...(invoice.provinceCode ? { ProvinceCode: invoice.provinceCode } : {}),
              ...(invoice.provinceName ? { ProvinceName: invoice.provinceName } : {}),
              ...(invoice.communeCode ? { CommuneCode: invoice.communeCode } : {}),
              ...(invoice.communeName ? { CommuneName: invoice.communeName } : {}),
            }],
          },
        }
      : {
          success: true,
          message: "Response mẫu — request chưa được gửi tới API.",
          data: {
            method,
            endpoint: `${domain.replace(/\/+$/, "")}${apiPath}`,
            accepted: true,
          },
        };
    const responseBody = JSON.stringify(responseData, null, 2);
    setError("");
    setResult({
      status: 200,
      statusText: "OK · Mô phỏng",
      duration: 0,
      size: new Blob([responseBody]).size,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-request-mode": "simulation",
      },
      body: responseBody,
      ok: true,
      simulated: true,
    });
  }

  function updateProduct(index: number, field: string, value: string) {
    setInvoice((current) => ({
      ...current,
      products: current.products.map((product, i) =>
        i === index
          ? {
              ...product,
              ...(field === "feature" && value !== "5" ? { extra: "" } : {}),
              [field]: ["quantity", "price", "vat", "discountAmount", "discount"].includes(field)
                ? Number(value)
                : value,
            }
          : product,
      ),
    }));
  }
  function addProduct() {
    setInvoice((current) => ({
      ...current,
      products: [
        ...current.products,
        {
          ...initialInvoice.products[0],
          code: "",
          name: "",
          unit: "Cái",
          feature: "1",
          quantity: 1,
          price: 0,
          vat: -1,
          discountAmount: 0,
          extra: "",
        },
      ],
    }));
  }

  function highlightFormField(target: EventTarget | null, clearWhenUnmapped = false) {
    const field = target instanceof Element ? target.closest<HTMLElement>("[data-xml-tag]") : null;
    const tag = field?.dataset.xmlTag;
    if (!tag) { if (clearWhenUnmapped) setFocusedXml(null); return; }
    const scope = (field.dataset.xmlScope ?? "invoice") as XmlScope;
    const rawIndex = field.dataset.xmlIndex;
    setFocusedXml({ tag, scope, ...(rawIndex !== undefined ? { index: Number(rawIndex) } : {}) });
  }

  return (
    <main className="sandbox-shell" data-theme={theme}>
      <aside className="sidebar">
        <a href="#workspace" className="brand">
          <span className="brand-mark">
            <WandSparkles size={17} />
          </span>
          <span>
            request<span className="brand-soft">lab</span>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switch">
          <span className="workspace-avatar">D</span>
          <span className="workspace-copy">
            <strong>Personal workspace</strong>
            <small>Free plan</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="side-section">
          <div className="side-heading">SANDBOX</div>
          <button className={`side-link ${workspaceView === "request" ? "selected" : ""}`}
            aria-current={workspaceView === "request" ? "page" : undefined}
            onClick={() => setWorkspaceView("request")}>
            <Braces size={16} /> API Request {workspaceView === "request" && <span className="side-dot" />}
          </button>
          <button className={`side-link ${workspaceView === "xml" ? "selected" : ""}`}
            aria-current={workspaceView === "xml" ? "page" : undefined}
            onClick={() => setWorkspaceView("xml")}>
            <Braces size={16} />Kiểm tra XML {workspaceView === "xml" && <span className="side-dot" />}
          </button>
          <button className="side-link" title="Tính năng đang được chuẩn bị">
            <Clock3 size={16} /> Lịch sử <span className="soon-tag">soon</span>
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="status-card">
            <span className="live-pulse" /> Môi trường an toàn{" "}
            <Help>
              Yêu cầu được gửi trực tiếp từ trình duyệt của bạn tới endpoint đã
              cấu hình.
            </Help>
            <p>Thông tin xác thực chỉ tồn tại trong phiên hiện tại.</p>
          </div>
          <button className="profile">
            <span className="profile-avatar">DH</span>
            <span>
              <b>Developer</b>
              <small>dev@workspace.io</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>

      <section className="workspace" id="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{workspaceView === "request" ? "API Request" : "Kiểm tra XML"}</strong>
          </div>
          <div className="top-actions">
            <span className="environment">
              <span className="live-pulse" /> SANDBOX
            </span>
            <button
              className="icon-button theme-toggle"
              type="button"
              onClick={() =>
                setTheme((current) => (current === "light" ? "dark" : "light"))
              }
              title={
                theme === "light" ? "Bật giao diện tối" : "Bật giao diện sáng"
              }
              aria-label={
                theme === "light" ? "Bật giao diện tối" : "Bật giao diện sáng"
              }
            >
              {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
            </button>
            <button
              className="icon-button"
              title="Tài liệu"
              aria-label="Tài liệu"
            >
              <CircleHelp size={17} />
            </button>
            <span className="avatar-small">DH</span>
          </div>
        </header>

        <nav className="mobile-workspace-nav" aria-label="Chọn chức năng">
          <button aria-current={workspaceView === "request" ? "page" : undefined} onClick={() => setWorkspaceView("request")}>API Request</button>
          <button aria-current={workspaceView === "xml" ? "page" : undefined} onClick={() => setWorkspaceView("xml")}>Kiểm tra XML</button>
        </nav>
        <div className="content xml-workspace" hidden={workspaceView !== "xml"}>
          <div className="section-top">
            <div><h2>Kiểm tra XML hóa đơn</h2><p>Dán XmlData và xem lỗi theo từng thẻ trước khi gửi API.</p></div>
          </div>
          <XmlValidator currentXml={xmlBody} currentContext={{ api: template, profile: invoice.profile, specialInvoice: invoice.specialInvoice, pattern: invoice.pattern, serial: invoice.serial }} />
        </div>
        <div className="content" hidden={workspaceView !== "request"}>
          {/* ── Template picker ── */}
          <section className="template-section">
            <div className="section-top">
              <div>
                <h2>Sandbox tích hợp API</h2>
                <p>
                  Chọn loại request, điền thông tin và gửi thử trực tiếp từ
                  trình duyệt — không cần cài đặt thêm.
                </p>
              </div>
              <div className="template-top-actions">
                <span className={`method-badge-top ${method.toLowerCase()}`}>
                  {method}
                </span>
                <label className="config-toggle-label">
                  <input
                    type="checkbox"
                    checked={showConfig}
                    onChange={(e) => setShowConfig(e.target.checked)}
                  />
                  <Settings size={12} />
                  Cấu hình endpoint
                </label>
                <span className="template-count">{templates.length} APIs</span>
              </div>
            </div>
            <div
              className="api-picker-wrap"
              onBlur={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setTemplateOpen(false);
              }}
              onKeyDown={handleTemplatePickerKeyDown}
            >
              <button
                ref={templateTriggerRef}
                className="api-picker"
                type="button"
                aria-label="Chọn loại API"
                aria-haspopup="listbox"
                aria-expanded={templateOpen}
                aria-controls="api-template-options"
                onClick={() => setTemplateOpen((open) => !open)}
              >
                <span className="api-picker-icon">
                  <Braces size={16} />
                </span>
                <span className="api-picker-label">
                  {selectedTemplate.name} · {selectedTemplate.path}
                </span>
                <ChevronDown
                  className={`api-picker-chevron ${templateOpen ? "open" : ""}`}
                  size={16}
                />
              </button>
              {templateOpen && (
                <div
                  id="api-template-options"
                  className="api-picker-options"
                  role="listbox"
                  aria-label="Các loại API"
                >
                  {templates.map(({ id, name, path }, index) => (
                    <button
                      key={id}
                      ref={(option) => {
                        templateOptionRefs.current[index] = option;
                      }}
                      type="button"
                      role="option"
                      aria-selected={template === id}
                      tabIndex={template === id ? 0 : -1}
                      className={`api-option ${template === id ? "active" : ""}`}
                      onClick={() => {
                        changeTemplate(id);
                        setTemplateOpen(false);
                        templateTriggerRef.current?.focus();
                      }}
                    >
                      <span className="api-option-icon">
                        <Braces size={15} />
                      </span>
                      <span className="api-option-meta">
                        <strong>{name}</strong>
                        <small>{path}</small>
                      </span>
                      {template === id && (
                        <Check
                          className="api-option-check"
                          size={16}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Main 50/50 layout ── */}
          <div className="builder-layout-v2">

            {/* LEFT — Invoice / form data */}
            <section className="form-panel" onFocusCapture={(event) => highlightFormField(event.target, true)} onMouseOverCapture={(event) => highlightFormField(event.target)}>
              <div className="card-heading">
                <div className="card-title">
                  <span className="step-number">01</span>
                  <div>
                    <h2>
                      {template === "invoice"
                        ? "Thông tin hóa đơn"
                        : template === "adjust-invoice"
                          ? "Thông tin điều chỉnh hóa đơn"
                          : template === "external-digest"
                            ? "Thông tin truy vấn digest"
                            : "Danh sách khóa hóa đơn"}
                    </h2>
                    <p>
                      {template === "invoice"
                        ? "Điền thông tin để tự động tạo request body XML."
                        : template === "adjust-invoice"
                          ? "Thông tin hóa đơn gốc, lý do và hóa đơn điều chỉnh."
                          : template === "external-digest"
                            ? "Nhập mã số thuế và khoảng thời gian để lấy digest."
                            : "Nhập một hoặc nhiều Ikey cần tra cứu."}
                    </p>
                  </div>
                </div>
                <div className="editor-actions">
                  {isInvoice && (
                    <button
                      className="subtle-button"
                      onClick={() => setInvoice(initialInvoice)}
                    >
                      <WandSparkles size={14} /> Điền mẫu
                    </button>
                  )}
                  <button
                    className="subtle-button clear-button"
                    onClick={clearForm}
                  >
                    <Trash2 size={14} /> Xóa hết
                  </button>
                </div>
              </div>

              {isInvoice ? (
                <InvoiceValidationContext.Provider value={invoiceIssuesByField}>
                <>
                  <InvoiceOptions value={invoice} onChange={setInvoice} issues={formIssues} />
{formIssues.length > 0 && <details className="invoice-form-issues" open><summary>{formIssues.length} trường cần kiểm tra trước khi gửi</summary><ul>{formIssues.map((issue, index) => <li key={index}><button type="button" onClick={() => {
  const field = document.getElementById(`invoice-field-${encodeURIComponent(issue.field)}`);
  let section = field?.closest("details");
  while (section) { section.open = true; section = section.parentElement?.closest("details") ?? null; }
  field?.scrollIntoView({ behavior: "smooth", block: "center" });
  field?.querySelector<HTMLElement>("input, textarea, button, [tabindex]")?.focus({ preventScroll: true });
}}><code>{issue.field}</code>: {issue.message}</button></li>)}</ul></details>}
<section
                    className="tax-mode-section"
                    aria-label="Thiết lập mẫu thuế"
                    style={{ marginTop: 14 }}
                  >
                    <div className="tax-mode-header">
                      <strong>Mẫu thuế</strong>
                      <span>
                        {invoiceMode === "multi"
                          ? "VAT riêng mỗi dòng hàng"
                          : "Áp dụng 1 mức thuế cho toàn bộ"}
                      </span>
                      <div className="tax-mode-tabs">
                        <button
                          className={invoiceMode === "single" ? "active" : ""}
                          onClick={() => {
                            setInvoiceMode("single");
                            setInvoice({
                              ...invoice,
                              products: invoice.products.map((p) => ({ ...p, vat: invoice.vatRate, vatRateOther: invoice.vatRateOther })),
                            });
                          }}
                        >1 thuế</button>
                        <button className={invoiceMode === "multi" ? "active" : ""} onClick={() => setInvoiceMode("multi")}>Nhiều thuế</button>
                      </div>
                    </div>
                    <Field label="VATRate · Hóa đơn" required>
                      <span className="gross-inline-help">
                        <span>Gross nhóm {invoice.vatRate === -3 ? "KHÁC" : VAT_RATES.find(([rate]) => rate === invoice.vatRate)?.[1].split(" · ")[0]}</span>
                        <GrossHelp rate={invoice.vatRate} />
                      </span>
                      <StyledSelect
                        value={invoice.vatRate}
                        options={VAT_RATES.map(([rate, label]) => ({ value: rate, label: `${rate} · ${label}` }))}
                        onChange={(next) => {
                          const rate = Number(next);
                          setInvoice({
                            ...invoice,
                            vatRate: rate,
                            ...(invoiceMode === "single"
                              ? { products: invoice.products.map((p) => ({ ...p, vat: rate, vatRateOther: invoice.vatRateOther })) }
                              : {}),
                          });
                        }}
                      />
                    </Field>
{invoice.vatRate === -3 && <Field label="VATRateOther · Thuế suất khác" required>
  <input type="number" min="0" max="99.99" step="0.01" value={invoice.vatRateOther} onChange={(e) => setInvoice({ ...invoice, vatRateOther: e.target.value,
    ...(invoiceMode === "single" ? { products: invoice.products.map((p) => ({ ...p, vatRateOther: e.target.value })) } : {}) })} />
</Field>}

                  </section>

                  <div className="form-grid" style={{ marginTop: 16 }}>
                    <h3 className="form-section-label">Dải hóa đơn & khóa tích hợp</h3>
                    {template === "adjust-invoice" && (
                      <>
                        <Field label="Ikey hóa đơn gốc" xmlTag={null} required>
                          <input
                            value={adjustment.originalIkey}
                            onChange={(event) =>
                              setAdjustment({
                                ...adjustment,
                                originalIkey: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="Lý do điều chỉnh" required>
                          <input
                            value={adjustment.reason}
                            onChange={(event) =>
                              setAdjustment({
                                ...adjustment,
                                reason: event.target.value,
                              })
                            }
                          />
                        </Field>
                      </>
                    )}
                    <Field validationField="pattern"
                      label="Pattern · Ký hiệu hóa đơn"
                      help="Tự trim và viết hoa. Bỏ cả Pattern/Serial: API chọn dải khả dụng năm hiện tại; truyền một trường: API tìm theo trường đó."
                    >
                      <input
                        value={invoice.pattern}
                        onChange={(e) =>
                          setInvoice({
                            ...invoice,
                            pattern: e.target.value,
                            ...(e.target.value.trim().startsWith("2") || !invoice.extra ? {} : { extra: (() => {
                              try { const extra = JSON.parse(invoice.extra); delete extra.CheckDiscount; return Object.keys(extra).length ? JSON.stringify(extra, null, 2) : ""; }
                              catch { return ""; }
                            })() }),
                          })
                        }
                        placeholder="1C26TAA"
                      />
                    </Field>
                    <Field validationField="serial"
                      label="Serial · Ký hiệu mẫu số"
                      help="Có thể để trống. Nếu truyền cùng Pattern thì hai giá trị phải khớp dải khả dụng."
                    >
                      <input
                        value={invoice.serial}
                        onChange={(e) =>
                          setInvoice({ ...invoice, serial: e.target.value })
                        }
                        placeholder="1"
                      />
                    </Field>
                    <Field validationField="ikey"
                      label="Ikey · Khóa tích hợp"
                      required
                      help="Mã duy nhất nhận diện hóa đơn."
                    >
                      <input
                        value={invoice.ikey}
                        onChange={(e) =>
                          setInvoice({ ...invoice, ikey: e.target.value })
                        }
                      />
                    </Field>
                    <h3 className="form-section-label">Thông tin người mua</h3>
                        <Field label="Mã khách hàng · CusCode" xmlTag="CusCode">
                      <input
                        value={invoice.customerCode}
                        onChange={(e) =>
                          setInvoice({
                            ...invoice,
                            customerCode: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Người mua · Buyer" xmlTag="Buyer" required={!invoice.customer.trim()} help="Ít nhất một trong Buyer/CusName phải có giá trị. Buyer tối đa 100 ký tự.">
                      <input
                        value={invoice.buyer}
                        onChange={(e) =>
                          setInvoice({ ...invoice, buyer: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Tên khách hàng · CusName" xmlTag="CusName" required={!!invoice.tax.trim() || !invoice.buyer.trim() || invoice.specialInvoice === "1"}>
                      <input
                        value={invoice.customer}
                        onChange={(e) =>
                          setInvoice({ ...invoice, customer: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Mã số thuế · CusTaxCode" xmlTag="CusTaxCode" required={invoice.specialInvoice === "1"} help="10 số, 10 số-3 số hoặc 12 số; khoảng trắng được bỏ khi gửi.">
                      <input
                        value={invoice.tax}
                        onChange={(e) =>
                          setInvoice({ ...invoice, tax: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Địa chỉ · CusAddress" xmlTag="CusAddress" required={!!invoice.tax.trim() || invoice.specialInvoice === "1"}>
                      <input
                        value={invoice.address}
                        onChange={(e) =>
                          setInvoice({ ...invoice, address: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Hình thức thanh toán" xmlTag="PaymentMethod" required help="PaymentMethod: chuỗi tự do tối đa 50 ký tự, ví dụ TM, CK hoặc TM/CK.">
                      <input list="payment-methods" maxLength={50} value={invoice.payment} onChange={(e) => setInvoice({ ...invoice, payment: e.target.value })} />
                      <datalist id="payment-methods"><option value="TM" /><option value="CK" /><option value="TM/CK" /></datalist>
                    </Field>
                    <Field label="Số điện thoại · CusPhone" xmlTag="CusPhone" required={invoice.specialInvoice === "1"}>
                      <input
                        value={invoice.phone}
                        onChange={(e) =>
                          setInvoice({ ...invoice, phone: e.target.value })
                        }
                        placeholder="0901234567"
                      />
                    </Field>
                    <Field label="Email nhận thông báo" xmlTag="Email">
                      <input
                        type="text"
                        value={invoice.email}
                        onChange={(e) =>
                          setInvoice({ ...invoice, email: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="CCCD · CusIdentification" xmlTag="CusIdentification">
                      <input
                        value={invoice.identification}
                        onChange={(e) =>
                          setInvoice({ ...invoice, identification: e.target.value })
                        }
                        placeholder="091307006293"
                      />
                    </Field>
                    <h3 className="form-section-label">Ngày hóa đơn & bảng kê</h3>
                    <Field label="Ngày phát sinh · ArisingDate" xmlTag="ArisingDate" help="Để trống: API dùng ngày hiện tại. Năm phải trùng Pattern; gửi XML dd/MM/yyyy.">
<DateInput
                        value={invoice.date}
                        onChange={(e) =>
                          setInvoice({ ...invoice, date: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Số phụ lục · ListAttachNum">
                      <input
                        value={invoice.listAttachNum}
                        onChange={(e) =>
                          setInvoice({ ...invoice, listAttachNum: e.target.value })
                        }
                        placeholder="BK-CKTM-001"
                      />
                    </Field>
                    <Field label="Ngày phụ lục · ListAttachDate">
<DateInput
                        value={invoice.listAttachDate}
                        onChange={(e) =>
                          setInvoice({ ...invoice, listAttachDate: e.target.value })
                        }
                      />
                    </Field>
                    <section className="business-location-group" aria-labelledby="business-location-heading">
                    <h3 className="form-section-label" id="business-location-heading">Địa điểm kinh doanh</h3>
                    <div className="form-grid">
                    <Field label="Mã địa điểm kinh doanh · LocationCode">
                      <input
                        value={invoice.locationCode}
                        onChange={(e) =>
                          setInvoice({ ...invoice, locationCode: e.target.value })
                        }
                        placeholder="Mã địa điểm (tối đa 5 ký tự)"
                      />
                    </Field>
                    <Field label="Tên địa điểm kinh doanh · LocationName" help="Tối đa 400 ký tự. Theo tài liệu code hiện tại, LocationName chỉ được lưu khi có LocationCode.">
                      <input
                        value={invoice.locationName}
                        onChange={(e) =>
                          setInvoice({ ...invoice, locationName: e.target.value })
                        }
                        placeholder="Tên địa điểm kinh doanh"
                      />
                    </Field>
                    <Field label="Địa chỉ địa điểm kinh doanh · LocationAddress">
                      <input
                        value={invoice.locationAddress}
                        onChange={(e) =>
                          setInvoice({ ...invoice, locationAddress: e.target.value })
                        }
                      />
                    </Field>
                    </div>
                    </section>
                    <h3 className="form-section-label">Thông tin bổ sung</h3>
                    <Field label="AmountInWords · Số tiền bằng chữ" labelBreakAt="AmountInWords ·" required={invoice.profile !== "receipt"} help="Thẻ XML luôn có; form yêu cầu nhập cho TT78, trừ cấu hình cleaner của API có thể sinh tự động.">
                      <input
                        value={invoice.amountInWords}
                        onChange={(e) =>
                          setInvoice({ ...invoice, amountInWords: e.target.value })
                        }
                        placeholder="Một triệu đồng"
                      />
                    </Field>
                    {([
                      ["fkey", "Fkey · Khóa tham chiếu"],
                      ["bankName", "CusBankName · Ngân hàng"],
                      ["bankNo", "CusBankNo · Số tài khoản"],
                      ["customerEmails", "CusEmails · Danh sách email"],
                      ["emailCC", "EmailCC · Email CC"],
                      ["passportNo", "PassportNo · Hộ chiếu"],
                      ["storeCode", "StoreCode · Mã cửa hàng"],
                      ["storeName", "StoreName · Tên cửa hàng"],
                      ["provinceCode", "ProvinceCode · Mã tỉnh"],
                      ["provinceName", "ProvinceName · Tên tỉnh"],
                      ["communeCode", "CommuneCode · Mã xã/phường"],
                      ["communeName", "CommuneName · Tên xã/phường"],
                      ["exchangeRate", "ExchangeRate · Tỷ giá"],
                      ["currency", "CurrencyUnit · Tiền tệ"],
                    ] as const).map(([key, label]) => (
                      <Field key={key} validationField={key} label={label} required={key === "currency" && invoice.profile !== "receipt" || ["provinceCode", "provinceName", "communeCode", "communeName"].includes(key) && invoice.specialInvoice === "1"}>
                        <input maxLength={INVOICE_LIMITS[key]} value={invoice[key]} onChange={(event) => setInvoice({ ...invoice, [key]: event.target.value })} />
                      </Field>
                    ))}
                  </div>

                  <InvoiceAdvanced value={invoice} onChange={setInvoice} issues={formIssues} />
<div className="product-list" id="invoice-field-products">
                    <div className="product-heading">
                      <div>
                        <strong>Hàng hóa, dịch vụ</strong>
                        <span>
                          {invoice.products.length} dòng ·{" "}
                          {invoiceMode === "multi"
                            ? "VAT riêng mỗi dòng"
                            : `VAT ${VAT_RATES.find(([rate]) => rate === invoice.vatRate)?.[1]} · tất cả`}
                        </span>
                      </div>
                      <button className="subtle-button" onClick={addProduct}>
                        <Plus size={14} /> Thêm dòng
                      </button>
                    </div>
                    {invoice.products.map((product, index) => (
                      <div className="product-row" key={index}>
                        <Field validationField={`products[${index}].code`} xmlTag="Code" label="Mã sản phẩm" help="Tùy chọn; nếu API có AutoMapProduct thì cần đúng mã danh mục.">
                          <input
                            value={product.code}
                            onChange={(e) =>
                              updateProduct(index, "code", e.target.value)
                            }
                          />
                        </Field>
                        <Field validationField={`products[${index}].name`} xmlTag="ProdName" label="Tên sản phẩm" required>
                          <input
                            value={product.name}
                            onChange={(e) =>
                              updateProduct(index, "name", e.target.value)
                            }
                          />
                        </Field>
                        <Field validationField={`products[${index}].unit`} xmlTag="ProdUnit" label="Đơn vị tính">
                          <input
                            value={product.unit}
                            onChange={(e) =>
                              updateProduct(index, "unit", e.target.value)
                            }
                          />
                        </Field>
                        <Field validationField={`products[${index}].feature`} label="Loại · Feature">
  <StyledSelect value={product.feature} onChange={(next) => updateProduct(index, "feature", next)}
    options={[{ value: "", label: "Tự suy theo Amount (kiểu cũ)" }, ...FEATURES.map(([value, label]) => ({ value, label: `${value} · ${label}` }))]} />
</Field>
                    <Field xmlTag="ProdQuantity" validationField={`products[${index}].quantity`} label="Số lượng">
                          <input
                            type="number"
                            step="any"
                            value={product.quantity}
                            onChange={(e) =>
                              updateProduct(index, "quantity", e.target.value)
                            }
                          />
                        </Field>
                    <Field xmlTag="ProdPrice" validationField={`products[${index}].price`} label="Đơn giá">
                          <input
                            type="number"
                            step="any"
                            value={product.price}
                            onChange={(e) =>
                              updateProduct(index, "price", e.target.value)
                            }
                          />
                        </Field>
                        {invoiceMode === "multi" && (
                          <Field validationField={`products[${index}].vatRate`} xmlTag="VATRate" label="VAT" required>
                            <StyledSelect value={product.vat}
                              onChange={(next) => updateProduct(index, "vat", next)}
                              options={VAT_RATES.map(([rate, label]) => ({ value: rate, label: `${rate} · ${label}` }))} />
                          </Field>
                        )}
                        <Field validationField={`products[${index}].discountAmount`} label="Giảm giá · DiscountAmount">
                          <input
                            type="number"
                            step="any"
                            value={product.discountAmount}
                            onChange={(e) =>
                              updateProduct(index, "discountAmount", e.target.value)
                            }
                          />
                        </Field>
                        {product.vat === -3 && <Field validationField={`products[${index}].vatRateOther`} xmlTag="VATRateOther" label="VATRateOther · Thuế suất khác" required>
  <input type="number" min="0" max="99.99" step="0.01" value={product.vatRateOther} onChange={(e) => updateProduct(index, "vatRateOther", e.target.value)} />
</Field>}
<details className="product-advanced">
  <summary>Tùy chọn dòng · Chiết khấu và số tiền nhập riêng</summary>
  <div className="form-grid">
<Field validationField={`products[${index}].discount`} xmlTag="Discount" label="Discount · Tỷ lệ CK (%)"><input type="number" max="100" step="any" value={product.discount} onChange={(e) => updateProduct(index, "discount", e.target.value)} /></Field>
{([["totalOverride", "Total · Trước thuế"], ["vatAmountOverride", "VATAmount · Tiền thuế"], ["amountOverride", "Amount · Sau thuế"]] as const).map(([key, label]) => (
  <Field key={key} validationField={`products[${index}].${key}`} label={label} help="Để trống: tính gợi ý từ SL × ĐG − DiscountAmount; có thể nhập riêng. API không kiểm tra khớp phép tính này.">
    <input type="number" step="any" value={product[key]} placeholder="Tự tính; có thể nhập riêng" onChange={(e) => updateProduct(index, key, e.target.value)} />
  </Field>
))}
  </div>
</details>
{product.feature === "5" && invoice.specialInvoice !== "0" && <div className="product-special-extra" data-xml-tag="Extra" data-xml-scope="product" data-xml-index={index}><strong>Thông tin hàng hóa đặc trưng</strong><SpecialExtraFields type={invoice.specialInvoice} value={product.extra} onChange={(value) => updateProduct(index, "extra", value)} /></div>}
                        {invoice.products.length > 1 && (
                          <button
                            className="remove-product"
                            onClick={() =>
                              setInvoice({
                                ...invoice,
                                products: invoice.products.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                            aria-label="Xóa sản phẩm"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="invoice-summary">
                    <div className="invoice-summary-heading">
                      <strong>Tổng hợp hóa đơn</strong>
                      <span>
                        Tự tính từ các dòng; có thể nhập số liệu tổng riêng nếu
                        cần.
                      </span>
                    </div>
                    <Field label="DiscountAmount · Tổng chiết khấu">
                      <input type="number" step="any" value={invoice.discountAmount}
                        onChange={(event) => setInvoice({ ...invoice, discountAmount: Number(event.target.value) })} />
                    </Field>
                    <Field label="Total · Trước thuế">
                      <div className="money-input-wrap">
                        <input
                          aria-label="Total · Trước thuế"
                          type="number"
                          step="any"
                          value={
                            invoice.totalOverride === ""
                              ? invoiceTotals.subtotal
                              : invoice.totalOverride
                          }
                          onChange={(event) =>
                            setInvoice({
                              ...invoice,
                              totalOverride: event.target.value,
                            })
                          }
                        />
                        <span>{invoice.currency}</span>
                      </div>
                    </Field>
                    <Field label="VATAmount · Tiền thuế">
                      <div className="money-input-wrap">
                        <input
                          aria-label="VATAmount · Tiền thuế"
                          type="number"
                          step="any"
                          value={
                            invoice.vatAmountOverride === ""
                              ? invoiceTotals.calculatedVat
                              : invoice.vatAmountOverride
                          }
                          onChange={(event) =>
                            setInvoice({
                              ...invoice,
                              vatAmountOverride: event.target.value,
                            })
                          }
                        />
                        <span>{invoice.currency}</span>
                      </div>
                    </Field>
                    <Field label="Amount · Tổng thanh toán">
                      <div className="money-input-wrap">
                        <input
                          aria-label="Amount · Tổng thanh toán"
                          type="number"
                          step="any"
                          value={
                            invoice.amountOverride === ""
                              ? invoiceTotals.amount
                              : invoice.amountOverride
                          }
                          onChange={(event) =>
                            setInvoice({
                              ...invoice,
                              amountOverride: event.target.value,
                            })
                          }
                        />
                        <span>{invoice.currency}</span>
                      </div>
                    </Field>
                    <p className="invoice-rule-note">Không gửi bộ Gross để Softdreams tự tổng hợp. Phép tính trên form là gợi ý; có thể nhập số tiền riêng theo mẫu. Discount (%) không tự thay DiscountAmount.</p>
                  </div>
                </>
                </InvoiceValidationContext.Provider>
              ) : template === "external-digest" ? (
                <div className="form-grid" style={{ marginTop: 16 }}>
                  <Field label="Mã số thuế đơn vị" required>
                    <input
                      value={digest.taxCode}
                      onChange={(event) =>
                        setDigest({ ...digest, taxCode: event.target.value })
                      }
                      placeholder="Mã số thuế"
                    />
                  </Field>
                  <Field label="Từ ngày" required>
<DateInput
                      value={digest.fromDate}
                      onChange={(event) =>
                        setDigest({ ...digest, fromDate: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Đến ngày" required>
<DateInput
                      value={digest.toDate}
                      onChange={(event) =>
                        setDigest({ ...digest, toDate: event.target.value })
                      }
                    />
                  </Field>
                </div>
              ) : (
                <div style={{ marginTop: 16 }}>
                  <Field
                    label="Danh sách Ikey"
                    xmlTag={null}
                    required
                    help="Mỗi dòng hoặc dấu phẩy sẽ tạo một phần tử trong mảng Ikeys."
                  >
                    <textarea
                      className="body-editor"
                      value={invoiceKeys}
                      onChange={(event) => setInvoiceKeys(event.target.value)}
                      placeholder="inv-001, inv-002"
                    />
                  </Field>
                </div>
              )}
            </section>

            {/* RIGHT — Config + Body + Response */}
            <div className="right-column">

              {/* Config card — collapsible */}
              {showConfig ? (
                <section className="config-card">
                  <div className="card-heading">
                    <div className="card-title">
                      <span className="step-number">02</span>
                      <div>
                        <h2>Thiết lập request</h2>
                        <p>
                          Domain Softdreams cố định; path và method theo API đã chọn
                        </p>
                      </div>
                    </div>
                    <span className="required-note">
                      <span>*</span> Bắt buộc
                    </span>
                  </div>

                  <div className="endpoint-row-new">
                    <div className="method-display">
                      <label className="field-label">Method</label>
                      <span
                        className={`method-badge-lg ${method.toLowerCase()}`}
                      >
                        {method}
                      </span>
                    </div>
                    <div className="url-field">
                      <label htmlFor="endpoint-domain">
                        Domain <span className="required-star">*</span>
                        <Help>
                          Domain được cố định. Đường dẫn và phương thức được lấy
                          theo loại API đang chọn.
                        </Help>
                      </label>
                      <input
                        id="endpoint-domain"
                        required
                        value={domain}
                        readOnly
                        placeholder="https://api.example.com"
                        spellCheck={false}
                      />
                      <div className="route-preview">
                        <span>PATH</span>
                        <code>{apiPath}</code>
                      </div>
                    </div>
                    <button
                      className="send-button"
                      onClick={sendRequest}
                      disabled={loading}
                    >
                      <Play size={14} fill="currentColor" />
                      {loading ? "Đang gửi…" : "Gửi request"}
                    </button>
                  </div>

                  <div className="config-grid">
                    {template === "invoice" ? (
                      <div className="config-field">
                        <label>Xác thực Softdreams</label>
                        <div className="auth-wrap">
                          <KeyRound size={15} />
                          <span>Authentication · Tự động trên server</span>
                        </div>
                      </div>
                    ) : (
                    <div className="config-field">
                      <label htmlFor="auth">
                        Phương thức xác thực{" "}
                        <Help>
                          Credential được thêm vào header của API đang chọn.
                        </Help>
                      </label>
                      <div className="auth-wrap">
                        <KeyRound size={15} />
                        <select
                          id="auth"
                          value={auth}
                          onChange={(event) =>
                            setAuth(event.target.value as AuthType)
                          }
                        >
                          <option value="none">Không xác thực</option>
                          <option value="bearer">Bearer token</option>
                          <option value="basic">Basic auth</option>
                          <option value="apikey">API key</option>
                        </select>
                      </div>
                    </div>
                    )}
                    {template !== "invoice" && auth !== "none" && (
                      <div className="config-field">
                        <label htmlFor="credential">
                          {auth === "apikey"
                            ? "API key"
                            : auth === "basic"
                              ? "Username:password"
                              : "Bearer token"}{" "}
                          <Help>
                            Credential chỉ được sử dụng cho request đang gửi.
                          </Help>
                        </label>
                        <div className="secret-wrap">
                          <input
                            id="credential"
                            type={showSecret ? "text" : "password"}
                            value={secret}
                            onChange={(event) => setSecret(event.target.value)}
                            placeholder={
                              auth === "basic"
                                ? "username:password"
                                : "Nhập credential"
                            }
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            aria-label={
                              showSecret ? "Ẩn credential" : "Hiện credential"
                            }
                          >
                            {showSecret ? (
                              <EyeOff size={15} />
                            ) : (
                              <Eye size={15} />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    {template !== "invoice" && auth === "apikey" && (
                      <div className="config-field">
                        <label htmlFor="key-name">Tên header</label>
                        <input
                          id="key-name"
                          value={apiKeyName}
                          onChange={(event) =>
                            setApiKeyName(event.target.value)
                          }
                        />
                      </div>
                    )}
                  </div>
                </section>
              ) : (
                /* Compact bar when config is hidden */
                <div className="compact-send-bar">
                  <div className="compact-endpoint-info">
                    <span
                      className={`method-badge-sm ${method.toLowerCase()}`}
                    >
                      {method}
                    </span>
                    <code className="compact-url">
                      {domain
                        ? `${domain.replace(/\/+$/, "")}${apiPath}`
                        : apiPath}
                    </code>
                  </div>
                  <button
                    className="send-button compact-send-btn"
                    onClick={sendRequest}
                    disabled={loading}
                  >
                    <Play size={14} fill="currentColor" />
                    {loading ? "Đang gửi…" : "Gửi request"}
                  </button>
                </div>
              )}

              {/* Request body preview */}
              <section className="response-card">
                <div className="response-top">
                  <div className="card-title">
                    <span className="step-number">03</span>
                    <div>
                      <h2>Request body</h2>
                      <p>Preview request được tạo tự động từ biểu mẫu</p>
                    </div>
                  </div>
                </div>
                <div
                  className="result-tabs"
                  role="tablist"
                  aria-label="Request preview"
                >
                  <button
                    role="tab"
                    aria-selected={activeTab === "request"}
                    onClick={() => setActiveTab("request")}
                  >
                    Request
                  </button>
                  {isInvoice && (
                    <button
                      role="tab"
                      aria-selected={activeTab === "xml"}
                      onClick={() => setActiveTab("xml")}
                    >
                      {template === "invoice" ? "XmlData" : "XML"}
                    </button>
                  )}
                  <div className="result-spacer" />
                  {isInvoice && activeTab === "request" && (
                    <button aria-pressed={prettyPreview} onClick={() => setPrettyPreview(!prettyPreview)}>
                      {prettyPreview ? "Xem JSON gốc" : "Xem dễ đọc"}
                    </button>
                  )}
                  <button
                    className="copy-button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        activeTab === "xml" ? xmlBody : requestPreview,
                      );
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? "Đã sao chép" : "Sao chép"}
                  </button>
                </div>
                {activeTab === "request" && isInvoice && prettyPreview ? (
                  <div className="formatted-request">
                    <pre className="request-preview request-metadata">
                      {requestPreview.split("\n\n")[0] + "\n\n"}
                      <HighlightedJson text={JSON.stringify({ ...JSON.parse(body), XmlData: "(XML hiển thị bên dưới)" }, null, 2)} />
                    </pre>
                    <div className="response-body-heading">XmlData · XML đã giải mã để đọc (khi gửi vẫn là chuỗi JSON)</div>
                    <pre className="request-preview"><HighlightedXml text={xmlBody} selection={focusedXml} /></pre>
                  </div>
                ) : (
                  <pre className="request-preview">
                    {activeTab === "xml"
                      ? <HighlightedXml text={xmlBody} selection={focusedXml} />
                      : <HighlightedJson text={requestPreview} highlightRanges={isInvoice && !prettyPreview ? findRawXmlHighlightRanges(requestPreview, xmlBody, focusedXml) : []} displayNewlinesRange={isInvoice && !prettyPreview ? findRawXmlValueRange(requestPreview, xmlBody) : undefined} />}
                  </pre>
                )}
                <div className="response-footer">
                  <span>
                    <span className="live-pulse" /> Request preview · cập nhật
                    realtime
                  </span>
                  <span>
                    Tạo từ biểu mẫu bên trái <ArrowUpRight size={12} />
                  </span>
                </div>
              </section>

              {/* Response */}
              <section className="response-card response-only">
                <div className="response-top">
                  <div className="card-title">
                    <span className="step-number">04</span>
                    <div>
                      <h2>Response</h2>
                      <p>Kết quả trả về từ API sau khi gửi request</p>
                    </div>
                  </div>
                  <div className="response-controls">
                    <button
                      className="subtle-button simulate-button"
                      type="button"
                      onClick={simulateResponse}
                      disabled={loading}
                    >
                      <Sparkles size={13} />
                      Tạo response mẫu
                    </button>
                    <div className="result-meta">
                      {result && (
                        <>
                          <span
                            className={`result-status ${result.ok ? "success" : "failed"}`}
                          >
                            {result.status} {result.statusText}
                          </span>
                          <span>
                            <Clock3 size={13} /> {result.duration} ms
                          </span>
                          <span>{formatBytes(result.size)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <ResponsePanel
                  result={result}
                  error={error}
                  loading={loading}
                />
                <div className="response-footer">
                  <span>
                    <span className="live-pulse" />{" "}
                    {result?.simulated
                      ? "Response mô phỏng"
                      : result
                        ? "Yêu cầu hoàn tất"
                        : "Đang chờ request"}
                  </span>
                  <span>
                    Kết quả hiển thị bên phải <ArrowUpRight size={12} />
                  </span>
                </div>
              </section>
            </div>
          </div>

          <footer className="page-footer">
            <span>
              RequestLab <span className="footer-dot">·</span> API testing
              workspace
            </span>
            <span>Import hóa đơn · Softdreams test · Xác thực tự động</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

const FIELD_ISSUE_LABELS: Array<[string, string]> = [
  ["VATRate · Hóa đơn", "vatRate"], ["VATRateOther · Thuế suất khác", "vatRateOther"],
  ["Hình thức thanh toán", "payment"], ["Mã khách hàng · CusCode", "customerCode"],
  ["Người mua · Buyer", "buyer"], ["Tên khách hàng · CusName", "customer"],
  ["Mã số thuế · CusTaxCode", "tax"], ["Địa chỉ · CusAddress", "address"],
  ["Số điện thoại · CusPhone", "phone"], ["Email nhận thông báo", "customerEmails"],
  ["CCCD · CusIdentification", "identification"], ["Ngày phát sinh · ArisingDate", "date"],
  ["Số phụ lục · ListAttachNum", "listAttachNum"], ["Ngày phụ lục · ListAttachDate", "listAttachDate"],
  ["Mã địa điểm kinh doanh · LocationCode", "locationCode"], ["Tên địa điểm kinh doanh · LocationName", "locationName"],
  ["Địa chỉ địa điểm · LocationAddress", "locationAddress"], ["Ghi chú · Extra", "extra"],
  ["AmountInWords · Số tiền bằng chữ", "amountInWords"], ["Discount · Tỷ lệ", "discount"],
  ["DiscountAmount · Tổng chiết khấu", "discountAmount"], ["Total · Trước thuế", "totalOverride"],
  ["VATAmount · Tiền thuế", "vatAmountOverride"], ["Amount · Tổng thanh toán", "amountOverride"],
];

function Field({
  label,
  help,
  required = false,
  validationField,
  xmlTag,
  xmlScope,
  xmlIndex,
  labelBreakAt,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  validationField?: string;
  xmlTag?: string | null;
  xmlScope?: XmlScope;
  xmlIndex?: number;
  labelBreakAt?: string;
  children: React.ReactNode;
}) {
  const validationIssues = useContext(InvoiceValidationContext);
  const issueField = validationField ?? FIELD_ISSUE_LABELS.find(([prefix]) => label.startsWith(prefix))?.[1];
  const messages = issueField ? validationIssues.get(issueField) ?? [] : [];
  const derivedTag = xmlTag === null ? undefined : xmlTag ?? resolveXmlTag(label);
  const productIndex = validationField?.match(/^products\[(\d+)\]/)?.[1];
  const scope = xmlScope ?? (productIndex !== undefined ? "product" : "invoice");
  const index = xmlIndex ?? (productIndex !== undefined ? Number(productIndex) : undefined);
  return (
    <label id={issueField ? `invoice-field-${encodeURIComponent(issueField)}` : undefined} className="field" data-invalid={messages.length > 0 || undefined} data-xml-tag={derivedTag} data-xml-scope={derivedTag ? scope : undefined} data-xml-index={derivedTag ? index : undefined}>
      <span title={label}>
        <span className="field-label-text">{labelBreakAt ? <>{labelBreakAt}<br />{label.slice(labelBreakAt.length).trim()}</> : label}</span>
        {required && (
          <b className="required-star" aria-label="bắt buộc">
            *
          </b>
        )}
        {help && <Help>{help}</Help>}
      </span>
      {children}
      {messages.map((message, index) => <small className="field-validation-message" key={index}>{message}</small>)}
    </label>
  );
}
function formatBytes(bytes: number) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

function GrossHelp({ rate }: { rate: number }) {
  const group = rate === -1 ? "GrossValue, VatAmountNoVAT, AmountNoVAT"
    : rate === -2 ? "GrossValueNDeclared, VatAmountNDeclared, AmountNDeclared"
    : rate === -3 ? "GrossValueContractor, VatAmountContractor, AmountOther"
    : rate === -5 ? "GrossCTTC, VatAmountCTTC, AmountCTTC"
    : rate === -6 ? "GrossKTPVDC, VatAmountKTPVDC, AmountKTPVDC"
    : rate === -7 ? "GrossKTGTT, VatAmountKTGTT, AmountKTGTT"
    : `GrossValue${rate}, VatAmount${rate}, Amount${rate}`;
  const label = rate === -1 ? "KCT" : rate === -2 ? "KKKNT" : rate === -3 ? "KHÁC"
    : rate === -5 ? "CTTC" : rate === -6 ? "KTPVDC" : rate === -7 ? "KTGTT" : rate + "%";
  return <span className="gross-help-trigger" tabIndex={0} aria-label={`Giải thích Gross cho thuế ${rate}`}>
    <CircleHelp size={15} />
    <span className="gross-help-popover" role="tooltip">
      <strong>Nhóm thuế {label}</strong>
      <span>Bộ trường tương ứng: {group}.</span>
      <code>GrossValue = Σ Total · VatAmount = Σ VATAmount · Amount = Σ Amount</code>
      <span>Có 2 cách: gửi đủ toàn bộ trường Gross của nhóm để API dùng số bạn truyền; hoặc bỏ bộ Gross để Softdreams tự cộng các dòng theo VATRate của từng Product.</span>
      <span>Form hiện chọn cách tự tính. Các nhóm Gross độc lập; chỉ gửi tay nếu cần thay số tổng hợp.</span>
    </span>
  </span>;
}
