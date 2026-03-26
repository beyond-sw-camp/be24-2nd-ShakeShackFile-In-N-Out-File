import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  cancelAllFileShares as cancelAllFileSharesApi,
  cancelFileShares as cancelFileSharesApi,
  clearTrash as clearTrashApi,
  createFolder as createFolderApi,
  deleteFilePermanently as deleteFilePermanentlyApi,
  fetchFileList as fetchFileListApi,
  fetchFileListPage as fetchFileListPageApi,
  fetchFileShareInfo as fetchFileShareInfoApi,
  fetchFolderProperties as fetchFolderPropertiesApi,
  fetchSentSharedFileList as fetchSentSharedFileListApi,
  fetchSharedFileList as fetchSharedFileListApi,
  fetchSharedTextPreview as fetchSharedTextPreviewApi,
  fetchStorageSummary as fetchStorageSummaryApi,
  fetchTextPreview as fetchTextPreviewApi,
  moveFileToFolder as moveFileToFolderApi,
  moveFileToTrash as moveFileToTrashApi,
  moveFilesToFolder as moveFilesToFolderApi,
  renameFolder as renameFolderApi,
  restoreFileFromTrash as restoreFileFromTrashApi,
  restoreFilesFromTrash as restoreFilesFromTrashApi,
  saveSharedFileToDrive as saveSharedFileToDriveApi,
  setLockedFiles as setLockedFilesApi,
  shareFilesWithUser as shareFilesWithUserApi,
} from "@/api/filesApi.js";

const ROOT_LOCATION_LABEL = "홈";
const SHARED_LOCATION_LABEL = "공유 문서함";
const ADMINISTRATOR_EMAIL = "administrator@administrator.adm";
const DEFAULT_MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD_COUNT = 30;
const ADMIN_MAX_UPLOAD_FILE_BYTES = 20 * 1024 * 1024 * 1024;
const ADMIN_MAX_UPLOAD_COUNT = 500;
const PRESIGNED_URL_SAFETY_MARGIN_MS = 30 * 1000;
const DEFAULT_DRIVE_PAGE_SIZE = 10;
const MAX_DRIVE_PAGE_SIZE = 30;

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "heic", "avif", "apng", "jfif", "tif", "tiff"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "mkv", "avi", "wmv", "m4v", "mpeg", "mpg", "ogv", "3gp"]);

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
  const size = Number(bytes || 0);
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

const normalizeIdList = (ids) => {
  return Array.from(
    new Set((ids || []).map((value) => Number(value)).filter(Number.isFinite)),
  );
};

const areDriveQueriesEqual = (left, right) => {
  if (!left || !right) {
    return false;
  }

  return (
    (left.parentId ?? null) === (right.parentId ?? null) &&
    Number(left.page ?? 0) === Number(right.page ?? 0) &&
    Number(left.size ?? 0) === Number(right.size ?? 0) &&
    String(left.sortOption || "") === String(right.sortOption || "") &&
    String(left.searchQuery || "") === String(right.searchQuery || "") &&
    String(left.extensionFilter || "") === String(right.extensionFilter || "") &&
    String(left.sizeFilter || "") === String(right.sizeFilter || "") &&
    String(left.customMinSize || "") === String(right.customMinSize || "") &&
    String(left.customMaxSize || "") === String(right.customMaxSize || "") &&
    String(left.statusFilter || "") === String(right.statusFilter || "")
  );
};

