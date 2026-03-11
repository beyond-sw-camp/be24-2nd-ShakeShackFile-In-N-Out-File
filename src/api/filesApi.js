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

const toUploadRequestList = (files) => {
  return Array.from(files ?? []).map((file) => {
    const fileFormat = normalizeFileFormat(file);
    return {
      fileOriginName: file?.name || "unnamed-file",
      fileFormat,
      fileSize: file?.size ?? 0,
      contentType: file?.type || "application/octet-stream",
    };
  });
};

export const parseUploadResponse = (responseData) => {
  if (!responseData) return [];

  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.result)) return responseData.result;
  if (Array.isArray(responseData?.data) && Array.isArray(responseData.data.result)) {
    return responseData.data.result;
  }
  return [];
};

export function uploadFiles(files) {
  const fileRequestList = toUploadRequestList(files);
  return api.post("/file/upload", fileRequestList);
}

export function completePartitionUpload(payload) {
  return api.post("/file/upload/complete", payload, {
    timeout: 600000,
  });
}
