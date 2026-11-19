import { ApiSandbox } from '@/components/api-sandbox'

function getDomain(): string {
  try {
    const v = process.env.SOFTDREAMS_BASE_URL ?? "https://test7802.softdreams.vn";
    const url = new URL(v);
    return url.origin;
  } catch {
    return "https://test7802.softdreams.vn";
  }
}

export default function Page() {
  return <ApiSandbox domain={getDomain()} />
}
