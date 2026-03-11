import { computed, ref } from "vue";
import { defineStore } from "pinia";
import {
  clearTrash as clearTrashApi,
  createFolder as createFolderApi,
  deleteFilePermanently as deleteFilePermanentlyApi,
  fetchFolderProperties as fetchFolderPropertiesApi,
  fetchFileList as fetchFileListApi,
  fetchStorageSummary as fetchStorageSummaryApi,
  fetchTextPreview as fetchTextPreviewApi,
  moveFileToTrash as moveFileToTrashApi,
  moveFileToFolder as moveFileToFolderApi,
  moveFilesToFolder as moveFilesToFolderApi,
  renameFolder as renameFolderApi,
} from "@/api/filesApi.js";

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
  const nodeType = String(rawFile?.nodeType || rawFile?.type || "FILE").toUpperCase();
  const type = nodeType === "FOLDER" ? "folder" : "file";
  const extension = type === "folder"
    ? ""
    : (
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

  return {
    id: rawFile?.idx ?? rawFile?.id ?? `${name}-${uploadedAt || Date.now()}`,
    idx: rawFile?.idx ?? rawFile?.id ?? null,
    name,
    fileOriginName: name,
    extension,
    fileFormat: extension,
    type,
    nodeType,
    sizeBytes,
    sizeLabel: type === "folder" ? "-" : formatFileSize(sizeBytes),
    size: type === "folder" ? "-" : formatFileSize(sizeBytes),
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
    location: FILE_LOCATION_LABEL,
    reason:
      rawFile?.reason ||
      (type === "folder"
        ? "폴더"
        : `${extension ? extension.toUpperCase() : "FILE"} · ${formatFileSize(sizeBytes)}`),
    isTrash: Boolean(rawFile?.trashed ?? rawFile?.isTrash),
    isShared: Boolean(rawFile?.sharedFile ?? rawFile?.isShared),
    sharedFile: Boolean(rawFile?.sharedFile ?? rawFile?.isShared),
    lockedFile: Boolean(rawFile?.lockedFile),
    parentId: rawFile?.parentId ?? null,
    deletedAt: rawFile?.deletedAt || null,
    downloadUrl: rawFile?.presignedDownloadUrl || rawFile?.downloadUrl || "",
    presignedDownloadUrl: rawFile?.presignedDownloadUrl || "",
    fileSaveName: rawFile?.fileSaveName || "",
    fileSavePath: rawFile?.fileSavePath || rawFile?.objectKey || "",
    raw: rawFile,
  };
};

const decorateLocations = (files) => {
  const fileById = new Map(files.map((file) => [String(file.id), file]));

  return files.map((file) => ({
    ...file,
    location:
      file.parentId != null
        ? fileById.get(String(file.parentId))?.name || FILE_LOCATION_LABEL
        : FILE_LOCATION_LABEL,
  }));
};