const normalizeFileRecord = (rawFile, options = {}) => {
  const name = rawFile?.fileOriginName || rawFile?.name || "이름 없는 파일";
  const nodeType = String(rawFile?.nodeType || rawFile?.type || "FILE").toUpperCase();
  const type = nodeType === "FOLDER" ? "folder" : "file";
  const extension = type === "folder"
    ? ""
    : String(rawFile?.fileFormat || rawFile?.extension || extractExtension(name)).toLowerCase();
  const sizeBytes = Number(rawFile?.fileSize ?? rawFile?.sizeBytes ?? rawFile?.size ?? 0) || 0;
  const uploadDate = rawFile?.uploadDate || rawFile?.uploadedAt || rawFile?.createdAt || null;
  const updatedAt = rawFile?.lastModifyDate || rawFile?.updatedAt || rawFile?.lastModified || uploadDate;
  const updatedDate = parseDate(updatedAt);
  const uploadedDate = parseDate(uploadDate);
  const sharedAt = rawFile?.sharedAt || rawFile?.shareDate || null;
  const sharedWithMe = Boolean(rawFile?.sharedWithMe || options.shared);
  const recipients = Array.isArray(rawFile?.recipients)
    ? rawFile.recipients
      .map((recipient) => ({
        recipientName: recipient?.recipientName || "",
        recipientEmail: recipient?.recipientEmail || "",
        sharedAt: recipient?.sharedAt || null,
      }))
      .filter((recipient) => recipient.recipientName || recipient.recipientEmail)
    : [];
  const recipientCount = Number(rawFile?.recipientCount ?? recipients.length) || 0;
  const recipientNames = recipients
    .map((recipient) => recipient.recipientName || recipient.recipientEmail)
    .filter(Boolean);
  const shareRecipientsLabel = recipientCount <= 0
    ? ""
    : recipientCount <= 2
      ? `공유 대상: ${recipientNames.join(", ")}`
      : `공유 대상: ${recipientNames.slice(0, 2).join(", ")} 외 ${recipientCount - 2}명`;
  const downloadUrl = rawFile?.presignedDownloadUrl || rawFile?.downloadUrl || "";
  const thumbnailUrl = rawFile?.thumbnailPresignedUrl || rawFile?.thumbnailUrl || "";
  const presignedUrlExpiresIn = Number(rawFile?.presignedUrlExpiresIn ?? 0) || 0;
  const assetUrlExpiresAt = presignedUrlExpiresIn > 0
    ? Date.now() + (presignedUrlExpiresIn * 1000)
    : 0;

  return {
    id: rawFile?.idx ?? rawFile?.id ?? `${name}-${uploadDate || Date.now()}`,
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
    uploadDate,
    uploadedAt: uploadDate,
    uploadDateLabel: formatDateLabel(uploadDate),
    updatedAt,
    updatedAtLabel: formatDateLabel(updatedAt),
    lastModified: updatedAt,
    lastModifiedMs: updatedDate?.getTime() ?? 0,
    uploadedAtMs: uploadedDate?.getTime() ?? 0,
    owner: rawFile?.ownerName || rawFile?.owner || "-",
    ownerName: rawFile?.ownerName || rawFile?.owner || "",
    ownerEmail: rawFile?.ownerEmail || "",
    location: sharedWithMe ? SHARED_LOCATION_LABEL : (options.sentShared ? "내가 공유함" : ROOT_LOCATION_LABEL),
    reason:
      rawFile?.reason ||
      (type === "folder" ? "폴더" : `${extension ? extension.toUpperCase() : "FILE"} · ${formatFileSize(sizeBytes)}`),
    isTrash: Boolean(rawFile?.trashed ?? rawFile?.isTrash),
    isShared: Boolean(rawFile?.sharedFile ?? rawFile?.isShared),
    sharedFile: Boolean(rawFile?.sharedFile ?? rawFile?.isShared),
    lockedFile: Boolean(rawFile?.lockedFile),
    parentId: rawFile?.parentId ?? null,
    deletedAt: rawFile?.deletedAt || null,
    downloadUrl,
    presignedDownloadUrl: rawFile?.presignedDownloadUrl || "",
    thumbnailUrl,
    thumbnailPresignedUrl: rawFile?.thumbnailPresignedUrl || "",
    contentType: rawFile?.contentType || rawFile?.mimeType || rawFile?.fileContentType || "",
    fileSaveName: rawFile?.fileSaveName || "",
    fileSavePath: rawFile?.fileSavePath || rawFile?.objectKey || "",
    presignedUrlExpiresIn,
    assetUrlExpiresAt,
    sharedWithMe,
    sharedAt,
    sharedAtLabel: formatDateLabel(sharedAt),
    recipientCount,
    recipients,
    shareRecipientsLabel,
    isImage: IMAGE_EXTENSIONS.has(extension),
    isVideo: VIDEO_EXTENSIONS.has(extension),
    raw: rawFile,
  };
};

