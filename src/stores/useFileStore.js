import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { fetchFileList as fetchFileListApi } from "@/api/filesApi.js";

const FILE_LOCATION_LABEL = "내 드라이브";

const extractExtension = (fileName = "") => {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0 || lastDot === fileName.length - 1) {
    return "";
  }

  return fileName.slice(lastDot + 1).trim().toLowerCase();
};

const parseDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateLabel = (value) => {
  const date = parseDate(value);
  if (!date) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatFileSize = (bytes) => {
  const size = Number(bytes);

  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(size) / Math.log(1024)),
    units.length - 1,
  );
  const value = size / 1024 ** unitIndex;
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;

  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const normalizeFileRecord = (rawFile) => {
  const name = rawFile?.fileOriginName || rawFile?.name || "이름 없는 파일";
  const extension = (
    rawFile?.fileFormat ||
    rawFile?.extension ||
    extractExtension(name)
  ).toLowerCase();
  const sizeBytes = Number(rawFile?.fileSize ?? rawFile?.sizeBytes ?? rawFile?.size ?? 0) || 0;
  const uploadedAt = rawFile?.uploadDate || rawFile?.uploadedAt || rawFile?.createdAt || null;
  const updatedAt =
    rawFile?.lastModifyDate ||
    rawFile?.updatedAt ||
    rawFile?.lastModified ||
    uploadedAt;
  const updatedDate = parseDate(updatedAt);
  const uploadedDate = parseDate(uploadedAt);
  const type = rawFile?.type || "file";

  return {
    id: rawFile?.idx ?? rawFile?.id ?? `${name}-${uploadedAt || Date.now()}`,
    idx: rawFile?.idx ?? rawFile?.id ?? null,
    name,
    fileOriginName: name,
    extension,
    fileFormat: extension,
    type,
    sizeBytes,
    sizeLabel: formatFileSize(sizeBytes),
    size: formatFileSize(sizeBytes),
    uploadDate: uploadedAt,
    uploadedAt,
    uploadDateLabel: formatDateLabel(uploadedAt),
    updatedAt,
    updatedAtLabel: formatDateLabel(updatedAt),
    lastModified: updatedAt,
    lastModifiedMs: updatedDate?.getTime() ?? 0,
    uploadedAtMs: uploadedDate?.getTime() ?? 0,
    date: formatDateLabel(updatedAt),
    owner: rawFile?.owner || "나",
    location: rawFile?.location || FILE_LOCATION_LABEL,
    reason: rawFile?.reason || `${extension ? extension.toUpperCase() : "FILE"} · ${formatFileSize(sizeBytes)}`,
    isTrash: Boolean(rawFile?.isTrash),
    isShared: Boolean(rawFile?.sharedFile ?? rawFile?.isShared),
    sharedFile: Boolean(rawFile?.sharedFile ?? rawFile?.isShared),
    lockedFile: Boolean(rawFile?.lockedFile),
    parentId: rawFile?.parentId ?? null,
    downloadUrl: rawFile?.presignedDownloadUrl || rawFile?.downloadUrl || "",
    presignedDownloadUrl: rawFile?.presignedDownloadUrl || "",
    fileSaveName: rawFile?.fileSaveName || "",
    fileSavePath: rawFile?.fileSavePath || rawFile?.objectKey || "",
    raw: rawFile,
  };
};

const createFolderRecord = (folderName, parentId) => {
  const createdAt = new Date().toISOString();

  return normalizeFileRecord({
    id: Date.now(),
    name: folderName,
    type: "folder",
    size: 0,
    uploadDate: createdAt,
    lastModifyDate: createdAt,
    reason: "새 폴더",
    location: FILE_LOCATION_LABEL,
    parentId,
  });
};

export const useFileStore = defineStore("file", () => {
  const allFiles = ref([]);
  const currentFolderId = ref(null);
  const isLoading = ref(false);
  const loadError = ref("");
  const hasLoaded = ref(false);

  const fetchFiles = async () => {
    isLoading.value = true;
    loadError.value = "";

    try {
      const fileList = await fetchFileListApi();
      allFiles.value = fileList.map(normalizeFileRecord);
      hasLoaded.value = true;
      return allFiles.value;
    } catch (error) {
      loadError.value =
        error?.response?.data?.message ||
        error?.message ||
        "파일 목록을 불러오지 못했습니다.";
      throw error;
    } finally {
      isLoading.value = false;
    }
  };

  const driveFiles = computed(() =>
    allFiles.value.filter(
      (file) =>
        !file.isTrash &&
        (file.parentId || null) === currentFolderId.value,
    ),
  );

  const sharedFiles = computed(() =>
    allFiles.value.filter((file) => file.isShared && !file.isTrash),
  );

  const recentFiles = computed(() =>
    [...allFiles.value]
      .filter((file) => !file.isTrash && file.type !== "folder")
      .sort((a, b) => (b.lastModifiedMs || 0) - (a.lastModifiedMs || 0)),
  );

  const trashFiles = computed(() =>
    allFiles.value.filter((file) => file.isTrash),
  );

  const allOnlyFiles = computed(() =>
    allFiles.value.filter((file) => !file.isTrash && file.type !== "folder"),
  );

  const moveToTrash = (fileId) => {
    const targetFile = allFiles.value.find(
      (file) => String(file.id) === String(fileId),
    );

    if (targetFile) {
      targetFile.isTrash = true;
    }
  };

  const createFolder = (folderName) => {
    if (!folderName?.trim()) return;
    allFiles.value.unshift(createFolderRecord(folderName.trim(), currentFolderId.value));
  };

  const enterFolder = (folderId) => {
    currentFolderId.value = folderId;
  };

  const goBack = () => {
    if (!currentFolderId.value) return;

    const currentFolder = allFiles.value.find(
      (file) => String(file.id) === String(currentFolderId.value),
    );
    currentFolderId.value = currentFolder?.parentId ?? null;
  };

  const moveFileToFolder = (fileId, folderId) => {
    const targetFile = allFiles.value.find(
      (file) => String(file.id) === String(fileId),
    );

    if (targetFile) {
      targetFile.parentId = folderId;
      targetFile.location =
        allFiles.value.find((file) => String(file.id) === String(folderId))?.name ||
        FILE_LOCATION_LABEL;
    }
  };

  return {
    allFiles,
    currentFolderId,
    isLoading,
    loadError,
    hasLoaded,
    driveFiles,
    sharedFiles,
    recentFiles,
    trashFiles,
    allOnlyFiles,
    fetchFiles,
    moveToTrash,
    createFolder,
    enterFolder,
    goBack,
    moveFileToFolder,
  };
});
