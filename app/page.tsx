import { ApiSandbox } from '@/components/api-sandbox'

function getDomain(): string {
  try {
    const v = process.env.SOFTDREAMS_BASE_URL;
    if (!v) return "";
    const url = new URL(v);
    return url.origin;
  } catch {
    return "";
  }
}

export default function Page() {
  return <ApiSandbox domain={getDomain()} />
}