const decorateLocations = (files) => {
  const fileById = new Map(files.map((file) => [String(file.id), file]));

  return files.map((file) => ({
    ...file,
    location:
      file.parentId != null
        ? fileById.get(String(file.parentId))?.name || ROOT_LOCATION_LABEL
        : ROOT_LOCATION_LABEL,
  }));
};

const normalizeBreadcrumbRecord = (rawFolder) => normalizeFileRecord({
  idx: rawFolder?.idx ?? rawFolder?.id ?? null,
  fileOriginName: rawFolder?.fileOriginName || rawFolder?.name || "폴더",
  fileFormat: "folder",
  fileSize: 0,
  nodeType: "FOLDER",
  parentId: rawFolder?.parentId ?? null,
  trashed: false,
});

const rememberFolderRecords = (currentRecords, nextRecords) => {
  const folderMap = new Map(
    (currentRecords || [])
      .filter((record) => record?.id != null && record?.type === "folder")
      .map((record) => [String(record.id), record]),
  );

  (nextRecords || [])
    .filter((record) => record?.id != null && record?.type === "folder")
    .forEach((record) => {
      folderMap.set(String(record.id), record);
    });

  return [...folderMap.values()];
};

const reuseCachedAssetUrls = (previousRecords, nextRecords) => {
  const previousById = new Map(
    (previousRecords || [])
      .filter((record) => record?.id != null)
      .map((record) => [String(record.id), record]),
  );

  return (nextRecords || []).map((record) => {
    const previous = previousById.get(String(record?.id));
    const notExpired = Number(previous?.assetUrlExpiresAt || 0) > (Date.now() + PRESIGNED_URL_SAFETY_MARGIN_MS);
    const sameObject = String(previous?.fileSavePath || "") === String(record?.fileSavePath || "");
    const sameRevision = String(previous?.updatedAt || "") === String(record?.updatedAt || "");

    if (!previous || !notExpired || !sameObject || !sameRevision) {
      return record;
    }

    return {
      ...record,
      downloadUrl: previous.downloadUrl || record.downloadUrl,
      presignedDownloadUrl: previous.presignedDownloadUrl || record.presignedDownloadUrl,
      thumbnailUrl: previous.thumbnailUrl || record.thumbnailUrl,
      thumbnailPresignedUrl: previous.thumbnailPresignedUrl || record.thumbnailPresignedUrl,
      presignedUrlExpiresIn: previous.presignedUrlExpiresIn || record.presignedUrlExpiresIn,
      assetUrlExpiresAt: previous.assetUrlExpiresAt || record.assetUrlExpiresAt,
    };
  });
};

