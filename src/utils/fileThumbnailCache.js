import {
  fetchFileThumbnailBlob,
  fetchSharedFileThumbnailBlob,
} from "@/api/filesApi.js";

const MAX_CACHE_SIZE = 400;
const thumbnailUrlCache = new Map();
const thumbnailRequestCache = new Map();
const thumbnailMissCache = new Set();

const normalizeVersion = (file) => (
  file?.updatedAt ||
  file?.lastModified ||
  file?.uploadDate ||
  ""
);

export const getFileThumbnailCacheKey = (file) => {
  const fileId = file?.id ?? file?.idx ?? null;
  if (fileId == null) {
    return "";
  }

  return [
    file?.sharedWithMe ? "shared" : "owned",
    String(fileId),
    String(file?.fileSavePath || ""),
    String(normalizeVersion(file)),
  ].join(":");
};

export const getCachedFileThumbnailUrl = (file) => {
  const cacheKey = getFileThumbnailCacheKey(file);
  return cacheKey ? (thumbnailUrlCache.get(cacheKey) || "") : "";
};

export const loadFileThumbnailUrl = async (file) => {
  const cacheKey = getFileThumbnailCacheKey(file);
  if (!cacheKey) {
    return "";
  }

  const cachedUrl = thumbnailUrlCache.get(cacheKey);
  if (cachedUrl) {
    return cachedUrl;
  }

  if (thumbnailMissCache.has(cacheKey)) {
    return "";
  }

  const pendingRequest = thumbnailRequestCache.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    try {
      const thumbnailBlob = file?.sharedWithMe
        ? await fetchSharedFileThumbnailBlob(file.id, normalizeVersion(file))
        : await fetchFileThumbnailBlob(file.id, normalizeVersion(file));

      if (!(thumbnailBlob instanceof Blob) || thumbnailBlob.size <= 0) {
        thumbnailMissCache.add(cacheKey);
        return "";
      }

      const objectUrl = window.URL.createObjectURL(thumbnailBlob);
      setCachedThumbnailUrl(cacheKey, objectUrl);
      return objectUrl;
    } catch {
      thumbnailMissCache.add(cacheKey);
      return "";
    } finally {
      thumbnailRequestCache.delete(cacheKey);
    }
  })();

  thumbnailRequestCache.set(cacheKey, request);
  return request;
};

const setCachedThumbnailUrl = (cacheKey, objectUrl) => {
  if (!cacheKey || !objectUrl) {
    return;
  }

  if (thumbnailUrlCache.has(cacheKey)) {
    thumbnailUrlCache.delete(cacheKey);
  }

  thumbnailUrlCache.set(cacheKey, objectUrl);
  trimCache();
};

const trimCache = () => {
  while (thumbnailUrlCache.size > MAX_CACHE_SIZE) {
    const oldestKey = thumbnailUrlCache.keys().next().value;
    if (!oldestKey) {
      return;
    }

    const oldestUrl = thumbnailUrlCache.get(oldestKey);
    if (oldestUrl) {
      window.URL.revokeObjectURL(oldestUrl);
    }

    thumbnailUrlCache.delete(oldestKey);
    thumbnailMissCache.delete(oldestKey);
    thumbnailRequestCache.delete(oldestKey);
  }
};
