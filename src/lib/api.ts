export async function api<T = unknown>(
  endpoint: string,
  payload?: unknown,
): Promise<T> {
  const res = await fetch(endpoint, {
    method: payload === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  const value = await res.json();
  if (!res.ok)
    throw new Error(
      value.error || "The studio could not complete that action.",
    );
  return value;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
