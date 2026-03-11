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

export function uploadFiles(files, parentId = null) {
  const fileRequestList = toUploadRequestList(files, parentId);
  return api.post("/file/upload", fileRequestList);
}

export function completePartitionUpload(payload) {
  return api.post("/file/upload/complete", payload, {
    timeout: 600000,
  });
}

export async function fetchFileList() {
  const response = await api.get("/file/list");
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

export async function fetchFolderProperties(fileId) {
  const response = await api.get(`/file/${fileId}/properties`);
  return extractObjectResult(response?.data);
}

export async function fetchStorageSummary() {
  const response = await api.get("/file/storage/summary");
  return extractObjectResult(response?.data);
}
