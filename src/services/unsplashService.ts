import { ColorScheme, MoodBoardPhoto, StyleDefinition } from '../types/design';

export interface UnsplashSearchResult {
  photos: MoodBoardPhoto[];
  source: 'unsplash-api' | 'curated-studio';
  queryUsed: string;
}

interface ServerlessMoodboardResponse {
  configured?: boolean;
  results?: Array<{
    id: string;
    alt_description: string | null;
    description: string | null;
    color: string | null;
    urls: { regular: string; small?: string };
    user: { name: string; links: { html: string } };
  }>;
}

/**
 * Queries the Vercel serverless proxy at /api/moodboard (which uses
 * process.env.UNSPLASH_ACCESS_KEY on the server) and falls back cleanly
 * to curated local studio photography when the key is not yet configured.
 */
export async function fetchMoodBoardForStyle(
  style: StyleDefinition,
  scheme: ColorScheme,
  customQuery?: string,
): Promise<UnsplashSearchResult> {
  const queryUsed = customQuery?.trim()
    ? `${customQuery.trim()} ${style.name.toLowerCase()} interior`
    : `${style.name.toLowerCase()} ${scheme.name.toLowerCase()} living room`;

  try {
    const endpoint = `/api/moodboard?query=${encodeURIComponent(queryUsed)}&per_page=5`;
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (response.ok && contentType.includes('application/json')) {
      const data = (await response.json()) as ServerlessMoodboardResponse;
      if (data.configured && Array.isArray(data.results) && data.results.length > 0) {
        const categories: MoodBoardPhoto['category'][] = [
          'Architecture',
          'Seating',
          'Materiality',
          'Lighting',
          'Styling',
        ];
        const mapped: MoodBoardPhoto[] = data.results.map((item, idx) => {
          const rawTitle = item.alt_description || item.description;
          const title = rawTitle
            ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1)
            : `${style.name} Inspiration ${idx + 1}`;
          return {
            id: `unsplash-${item.id}`,
            title,
            category: categories[idx % categories.length],
            imageUrl: item.urls.regular,
            unsplashQuery: queryUsed,
            photographer: item.user.name,
            photographerUrl: `${item.user.links.html}?utm_source=atelier_spatial&utm_medium=referral`,
            dominantHex: item.color ?? scheme.accentHex,
            finishNote: `${scheme.name} tonal match`,
          };
        });

        return {
          photos: mapped,
          source: 'unsplash-api',
          queryUsed,
        };
      }
    }
  } catch {
    // Graceful fallback to curated local studio collection when offline or key unset
  }

  const q = (customQuery ?? '').toLowerCase().trim();
  const basePhotos = style.moodBoardPhotos.map((photo, index) => ({
    ...photo,
    dominantHex: scheme.swatches[index % scheme.swatches.length],
    finishNote:
      index === 0
        ? `${scheme.name} · ${style.materialSpecs.walls}`
        : index === 1
          ? `${style.materialSpecs.flooring}`
          : `${style.materialSpecs.textiles}`,
  }));

  const filtered = q
    ? basePhotos.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.finishNote.toLowerCase().includes(q) ||
          p.unsplashQuery.toLowerCase().includes(q),
      )
    : basePhotos;

  return {
    photos: filtered.length > 0 ? filtered : basePhotos,
    source: 'curated-studio',
    queryUsed,
  };
}
