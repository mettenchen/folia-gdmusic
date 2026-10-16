import type { SongResult, UnifiedSong } from '../../types';
import type {
    AudioQualityPreference,
    OnlineMusicProvider,
    ProviderAudioSource,
    ProviderAvailability,
    ProviderLyricsResult,
    ProviderSongAvailability,
} from '../../types/onlineMusic';
import {
    requestGdMusic,
    getGdMusicAvailability,
    type GdSearchResult,
    type GdUrlResult,
    type GdPicResult,
    type GdLyricResult,
} from './gdMusicTransport';

// src/services/onlineMusic/gdMusicProvider.ts

const GD_DEFAULT_SOURCE = 'netease';

const mapQualityToBr = (quality: AudioQualityPreference): number => {
    switch (quality) {
        case 'standard': return 128;
        case 'high': return 320;
        case 'lossless': return 740;
        case 'hires': return 999;
        default: return 999;
    }
};

const normalizeGdSong = (raw: GdSearchResult): UnifiedSong => ({
    id: String(raw.id),
    name: raw.name || '',
    artists: (raw.artist || []).map((name, index) => ({
        id: `${raw.id}#artist${index}`,
        name: String(name || ''),
    })),
    album: {
        id: `${raw.id}#album`,
        name: raw.album || '',
        ...(raw.pic_id ? { coverUrl: `https://music-api.gdstudio.xyz/api.php?types=pic&source=${raw.source || GD_DEFAULT_SOURCE}&id=${raw.pic_id}&size=500` } : {}),
    },
    durationMs: 0,
    sourceRef: {
        kind: 'online',
        providerId: 'gd-music',
        mediaId: String(raw.id),
        providerData: {
            source: raw.source || GD_DEFAULT_SOURCE,
            picId: raw.pic_id || '',
            lyricId: raw.lyric_id || String(raw.id),
        },
    },
});

export const gdMusicProvider: OnlineMusicProvider = {
    id: 'gd-music',
    displayName: 'GD音乐台',
    shortName: 'GD',
    getAvailability: (): ProviderAvailability => getGdMusicAvailability(),
    capabilities: {
        search: true,
        playback: true,
        lyrics: true,
        wordByWordLyrics: false,
        auth: false,
        userLibrary: false,
        playlists: false,
        albums: false,
        artists: false,
        recommendations: false,
        mutations: false,
    },
    requiresAccount: false,
    normalizeSong: (raw: SongResult): UnifiedSong => {
        const candidate = raw as UnifiedSong;
        if (candidate?.sourceRef?.kind === 'online' && candidate.sourceRef.providerId === 'gd-music') {
            return candidate;
        }
        throw new Error('gd-music: cannot normalize song');
    },
    search: {
        async searchSongs(query: string, limit: number, offset: number) {
            if (!query.trim()) {
                return { items: [], hasMore: false, nextOffset: offset };
            }
            const page = Math.floor(offset / limit) + 1;
            const results = await requestGdMusic<GdSearchResult[]>({
                types: 'search',
                source: GD_DEFAULT_SOURCE,
                name: query,
                count: limit,
                pages: page,
            });
            const items = Array.isArray(results) ? results.map(normalizeGdSong) : [];
            return {
                items,
                hasMore: items.length >= limit,
                nextOffset: offset + items.length,
            };
        },
    },
    playback: {
        async getSongDetail(id: string | number) {
            // GD API doesn't have a detail endpoint; return minimal info
            return null;
        },
        async getAudioSource(song: UnifiedSong, quality: AudioQualityPreference): Promise<ProviderAudioSource | null> {
            const source = song.sourceRef;
            if (source?.kind !== 'online' || source.providerId !== 'gd-music') {
                return null;
            }
            const musicSource = (source.providerData?.source as string) || GD_DEFAULT_SOURCE;
            const br = mapQualityToBr(quality);
            try {
                const result = await requestGdMusic<GdUrlResult>({
                    types: 'url',
                    source: musicSource,
                    id: source.mediaId,
                    br,
                });
                if (!result?.url) return null;
                return {
                    url: result.url,
                    fetchedAt: Date.now(),
                    quality,
                };
            } catch {
                return null;
            }
        },
        getAvailability(_song: UnifiedSong): ProviderSongAvailability {
            return { state: 'unknown' };
        },
    },
    lyrics: {
        async getLyrics(song: UnifiedSong): Promise<ProviderLyricsResult | null> {
            const source = song.sourceRef;
            if (source?.kind !== 'online' || source.providerId !== 'gd-music') {
                return null;
            }
            const musicSource = (source.providerData?.source as string) || GD_DEFAULT_SOURCE;
            const lyricId = (source.providerData?.lyricId as string) || source.mediaId;
            try {
                const result = await requestGdMusic<GdLyricResult>({
                    types: 'lyric',
                    source: musicSource,
                    id: lyricId,
                });
                if (!result?.lyric) return null;
                return {
                    original: result.lyric,
                    translated: result.tlyric || undefined,
                };
            } catch {
                return null;
            }
        },
    },
};