export const useFileStore = defineStore("file", () => {
  const authStore = useAuthStore();
  const allFiles = ref([]);
  const drivePageFiles = ref([]);
  const driveBreadcrumbs = ref([]);
  const driveAvailableExtensions = ref([]);
  const drivePageInfo = ref({
    totalPage: 0,
    totalCount: 0,
    currentPage: 0,
    currentSize: 0,
  });
  const knownFolders = ref([]);
  const sharedLibraryFiles = ref([]);
  const sentSharedLibraryFiles = ref([]);
  const currentFolderId = ref(null);
  const isLoading = ref(false);
  const loadError = ref("");
  const hasLoaded = ref(false);
  const driveHasLoaded = ref(false);
  const lastDriveQuery = ref(null);
  const storageSummary = ref(null);
  const storageLoading = ref(false);
  const storageError = ref("");
  const resolveCachedUser = () => {
    try {
      const savedUser = localStorage.getItem("USERINFO");
      if (!savedUser || savedUser === "undefined") {
        return null;
      }

      return JSON.parse(savedUser);
    } catch {
      return null;
    }
  };
  const isAdministrator = computed(() => {
    const currentUser = authStore.user || resolveCachedUser();
    const role = String(currentUser?.role || "").toUpperCase();
    const email = String(currentUser?.email || "").toLowerCase();

    return Boolean(storageSummary.value?.adminAccount) || role.includes("ADMIN") || email === ADMINISTRATOR_EMAIL;
  });
  const planCapabilities = computed(() => ({
    planCode: String(storageSummary.value?.planCode || (isAdministrator.value ? "ADMIN" : "FREE")).toUpperCase(),
    adminAccount: isAdministrator.value,
    shareEnabled: isAdministrator.value || Boolean(storageSummary.value?.shareEnabled),
    fileLockEnabled: isAdministrator.value || Boolean(storageSummary.value?.fileLockEnabled),
    maxUploadFileBytes: Number(
      storageSummary.value?.maxUploadFileBytes ||
      (isAdministrator.value ? ADMIN_MAX_UPLOAD_FILE_BYTES : DEFAULT_MAX_UPLOAD_FILE_BYTES),
    ),
    maxUploadCount: Number(
      storageSummary.value?.maxUploadCount ||
      (isAdministrator.value ? ADMIN_MAX_UPLOAD_COUNT : DEFAULT_MAX_UPLOAD_COUNT),
    ),
  }));

  const fileById = computed(() => {
    const map = new Map();
    [...allFiles.value, ...knownFolders.value, ...drivePageFiles.value].forEach((file) => {
      if (file?.id == null) {
        return;
      }
      map.set(String(file.id), file);
    });
    return map;
  });

  const currentFolder = computed(() => {
    if (currentFolderId.value == null) {
      return null;
    }

    const breadcrumbFolder = driveBreadcrumbs.value[driveBreadcrumbs.value.length - 1];
    if (breadcrumbFolder?.id != null && String(breadcrumbFolder.id) === String(currentFolderId.value)) {
      return breadcrumbFolder;
    }

    return fileById.value.get(String(currentFolderId.value)) || null;
  });

  const getFolderPath = (folderId) => {
    if (folderId == null) {
      return [];
    }

    if (
      currentFolderId.value != null &&
      String(folderId) === String(currentFolderId.value) &&
      driveBreadcrumbs.value.length > 0
    ) {
      return driveBreadcrumbs.value;
    }

    const path = [];
    let cursor = fileById.value.get(String(folderId)) || null;
    const visited = new Set();

    while (cursor && !visited.has(String(cursor.id))) {
      visited.add(String(cursor.id));
      path.unshift(cursor);
      if (cursor.parentId == null) {
        break;
      }
      cursor = fileById.value.get(String(cursor.parentId)) || null;
    }

    return path;
  };

  const currentFolderPath = computed(() => getFolderPath(currentFolderId.value));

  const syncCurrentFolder = () => {
    if (currentFolderId.value == null) {
      return;
    }

    const folder = fileById.value.get(String(currentFolderId.value));
    if (!folder || folder.type !== "folder" || folder.isTrash) {
      currentFolderId.value = null;
    }
  };

  const rememberFolders = (records) => {
    knownFolders.value = rememberFolderRecords(knownFolders.value, records);
  };

  const fetchSharedFiles = async () => {
    const sharedList = await fetchSharedFileListApi();
    sharedLibraryFiles.value = sharedList.map((file) => normalizeFileRecord(file, { shared: true }));
    return sharedLibraryFiles.value;
  };

  const fetchSentSharedFiles = async () => {
    const sentSharedList = await fetchSentSharedFileListApi();
    sentSharedLibraryFiles.value = sentSharedList.map((file) => normalizeFileRecord(file, { sentShared: true }));
    return sentSharedLibraryFiles.value;
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
        "저장 공간 정보를 불러오지 못했습니다.";
      throw error;
    } finally {
      storageLoading.value = false;
    }
  };

  const fetchFiles = async () => {
    isLoading.value = true;
    loadError.value = "";

    try {
      const [fileList, sharedList, sentSharedList] = await Promise.all([
        fetchFileListApi(),
        fetchSharedFileListApi().catch(() => []),
        fetchSentSharedFileListApi().catch(() => []),
      ]);

      const normalizedFiles = decorateLocations(fileList.map((file) => normalizeFileRecord(file)));
      allFiles.value = reuseCachedAssetUrls(allFiles.value, normalizedFiles);
      rememberFolders(allFiles.value);
      sharedLibraryFiles.value = sharedList.map((file) => normalizeFileRecord(file, { shared: true }));
      sentSharedLibraryFiles.value = sentSharedList.map((file) => normalizeFileRecord(file, { sentShared: true }));
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

  const fetchDrivePage = async (query = {}) => {
    isLoading.value = true;
    loadError.value = "";

    const nextQuery = {
      parentId: query.parentId ?? currentFolderId.value ?? null,
      page: Math.max(0, Number(query.page ?? lastDriveQuery.value?.page ?? 0) || 0),
      size: Math.min(
        MAX_DRIVE_PAGE_SIZE,
        Math.max(1, Number(query.size ?? lastDriveQuery.value?.size ?? DEFAULT_DRIVE_PAGE_SIZE) || DEFAULT_DRIVE_PAGE_SIZE),
      ),
      sortOption: query.sortOption ?? lastDriveQuery.value?.sortOption ?? "updatedAt-desc",
      searchQuery: query.searchQuery ?? lastDriveQuery.value?.searchQuery ?? "",
      extensionFilter: query.extensionFilter ?? lastDriveQuery.value?.extensionFilter ?? "all",
      sizeFilter: query.sizeFilter ?? lastDriveQuery.value?.sizeFilter ?? "all",
      customMinSize: query.customMinSize ?? lastDriveQuery.value?.customMinSize ?? "",
      customMaxSize: query.customMaxSize ?? lastDriveQuery.value?.customMaxSize ?? "",
      statusFilter: query.statusFilter ?? lastDriveQuery.value?.statusFilter ?? "all",
    };

    if (!query.forceRefresh && driveHasLoaded.value && areDriveQueriesEqual(lastDriveQuery.value, nextQuery)) {
      isLoading.value = false;
      return drivePageFiles.value;
    }

    try {
      const result = await fetchFileListPageApi(nextQuery);
      const breadcrumbs = Array.isArray(result?.breadcrumbs)
        ? result.breadcrumbs.map((folder) => normalizeBreadcrumbRecord(folder))
        : [];
      const currentLocationLabel = breadcrumbs[breadcrumbs.length - 1]?.name || ROOT_LOCATION_LABEL;
      const pageFiles = Array.isArray(result?.fileList)
        ? result.fileList
          .map((file) => normalizeFileRecord(file))
          .map((file) => ({
            ...file,
            location: currentLocationLabel,
          }))
        : [];

      drivePageFiles.value = reuseCachedAssetUrls(drivePageFiles.value, pageFiles);
      driveBreadcrumbs.value = breadcrumbs;
      driveAvailableExtensions.value = Array.isArray(result?.availableExtensions)
        ? [...new Set(result.availableExtensions.map((extension) => String(extension || "").trim().toLowerCase()).filter(Boolean))]
          .sort((left, right) => left.localeCompare(right))
        : [];
      drivePageInfo.value = {
        totalPage: Number(result?.totalPage ?? 0) || 0,
        totalCount: Number(result?.totalCount ?? 0) || 0,
        currentPage: Number(result?.currentPage ?? nextQuery.page) || 0,
        currentSize: Number(result?.currentSize ?? nextQuery.size) || nextQuery.size,
      };
      driveHasLoaded.value = true;
      lastDriveQuery.value = nextQuery;
      rememberFolders([
        ...breadcrumbs,
        ...pageFiles.filter((file) => file?.type === "folder"),
      ]);
      syncCurrentFolder();
      if (!storageSummary.value && !storageLoading.value) {
        fetchStorageSummary().catch(() => {});
      }
      return drivePageFiles.value;
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

  const refreshDrivePage = async () => {
    if (!lastDriveQuery.value) {
      return drivePageFiles.value;
    }

    return fetchDrivePage({
      ...lastDriveQuery.value,
      forceRefresh: true,
    });
  };

  const driveFiles = computed(() => drivePageFiles.value);

  const sharedFiles = computed(() =>
    [...sharedLibraryFiles.value]
      .filter((file) => !file.isTrash)
      .sort((left, right) => (new Date(right.sharedAt || 0).getTime()) - (new Date(left.sharedAt || 0).getTime())),
  );

  const sentSharedFiles = computed(() =>
    [...sentSharedLibraryFiles.value]
      .filter((file) => !file.isTrash)
      .sort((left, right) => (new Date(right.sharedAt || 0).getTime()) - (new Date(left.sharedAt || 0).getTime())),
  );

  const recentFiles = computed(() =>
    [...allFiles.value]
      .filter((file) => !file.isTrash && file.type !== "folder")
      .sort((left, right) => (right.lastModifiedMs || 0) - (left.lastModifiedMs || 0)),
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

  const refreshAll = async () => {
    if (driveHasLoaded.value && lastDriveQuery.value) {
      await refreshDrivePage();
    }

    if (hasLoaded.value) {
      await fetchFiles();
    } else if (!driveHasLoaded.value) {
      await fetchFiles();
    }

    if (storageSummary.value) {
      fetchStorageSummary().catch(() => {});
    }

    return true;
  };

  const createFolder = async (folderName) => {
    if (!folderName?.trim()) {
      return null;
    }

    await createFolderApi(folderName.trim(), currentFolderId.value);
    await refreshAll();
    return true;
  };

  const moveToTrash = async (fileId) => {
    await moveFileToTrashApi(fileId);
    await refreshAll();
  };

  const trashFilesBatch = async (fileIds) => {
    for (const fileId of normalizeIdList(fileIds)) {
      await moveFileToTrashApi(fileId);
    }
    await refreshAll();
  };

  const permanentlyDelete = async (fileId) => {
    await deleteFilePermanentlyApi(fileId);
    await refreshAll();
  };

  const restoreFromTrash = async (fileId) => {
    await restoreFileFromTrashApi(fileId);
    await refreshAll();
  };

  const restoreFilesBatch = async (fileIds) => {
    const normalizedIds = normalizeIdList(fileIds);
    if (!normalizedIds.length) {
      return;
    }

    await restoreFilesFromTrashApi(normalizedIds);
    await refreshAll();
  };

  const permanentlyDeleteBatch = async (fileIds) => {
    for (const fileId of normalizeIdList(fileIds)) {
      await deleteFilePermanentlyApi(fileId);
    }
    await refreshAll();
  };

  const emptyTrash = async () => {
    await clearTrashApi();
    await refreshAll();
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
    if (!currentFolderId.value) {
      return;
    }

    const folder = fileById.value.get(String(currentFolderId.value));
    currentFolderId.value = folder?.parentId ?? null;
  };

  const moveFileToFolder = async (fileId, folderId) => {
    await moveFileToFolderApi(fileId, folderId);
    await refreshAll();
  };

  const moveFilesToFolder = async (fileIds, folderId) => {
    const normalizedIds = normalizeIdList(fileIds);
    if (!normalizedIds.length) {
      return;
    }

    await moveFilesToFolderApi(normalizedIds, folderId);
    await refreshAll();
  };

  const renameFolder = async (folderId, folderName) => {
    await renameFolderApi(folderId, folderName.trim());
    await refreshAll();
  };

  const setFilesLocked = async (fileIds, locked) => {
    const normalizedIds = normalizeIdList(fileIds);
    if (!normalizedIds.length) {
      return;
    }

    await setLockedFilesApi(normalizedIds, locked);
    await refreshAll();
  };

  const shareFiles = async (fileIds, recipientEmail) => {
    const normalizedIds = normalizeIdList(fileIds);
    if (!normalizedIds.length) {
      return;
    }

    await shareFilesWithUserApi(normalizedIds, recipientEmail.trim());
    await refreshAll();
  };

  const cancelSharedFiles = async (fileIds, recipientEmail) => {
    const normalizedIds = normalizeIdList(fileIds);
    if (!normalizedIds.length) {
      return;
    }

    await cancelFileSharesApi(normalizedIds, recipientEmail.trim());
    await refreshAll();
  };

  const cancelAllSharedFiles = async (fileIds) => {
    const normalizedIds = normalizeIdList(fileIds);
    if (!normalizedIds.length) {
      return;
    }

    await cancelAllFileSharesApi(normalizedIds);
    await refreshAll();
  };

  const fetchShareInfo = async (fileId) => {
    return fetchFileShareInfoApi(fileId);
  };

  const saveSharedFileToDrive = async (fileId, parentId = currentFolderId.value) => {
    const result = await saveSharedFileToDriveApi(fileId, parentId);
    await refreshAll();
    return result;
  };

  const fetchFolderProperties = async (fileId) => {
    return fetchFolderPropertiesApi(fileId);
  };

  const fetchTextPreview = async (fileId) => {
    return fetchTextPreviewApi(fileId);
  };

  const fetchSharedTextPreview = async (fileId) => {
    return fetchSharedTextPreviewApi(fileId);
  };

  const fetchTextPreviewFor = async (file) => {
    if (file?.sharedWithMe) {
      return fetchSharedTextPreviewApi(file.id);
    }

    return fetchTextPreviewApi(file?.id);
  };

  return {
    allFiles,
    drivePageFiles,
    driveBreadcrumbs,
    driveAvailableExtensions,
    drivePageInfo,
    sharedLibraryFiles,
    sentSharedLibraryFiles,
    currentFolderId,
    currentFolder,
    currentFolderPath,
    isLoading,
    loadError,
    hasLoaded,
    driveHasLoaded,
    storageSummary,
    planCapabilities,
    storageLoading,
    storageError,
    driveFiles,
    sharedFiles,
    sentSharedFiles,
    recentFiles,
    trashFiles,
    allOnlyFiles,
    fetchFiles,
    fetchDrivePage,
    refreshDrivePage,
    fetchSharedFiles,
    fetchSentSharedFiles,
    refreshAll,
    createFolder,
    moveToTrash,
    trashFilesBatch,
    restoreFromTrash,
    restoreFilesBatch,
    permanentlyDelete,
    permanentlyDeleteBatch,
    emptyTrash,
    enterFolder,
    navigateToFolder,
    goBack,
    moveFileToFolder,
    moveFilesToFolder,
    renameFolder,
    setFilesLocked,
    shareFiles,
    cancelSharedFiles,
    cancelAllSharedFiles,
    fetchShareInfo,
    saveSharedFileToDrive,
    fetchFolderProperties,
    fetchTextPreview,
    fetchSharedTextPreview,
    fetchTextPreviewFor,
    getFolderPath,
    fetchStorageSummary,
  };
});
