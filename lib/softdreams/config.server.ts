import "server-only";
import { SOFTDREAMS_APIS } from "./endpoints";

function required(name: string): string {
  const value = process.env[name];
  if (!value || /[\r\n]/.test(value)) throw new Error("Thiếu hoặc sai cấu hình " + name + ".");
  return value;
}

export function getSoftdreamsDomain(): string {
  const value = required("SOFTDREAMS_BASE_URL");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("SOFTDREAMS_BASE_URL phải là domain HTTP/HTTPS hợp lệ."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("SOFTDREAMS_BASE_URL chỉ được chứa domain gốc HTTP/HTTPS.");
  }
  return url.origin;
}

export function getSoftdreamsCredentials() {
  return { username: required("SOFTDREAMS_USERNAME"), password: required("SOFTDREAMS_PASSWORD") };
}

export function softdreamsEndpoint(api: keyof typeof SOFTDREAMS_APIS) {
  return new URL(SOFTDREAMS_APIS[api].path, getSoftdreamsDomain()).toString();
}