export const useFileStore = defineStore("file", () => {
  const allFiles = ref([]);
  const currentFolderId = ref(null);
  const isLoading = ref(false);
  const loadError = ref("");
  const hasLoaded = ref(false);
  const storageSummary = ref(null);
  const storageLoading = ref(false);
  const storageError = ref("");

  const fileById = computed(() => {
    return new Map(allFiles.value.map((file) => [String(file.id), file]));
  });

  const currentFolder = computed(() => {
    if (currentFolderId.value == null) {
      return null;
    }

    return fileById.value.get(String(currentFolderId.value)) || null;
  });

  const currentFolderPath = computed(() => {
    return getFolderPath(currentFolderId.value);
  });

  const getFolderPath = (folderId) => {
    if (folderId == null) {
      return [];
    }

    const path = [];
    let cursor = fileById.value.get(String(folderId)) || null;

    while (cursor) {
      path.unshift(cursor);
      if (cursor.parentId == null) {
        break;
      }
      cursor = fileById.value.get(String(cursor.parentId)) || null;
    }

    return path;
  };

  const syncCurrentFolder = () => {
    if (currentFolderId.value == null) {
      return;
    }

    const activeFolder = fileById.value.get(String(currentFolderId.value));
    if (!activeFolder || activeFolder.isTrash || activeFolder.type !== "folder") {
      currentFolderId.value = null;
    }
  };

  const fetchFiles = async () => {
    isLoading.value = true;
    loadError.value = "";

    try {
      const fileList = await fetchFileListApi();
      allFiles.value = decorateLocations(fileList.map(normalizeFileRecord));
      hasLoaded.value = true;
      syncCurrentFolder();
      fetchStorageSummary().catch(() => {});
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
        (file.parentId ?? null) === currentFolderId.value,
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
    allFiles.value.filter((file) => {
      if (!file.isTrash) {
        return false;
      }

      if (file.parentId == null) {
        return true;
      }

      return !fileById.value.get(String(file.parentId))?.isTrash;
    }),
  );

  const allOnlyFiles = computed(() =>
    allFiles.value.filter((file) => !file.isTrash && file.type !== "folder"),
  );

  const createFolder = async (folderName) => {
    if (!folderName?.trim()) return null;

    await createFolderApi(folderName.trim(), currentFolderId.value);
    await fetchFiles();
    return true;
  };

  const moveToTrash = async (fileId) => {
    await moveFileToTrashApi(fileId);
    await fetchFiles();
  };

  const permanentlyDelete = async (fileId) => {
    await deleteFilePermanentlyApi(fileId);
    await fetchFiles();
  };

  const emptyTrash = async () => {
    await clearTrashApi();
    await fetchFiles();
  };

  const enterFolder = (folderId) => {
    const targetFolder = fileById.value.get(String(folderId));
    if (targetFolder?.type === "folder" && !targetFolder.isTrash) {
      currentFolderId.value = targetFolder.id;
    }
  };

  const navigateToFolder = (folderId) => {
    if (folderId == null) {
      currentFolderId.value = null;
      return;
    }

    enterFolder(folderId);
  };

  const goBack = () => {
    if (!currentFolderId.value) return;

    const activeFolder = fileById.value.get(String(currentFolderId.value));
    currentFolderId.value = activeFolder?.parentId ?? null;
  };

  const moveFileToFolder = async (fileId, folderId) => {
    await moveFileToFolderApi(fileId, folderId);
    await fetchFiles();
  };

  const moveFilesToFolder = async (fileIds, folderId) => {
    const normalizedIds = Array.from(
      new Set((fileIds || []).map((value) => Number(value)).filter(Number.isFinite)),
    );

    if (!normalizedIds.length) {
      return;
    }

    await moveFilesToFolderApi(normalizedIds, folderId);
    await fetchFiles();
  };

  const renameFolder = async (folderId, folderName) => {
    await renameFolderApi(folderId, folderName.trim());
    await fetchFiles();
  };

  const fetchFolderProperties = async (folderId) => {
    return fetchFolderPropertiesApi(folderId);
  };

  const fetchTextPreview = async (fileId) => {
    return fetchTextPreviewApi(fileId);
  };

  const fetchStorageSummary = async () => {
    storageLoading.value = true;
    storageError.value = "";

    try {
      const summary = await fetchStorageSummaryApi();
      storageSummary.value = summary;
      return summary;
    } catch (error) {
      storageError.value =
        error?.response?.data?.message ||
        error?.message ||
        "저장 공간 통계를 불러오지 못했습니다.";
      throw error;
    } finally {
      storageLoading.value = false;
    }
  };

  return {
    allFiles,
    currentFolderId,
    currentFolder,
    currentFolderPath,
    isLoading,
    loadError,
    hasLoaded,
    storageSummary,
    storageLoading,
    storageError,
    driveFiles,
    sharedFiles,
    recentFiles,
    trashFiles,
    allOnlyFiles,
    fetchFiles,
    createFolder,
    moveToTrash,
    permanentlyDelete,
    emptyTrash,
    enterFolder,
    navigateToFolder,
    goBack,
    moveFileToFolder,
    moveFilesToFolder,
    renameFolder,
    fetchFolderProperties,
    fetchTextPreview,
    getFolderPath,
    fetchStorageSummary,
  };
});
