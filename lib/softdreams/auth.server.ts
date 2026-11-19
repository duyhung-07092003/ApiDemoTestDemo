import { createHash, randomInt } from "node:crypto";
import { getSoftdreamsCredentials } from "./config.server";

const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function createAuthen(method: string, timestamp = Math.floor(Date.now() / 1000), nonce = Array.from({ length: 32 }, () => CHARACTERS[randomInt(CHARACTERS.length)]).join("")) {
  const { username, password } = getSoftdreamsCredentials();
  const raw = method.toUpperCase() + timestamp + nonce;
  // Tương đương CryptoJS.enc.Base64.stringify(CryptoJS.MD5(raw)).
  const signature = createHash("md5").update(raw, "utf8").digest("base64");
  return [signature, nonce, timestamp, username, password].join(":");
}
