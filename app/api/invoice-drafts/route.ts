import { buildInvoiceBatch, validateInvoiceBatch } from "@/lib/softdreams/invoice-batch";
import { SOFTDREAMS_APIS } from "@/lib/softdreams/endpoints";
import { softdreamsEndpoint } from "@/lib/softdreams/config.server";
import { createAuthen } from "@/lib/softdreams/auth.server";

export const runtime = "nodejs";
const MAX_BYTES = 2 * 1024 * 1024;

async function readLimited(stream: ReadableStream<Uint8Array> | null) {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Dữ liệu vượt quá giới hạn 2 MB."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Origin không được phép." }, { status: 403 });
  let payload;
  let headers: Headers;
  try {
    payload = JSON.parse(await readLimited(request.body));
    const invoices = validateInvoiceBatch(payload.invoices ?? [payload.invoice]);
    const invoice = invoices[0];
    headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
    headers.set("Authentication", createAuthen(SOFTDREAMS_APIS.invoice.method));
    payload = { XmlData: buildInvoiceBatch(invoices), ...(invoice.pattern ? { Pattern: invoice.pattern } : {}), ...(invoice.serial.trim() ? { Serial: invoice.serial } : {}), Convert: invoice.convert };
    if (Buffer.byteLength(JSON.stringify(payload)) > MAX_BYTES) throw new Error("Gói XML vượt giới hạn 2 MB. Hãy giảm số hóa đơn hoặc dòng hàng.");
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Request không hợp lệ." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const started = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(softdreamsEndpoint("invoice"), { method: SOFTDREAMS_APIS.invoice.method, headers, body: JSON.stringify(payload), cache: "no-store", redirect: "error", signal: controller.signal });
    const body = await readLimited(response.body);
    let businessOk = false;
    try {
      const parsed = JSON.parse(body);
      businessOk = Number(parsed.Status) === 2 && Number(parsed.ErrorCode) === 0;
    } catch { /* Preserve upstream non-JSON errors. */ }
    const safeHeaders: Record<string, string> = {};
    for (const name of ["content-type", "date", "retry-after"]) {
      const value = response.headers.get(name);
      if (value) safeHeaders[name] = value;
    }
    return Response.json({ status: response.status, statusText: response.statusText, duration: Math.round(performance.now() - started), size: Buffer.byteLength(body), headers: safeHeaders, body, ok: response.ok && businessOk }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    const timedOut = controller.signal.aborted;
    return Response.json({ message: timedOut ? "Softdreams quá thời gian (30 giây). Kiểm tra theo Ikey trước khi gửi lại." : "Không đọc được phản hồi Softdreams. Kiểm tra theo Ikey trước khi gửi lại." }, { status: timedOut ? 504 : 502, headers: { "Cache-Control": "no-store" } });
  } finally { clearTimeout(timeout); }
}
