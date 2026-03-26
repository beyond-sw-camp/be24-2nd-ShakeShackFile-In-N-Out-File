import { api } from "@/plugins/axiosinterceptor";

const normalizeFileFormat = (file) => {
  if (typeof file?.name !== "string") return "";

  const lastDot = file.name.lastIndexOf(".");
  if (lastDot < 0 || lastDot === file.name.length - 1) {
    return "";
  }

  return file.name
    .slice(lastDot + 1)
    .trim()
    .replace(/^\.+/, "")
    .toLowerCase();
};

const toUploadRequestList = (files, parentId = null) => {
  return Array.from(files ?? []).map((file) => {
    const fileFormat = normalizeFileFormat(file);
    return {
      fileOriginName: file?.name || "unnamed-file",
      fileFormat,
      fileSize: file?.size ?? 0,
      contentType: file?.type || "application/octet-stream",
      parentId,
      relativePath: file?.webkitRelativePath || file?.name || "unnamed-file",
      lastModified: Number(file?.lastModified ?? 0) || 0,
    };
  });
};

const extractArrayResult = (responseData) => {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.result)) return responseData.result;
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.data?.result)) return responseData.data.result;
  return [];
};

const extractObjectResult = (responseData) => {
  if (!responseData) return null;
  if (responseData?.result && typeof responseData.result === "object") return responseData.result;
  if (responseData?.data?.result && typeof responseData.data.result === "object") return responseData.data.result;
  if (typeof responseData === "object") return responseData;
  return null;
};

export const parseUploadResponse = (responseData) => {
  return extractArrayResult(responseData);
};

const resolveDownloadUrl = (fileOrUrl) => {
  if (typeof fileOrUrl === "string") return fileOrUrl;
  return fileOrUrl?.downloadUrl || fileOrUrl?.presignedDownloadUrl || "";
};

const resolveDownloadFileName = (fileOrUrl, fallbackFileName = "file") => {
  if (typeof fileOrUrl === "string") return fallbackFileName;
  return fileOrUrl?.name || fileOrUrl?.fileOriginName || fallbackFileName;
};

