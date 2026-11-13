import type { IncomingMessage, ServerResponse } from 'node:http';

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[] | undefined>;
}

interface VercelResponse extends ServerResponse {
  status?: (statusCode: number) => VercelResponse;
  json?: (body: unknown) => void;
}

interface UnsplashApiPhoto {
  id: string;
  alt_description: string | null;
  description: string | null;
  color: string | null;
  width: number;
  height: number;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    html: string;
  };
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
}

interface UnsplashSearchResponse {
  total: number;
  total_pages: number;
  results: UnsplashApiPhoto[];
}

function sendJson(res: VercelResponse, statusCode: number, body: unknown) {
  if (typeof res.status === 'function') {
    const statusRes = res.status(statusCode);
    if (typeof statusRes.json === 'function') {
      statusRes.json(body);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getQueryParam(req: VercelRequest, key: string): string | undefined {
  const fromVercel = req.query?.[key];
  if (typeof fromVercel === 'string') return fromVercel;
  if (Array.isArray(fromVercel) && fromVercel.length > 0) return fromVercel[0];

  if (req.url) {
    const parsed = new URL(req.url, 'http://localhost');
    return parsed.searchParams.get(key) ?? undefined;
  }
  return undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY?.trim();
  if (!accessKey) {
    sendJson(res, 503, {
      configured: false,
      error: 'UNSPLASH_ACCESS_KEY environment variable is not configured.',
    });
    return;
  }

  const rawQuery = getQueryParam(req, 'query')?.trim();
  const query = rawQuery && rawQuery.length > 0 ? rawQuery : 'interior design';

  const rawPerPage = Number.parseInt(getQueryParam(req, 'per_page') ?? '5', 10);
  const perPage = Number.isFinite(rawPerPage) ? Math.min(30, Math.max(1, rawPerPage)) : 5;

  const upstreamUrl = new URL('https://api.unsplash.com/search/photos');
  upstreamUrl.searchParams.set('query', query);
  upstreamUrl.searchParams.set('per_page', String(perPage));

  try {
    const upstreamRes = await fetch(upstreamUrl.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        'Accept-Version': 'v1',
      },
    });

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text().catch(() => '');
      sendJson(res, upstreamRes.status, {
        configured: true,
        error: 'Unsplash API request failed.',
        status: upstreamRes.status,
        detail: errorText.slice(0, 300),
      });
      return;
    }

    const data = (await upstreamRes.json()) as UnsplashSearchResponse;

    const results = (data.results ?? []).map((photo) => ({
      id: photo.id,
      alt_description: photo.alt_description,
      description: photo.description,
      color: photo.color,
      width: photo.width,
      height: photo.height,
      urls: {
        regular: photo.urls.regular,
        small: photo.urls.small,
        thumb: photo.urls.thumb,
      },
      links: {
        html: photo.links.html,
      },
      user: {
        name: photo.user.name,
        username: photo.user.username,
        links: {
          html: photo.user.links.html,
        },
      },
    }));

    sendJson(res, 200, {
      configured: true,
      query,
      per_page: perPage,
      total: data.total ?? results.length,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected upstream error';
    sendJson(res, 502, {
      configured: true,
      error: 'Failed to reach Unsplash API.',
      detail: message,
    });
  }
}
