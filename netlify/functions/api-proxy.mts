const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  'content-encoding',
]);

function jsonError(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function readRuntimeEnv(key: string): string {
  const netlifyEnv = (
    globalThis as {
      Netlify?: { env?: { get?: (name: string) => string | undefined } };
    }
  ).Netlify?.env;
  const fromNetlify =
    typeof netlifyEnv?.get === 'function' ? netlifyEnv.get(key) : undefined;
  const fromProcess =
    typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return String(fromNetlify ?? fromProcess ?? '');
}

function normalizeBackendUrl(raw: string): string {
  let cleaned = raw
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\/+$/, '');
  if (!cleaned) return '';
  if (!/^https?:\/\//i.test(cleaned)) {
    const isLocal =
      cleaned.startsWith('localhost') || cleaned.startsWith('127.0.0.1');
    cleaned = `${isLocal ? 'http' : 'https'}://${cleaned}`;
  }
  return cleaned;
}

function getBackendBaseUrl(): string {
  const keys = ['BACKEND_URL', 'API_BASE_URL', 'VITE_API_BASE_URL'];
  for (const key of keys) {
    const normalized = normalizeBackendUrl(readRuntimeEnv(key));
    if (normalized) return normalized;
  }
  return '';
}

function sanitizeSetCookieForProxy(cookieStr: string): string {
  // Strip Domain attribute so cookie binds to the Netlify proxy origin cleanly
  return cookieStr.replace(/;\s*domain=[^;]+/gi, '');
}

export default async (req: Request): Promise<Response> => {
  const backendBase = getBackendBaseUrl();
  if (!backendBase) {
    return jsonError(
      503,
      'Backend server belum dihubungkan di Netlify. Atur environment variable BACKEND_URL (atau VITE_API_BASE_URL) pada Netlify Site Settings lalu lakukan redeploy.'
    );
  }

  let parsedBackend: URL;
  try {
    parsedBackend = new URL(backendBase);
  } catch {
    return jsonError(
      500,
      'Format environment variable BACKEND_URL pada Netlify tidak valid. Gunakan URL lengkap seperti https://server-anda.com'
    );
  }

  const incomingUrl = new URL(req.url);
  if (parsedBackend.host.toLowerCase() === incomingUrl.host.toLowerCase()) {
    return jsonError(
      500,
      'BACKEND_URL mengarah ke domain Netlify sendiri sehingga memicu loop. Arahkan BACKEND_URL ke alamat server backend Node/Express.'
    );
  }

  const basePath = parsedBackend.pathname.replace(/\/+$/, '');
  const targetUrl = new URL(
    `${parsedBackend.origin}${basePath}${incomingUrl.pathname}${incomingUrl.search}`
  );

  const forwardHeaders = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (!HOP_BY_HOP_HEADERS.has(lower)) {
      forwardHeaders.set(key, value);
    }
  });
  forwardHeaders.set('x-forwarded-host', incomingUrl.host);
  forwardHeaders.set('x-forwarded-proto', incomingUrl.protocol.replace(/:$/, ''));
  forwardHeaders.set('origin', parsedBackend.origin);

  const method = req.method.toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await req.arrayBuffer();

  try {
    const upstream = await fetch(targetUrl.toString(), {
      method,
      headers: forwardHeaders,
      body,
      redirect: 'manual',
    });

    const responseHeaders = new Headers();
    upstream.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower === 'set-cookie' || HOP_BY_HOP_HEADERS.has(lower)) {
        return;
      }
      responseHeaders.set(key, value);
    });

    const headersWithCookies = upstream.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookies =
      typeof headersWithCookies.getSetCookie === 'function'
        ? headersWithCookies.getSetCookie()
        : upstream.headers.get('set-cookie')
          ? [upstream.headers.get('set-cookie') as string]
          : [];

    for (const cookie of setCookies) {
      responseHeaders.append('Set-Cookie', sanitizeSetCookieForProxy(cookie));
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return jsonError(
      502,
      'Tidak dapat terhubung ke server backend dari Netlify proxy. Pastikan server backend aktif dan dapat diakses publik melalui HTTPS.'
    );
  }
};
