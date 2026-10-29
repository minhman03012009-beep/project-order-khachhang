/** Tiny browser fetch helper: JSON in/out, throws ApiError with the server's Vietnamese message. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type ApiInit = Omit<RequestInit, "body"> & { json?: unknown };

export async function api<T>(url: string, init: ApiInit = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      ...rest,
      headers: {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : undefined,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError(0, "Mất kết nối mạng, vui lòng thử lại.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Lỗi máy chủ (${res.status})`);
  return data as T;
}

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Có lỗi xảy ra, vui lòng thử lại.";
