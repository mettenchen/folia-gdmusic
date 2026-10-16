// src/services/onlineMusic/gdMusicTransport.ts
const GD_API_BASE = 'https://music-api.gdstudio.xyz/api.php';

export interface GdSearchResult {
    id: string | number;
    name: string;
    artist: string[];
    album: string;
    pic_id: string;
    url_id: string;
    lyric_id: string;
    source: string;
}

export interface GdUrlResult {
    url: string;
    br: number;
    size: number;
}

export interface GdPicResult {
    url: string;
}

export interface GdLyricResult {
    lyric: string;
    tlyric?: string;
}

const buildQueryUrl = (params: Record<string, string | number>): string => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            qs.set(key, String(value));
        }
    }
    return `${GD_API_BASE}?${qs.toString()}`;
};

export async function requestGdMusic<T>(params: Record<string, string | number>): Promise<T> {
    const url = buildQueryUrl(params);
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
        },
    });
    if (!response.ok) {
        throw new Error(`GD Music API error: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(`GD Music API returned non-JSON response: ${text.slice(0, 200)}`);
    }
}

export function getGdMusicAvailability(): { configured: boolean; reason?: string } {
    // GD Music API is always available (external public API, no auth needed)
    return { configured: true };
}