const triggerDirectDownload = (downloadUrl, fileName) => {
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName || "file";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const resolveDownloadLinkPath = (fileOrUrl) => {
  if (!fileOrUrl || typeof fileOrUrl === "string") return "";

  const fileId = fileOrUrl?.idx ?? fileOrUrl?.id ?? null;
  if (fileId == null) return "";

  if (fileOrUrl?.workspaceId != null) {
    return `/workspace/${fileOrUrl.workspaceId}/assets/${fileId}/download-link`;
  }

  if (fileOrUrl?.sharedWithMe) {
    return `/file/share/shared/${fileId}/download-link`;
  }

  return `/file/${fileId}/download-link`;
};

const extractDownloadLink = (responseData) => {
  const objectResult = extractObjectResult(responseData);
  return objectResult?.downloadUrl || responseData?.downloadUrl || responseData?.result?.downloadUrl || "";
};

export async function downloadFileAsset(fileOrUrl, fallbackFileName = "file") {
  const downloadUrl = resolveDownloadUrl(fileOrUrl);
  if (!downloadUrl) {
    throw new Error("\uB2E4\uC6B4\uB85C\uB4DC\uD560 \uD30C\uC77C \uC8FC\uC18C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  }

  const fileName = resolveDownloadFileName(fileOrUrl, fallbackFileName);
  const downloadLinkPath = resolveDownloadLinkPath(fileOrUrl);

  if (!downloadLinkPath) {
    triggerDirectDownload(downloadUrl, fileName);
    return;
  }

  const response = await api.get(downloadLinkPath, {
    timeout: 15000,
  });
  const attachmentDownloadUrl = extractDownloadLink(response?.data);
  if (!attachmentDownloadUrl) {
    throw new Error("\uB2E4\uC6B4\uB85C\uB4DC \uB9C1\uD06C\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  }

  triggerDirectDownload(attachmentDownloadUrl, fileName);
}

export function initUploadFiles(files, parentId = null) {
  const fileRequestList = toUploadRequestList(files, parentId);
  return api.post("/file/upload", fileRequestList);
}

export function uploadFiles(files, parentId = null) {
  return initUploadFiles(files, parentId);
}

export function completeUpload(payload) {
  return api.post("/file/upload/complete", payload, {
    timeout: 600000,
  });
}

export function abortUpload(payload) {
  return api.post("/file/upload/abort", payload, {
    timeout: 600000,
  });
}

export async function fetchFileList() {
  const response = await api.get("/file/list");
  return extractArrayResult(response?.data);
}

export async function fetchFileListPage(params = {}) {
  const response = await api.get("/file/list/page", {
    params,
  });
  return extractObjectResult(response?.data);
}

export async function fetchSharedFileList() {
  const response = await api.get("/file/share/shared/list");
  return extractArrayResult(response?.data);
}

export async function fetchSentSharedFileList() {
  const response = await api.get("/file/share/sent/list");
  return extractArrayResult(response?.data);
}

export async function fetchFileShareInfo(fileId) {
  const response = await api.get(`/file/share/${fileId}`);
  return extractArrayResult(response?.data);
}

export async function createFolder(folderName, parentId = null) {
  const response = await api.post("/file/folder", {
    folderName,
    parentId,
  });
  return extractObjectResult(response?.data);
}

export async function moveFileToTrash(fileId) {
  const response = await api.patch(`/file/${fileId}/trash`);
  return extractObjectResult(response?.data);
}

export async function restoreFileFromTrash(fileId) {
  const response = await api.patch(`/file/${fileId}/restore`);
  return extractObjectResult(response?.data);
}

export async function restoreFilesFromTrash(fileIdList) {
  const response = await api.patch("/file/restore", {
    fileIdxList: fileIdList,
  });
  return extractObjectResult(response?.data);
}

export async function deleteFilePermanently(fileId) {
  const response = await api.delete(`/file/${fileId}`);
  return extractObjectResult(response?.data);
}

export async function clearTrash() {
  const response = await api.delete("/file/trash");
  return extractObjectResult(response?.data);
}

export async function moveFileToFolder(fileId, targetParentId) {
  const response = await api.patch(`/file/${fileId}/move`, {
    targetParentId,
  });
  return extractObjectResult(response?.data);
}

export async function moveFilesToFolder(fileIdList, targetParentId) {
  const response = await api.patch("/file/move", {
    fileIdxList: fileIdList,
    targetParentId,
  });
  return extractObjectResult(response?.data);
}

export async function renameFolder(fileId, fileName) {
  const response = await api.patch(`/file/${fileId}/rename`, {
    fileName,
  });
  return extractObjectResult(response?.data);
}

export async function setLockedFiles(fileIdList, locked) {
  const response = await api.patch("/file/lock", {
    fileIdxList: fileIdList,
    locked,
  });
  return extractObjectResult(response?.data);
}

export async function shareFilesWithUser(fileIdList, recipientEmail) {
  const response = await api.post("/file/share", {
    fileIdxList: fileIdList,
    recipientEmail,
  });
  return extractObjectResult(response?.data);
}

export async function cancelFileShares(fileIdList, recipientEmail) {
  const response = await api.post("/file/share/cancel", {
    fileIdxList: fileIdList,
    recipientEmail,
  });
  return extractObjectResult(response?.data);
}

export async function cancelAllFileShares(fileIdList) {
  const response = await api.post("/file/share/cancel-all", {
    fileIdxList: fileIdList,
  });
  return extractObjectResult(response?.data);
}

export async function saveSharedFileToDrive(fileId, parentId = null) {
  const response = await api.post(`/file/share/shared/${fileId}/save`, {
    parentId,
  });
  return extractObjectResult(response?.data);
}

export async function fetchFolderProperties(fileId) {
  const response = await api.get(`/file/${fileId}/properties`);
  return extractObjectResult(response?.data);
}

export async function fetchStorageSummary() {
  const response = await api.get("/file/storage/summary");
  return extractObjectResult(response?.data);
}

export async function fetchTextPreview(fileId) {
  const response = await api.get(`/file/${fileId}/text-preview`);
  return extractObjectResult(response?.data);
}

export async function fetchSharedTextPreview(fileId) {
  const response = await api.get(`/file/share/shared/${fileId}/text-preview`);
  return extractObjectResult(response?.data);
}

export async function fetchFileThumbnailBlob(fileId, version = "") {
  const response = await api.get(`/file/${fileId}/thumbnail`, {
    params: version ? { v: version } : undefined,
    responseType: "blob",
  });

  if (response?.status === 204) {
    return null;
  }

  return response?.data instanceof Blob && response.data.size > 0
    ? response.data
    : null;
}

export async function fetchSharedFileThumbnailBlob(fileId, version = "") {
  const response = await api.get(`/file/share/shared/${fileId}/thumbnail`, {
    params: version ? { v: version } : undefined,
    responseType: "blob",
  });

  if (response?.status === 204) {
    return null;
  }

  return response?.data instanceof Blob && response.data.size > 0
    ? response.data
    : null;
}
