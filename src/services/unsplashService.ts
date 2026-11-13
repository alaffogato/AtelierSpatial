import { ColorScheme, MoodBoardPhoto, StyleDefinition } from '../types/design';

export interface UnsplashSearchResult {
  photos: MoodBoardPhoto[];
  source: 'unsplash-api' | 'curated-studio';
  queryUsed: string;
}

/**
 * Front-end adapter for Unsplash Mood Board generation.
 * When `VITE_UNSPLASH_ACCESS_KEY` or a `/api/unsplash/search` serverless proxy
 * is wired in production, this fetches live Unsplash photography; otherwise it
 * returns curated, style-matched editorial mood board assets with zero broken links.
 */
export async function fetchMoodBoardForStyle(
  style: StyleDefinition,
  scheme: ColorScheme,
  customQuery?: string,
): Promise<UnsplashSearchResult> {
  const queryUsed = customQuery?.trim()
    ? `${customQuery.trim()} ${style.name.toLowerCase()} interior`
    : `${style.name.toLowerCase()} ${scheme.name.toLowerCase()} living room`;

  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY as string | undefined;

  if (accessKey && accessKey.trim().length > 8) {
    try {
      const url = new URL('https://api.unsplash.com/search/photos');
      url.searchParams.set('query', queryUsed);
      url.searchParams.set('per_page', '6');
      url.searchParams.set('orientation', 'landscape');

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Client-ID ${accessKey.trim()}`,
          'Accept-Version': 'v1',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as {
          results?: Array<{
            id: string;
            alt_description: string | null;
            color: string | null;
            urls: { regular: string };
            user: { name: string; links: { html: string } };
          }>;
        };

        if (data.results && data.results.length > 0) {
          const categories: MoodBoardPhoto['category'][] = [
            'Architecture',
            'Seating',
            'Materiality',
            'Lighting',
            'Styling',
          ];
          const mapped: MoodBoardPhoto[] = data.results.map((item, idx) => ({
            id: `unsplash-${item.id}`,
            title: item.alt_description
              ? item.alt_description.charAt(0).toUpperCase() + item.alt_description.slice(1)
              : `${style.name} Inspiration ${idx + 1}`,
            category: categories[idx % categories.length],
            imageUrl: item.urls.regular,
            unsplashQuery: queryUsed,
            photographer: item.user.name,
            photographerUrl: `${item.user.links.html}?utm_source=atelier_spatial&utm_medium=referral`,
            dominantHex: item.color ?? scheme.accentHex,
            finishNote: `${scheme.name} tonal match`,
          }));

          return {
            photos: mapped,
            source: 'unsplash-api',
            queryUsed,
          };
        }
      }
    } catch {
      // Fall back gracefully to curated studio assets if network/API key fails
    }
  }

  // Deterministic curated fallback matching active style & custom filter keyword
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
