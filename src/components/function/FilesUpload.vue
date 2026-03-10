<template>
  <div class="relative">
    <button
      @click="toggleDropdown"
      class="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-bold text-blue-700 bg-sky-200 rounded-xl transition-all duration-150 hover:bg-sky-300 active:bg-sky-400"
    >
      <i class="fa-solid fa-plus"></i>
      <span>업로드 / 새로 만들기</span>
    </button>

    <div
      v-if="isDropdownOpen"
      class="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50"
    >
      <div class="relative group/sub">
        <div
          class="flex items-center justify-between px-4 py-3 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors rounded-t-2xl"
        >
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-plus-to-slot w-5 text-center text-gray-600 dark:text-gray-400"></i>
            <span>생성</span>
          </div>
          <i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>
        </div>

        <div
          class="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden group-hover/sub:block"
        >
          <RouterLink :to="{ name: 'editor' }">
            <div
              class="px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-t-xl text-gray-800 dark:text-gray-200"
            >
              문서 만들기
            </div>
          </RouterLink>
          <div
            @click="createNewFolder"
            class="px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-b-xl text-gray-800 dark:text-gray-200"
          >
            폴더 만들기
          </div>
        </div>
      </div>

      <div class="relative group/sub">
        <div
          class="flex items-center justify-between px-4 py-3 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors rounded-b-2xl border-t border-gray-100 dark:border-gray-700"
        >
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-cloud-arrow-up w-5 text-center text-gray-600 dark:text-gray-400"></i>
            <span>업로드</span>
          </div>
          <i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>
        </div>

        <div
          class="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden group-hover/sub:block"
        >
          <label
            class="block px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-t-xl text-gray-800 dark:text-gray-200"
          >
            파일 업로드
            <input type="file" multiple hidden :disabled="isUploading" @change="handleFileChange" />
          </label>
          <label
            class="block px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-b-xl text-gray-800 dark:text-gray-200"
          >
            폴더 업로드
            <input type="file" webkitdirectory directory multiple hidden :disabled="isUploading" @change="handleFolderChange" />
          </label>
        </div>
      </div>
    </div>

    <p v-if="uploadError" class="mt-2 text-xs text-rose-500">
      {{ uploadError }}
    </p>
    <p v-if="isUploading" class="mt-2 text-xs text-blue-500">
      {{ uploadStatusMessage }}
    </p>

    <div
      v-if="isDropdownOpen"
      @click="closeDropdown"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import axios from "axios"
import { completePartitionUpload, parseUploadResponse, uploadFiles } from "@/api/filesApi.js"

const isDropdownOpen = ref(false)
const uploadedFiles = ref([])
const isUploading = ref(false)
const uploadPhase = ref("idle")
const uploadError = ref("")

const emit = defineEmits(["upload-complete", "upload-fail"])
const MAX_UPLOAD_COUNT = 1000
const PARTITION_SIZE_BYTES = 100 * 1024 * 1024
const CHUNK_SIZE_BYTES = 80 * 1024 * 1024

const uploadStatusMessage = computed(() => {
  if (uploadPhase.value === "merging") {
    return "서버에서 파일 병합 중..."
  }

  if (uploadPhase.value === "finalizing") {
    return "서버에서 업로드 완료를 확인 중..."
  }

  return "파일 업로드 중..."
})

const toggleDropdown = () => {
  if (isUploading.value) return
  isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
  isDropdownOpen.value = false
}

const createNewFolder = () => {
  const folderName = prompt("폴더 이름을 입력해주세요.")
  if (folderName) {
    console.log("폴더 생성:", folderName)
  }
  closeDropdown()
}

const getFileFormat = (file) => {
  if (typeof file?.name !== "string") return ""

  const lastDot = file.name.lastIndexOf(".")
  if (lastDot < 0 || lastDot === file.name.length - 1) {
    return ""
  }

  return file.name
    .slice(lastDot + 1)
    .trim()
    .replace(/^\.+/, "")
    .toLowerCase()
}

const uploadToPresignedUrl = async (
  payload,
  uploadMeta,
  fileName,
  contentType = "application/octet-stream",
) => {
  const presignedUploadUrl = uploadMeta?.presignedUploadUrl
  if (!presignedUploadUrl) {
    throw new Error("업로드 URL이 없습니다.")
  }

  const presignedFormData = uploadMeta?.presignedFormData
  if (presignedFormData && typeof presignedFormData === "object") {
    const formData = new FormData()

    Object.entries(presignedFormData).forEach(([key, value]) => {
      formData.append(key, value)
    })
    if (!presignedFormData.key && uploadMeta?.objectKey) {
      formData.append("key", uploadMeta.objectKey)
    }
    formData.append("file", payload, fileName || "upload.bin")

    await axios.post(presignedUploadUrl, formData)
    return
  }

  await axios.put(presignedUploadUrl, payload, {
    headers: {
      "Content-Type": contentType || "application/octet-stream",
    },
  })
}

const getExpectedUploadCount = (file) => {
  if (!file?.size || file.size <= PARTITION_SIZE_BYTES) {
    return 1
  }

  return Math.ceil(file.size / CHUNK_SIZE_BYTES)
}

const uploadFileByChunks = async (file, uploadMetas) => {
  const expectedUploadCount = getExpectedUploadCount(file)

  if (!Array.isArray(uploadMetas) || uploadMetas.length !== expectedUploadCount) {
    throw new Error(`${file?.name || "unknown-file"}의 업로드 메타데이터 개수가 맞지 않습니다.`)
  }

  if (expectedUploadCount === 1) {
    await uploadToPresignedUrl(file, uploadMetas[0], file.name, file.type)
    return
  }

  for (let chunkIndex = 0; chunkIndex < expectedUploadCount; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE_BYTES
    const end = Math.min(start + CHUNK_SIZE_BYTES, file.size)
    const chunkBlob = file.slice(start, end, file.type || "application/octet-stream")

    await uploadToPresignedUrl(
      chunkBlob,
      uploadMetas[chunkIndex],
      `${file.name}.part${String(chunkIndex + 1).padStart(5, "0")}`,
      file.type,
    )
  }
}

const completeUploadedFile = async (file, uploadMetas, partitioned) => {
  const firstMeta = uploadMetas[0]
  const finalObjectKey = firstMeta?.finalObjectKey
  const chunkObjectKeys = partitioned
    ? uploadMetas.map((meta) => meta?.objectKey).filter(Boolean)
    : []

  if (!finalObjectKey) {
    throw new Error(`${file.name}의 완료 요청 정보가 올바르지 않습니다.`)
  }

  if (partitioned && chunkObjectKeys.length !== uploadMetas.length) {
    throw new Error(`${file.name}의 완료 요청 정보가 올바르지 않습니다.`)
  }

  await completePartitionUpload({
    fileOriginName: file.name,
    fileFormat: getFileFormat(file),
    fileSize: file.size,
    finalObjectKey,
    chunkObjectKeys,
  })
}

const toNormalizedError = (error) => {
  if (!error) return "업로드에 실패했습니다."
  if (typeof error === "string") return error

  if (error.code === "ECONNABORTED") {
    return "대용량 파일 처리 시간이 초과되었습니다. 잠시 후 다시 확인해주세요."
  }

  if (error.response) {
    if (typeof error.response.data === "string") return error.response.data
    if (error.response.data?.message) return error.response.data.message
    if (error.response.data?.result?.message) return error.response.data.result.message
    return `업로드에 실패했습니다. 상태 코드: ${error.response.status}`
  }

  if (error.message) return error.message
  return "업로드에 실패했습니다."
}

const handleUpload = async (event, uploadTypeLabel) => {
  const selectedFiles = Array.from(event?.target?.files || [])
  if (!selectedFiles.length) return

  uploadError.value = ""
  isUploading.value = true
  uploadPhase.value = "uploading"

  try {
    if (selectedFiles.length > MAX_UPLOAD_COUNT) {
      throw new Error(`한 번에 최대 ${MAX_UPLOAD_COUNT}개까지 업로드할 수 있습니다.`)
    }

    const invalidName = selectedFiles.find((file) => !file?.name || typeof file.name !== "string")
    if (invalidName) {
      throw new Error("유효하지 않은 파일이 포함되어 있습니다.")
    }

    const invalidFormat = selectedFiles.find((file) => {
      const idx = file.name.lastIndexOf(".")
      return idx <= 0 || idx === file.name.length - 1
    })
    if (invalidFormat) {
      throw new Error(`"${invalidFormat.name}" 파일은 확장자가 없습니다.`)
    }

    const response = await uploadFiles(selectedFiles)
    const presignedResponses = parseUploadResponse(response?.data)

    if (!Array.isArray(presignedResponses) || presignedResponses.length === 0) {
      throw new Error("업로드 응답이 비어 있습니다.")
    }

    const successList = []
    let responseIndex = 0

    for (const targetFile of selectedFiles) {
      const expectedUploadCount = getExpectedUploadCount(targetFile)
      const uploadMetas = presignedResponses.slice(responseIndex, responseIndex + expectedUploadCount)

      uploadPhase.value = "uploading"
      await uploadFileByChunks(targetFile, uploadMetas)

      uploadPhase.value = expectedUploadCount > 1 ? "merging" : "finalizing"
      await completeUploadedFile(targetFile, uploadMetas, expectedUploadCount > 1)

      responseIndex += expectedUploadCount
      successList.push(targetFile.name)
    }

    if (responseIndex !== presignedResponses.length) {
      throw new Error("업로드 응답 개수가 선택한 파일과 일치하지 않습니다.")
    }

    uploadedFiles.value = successList
    emit("upload-complete", uploadedFiles.value)
    console.log(`[${uploadTypeLabel}] 업로드 완료:`, uploadedFiles.value)
  } catch (error) {
    const message = toNormalizedError(error)
    uploadError.value = message
    emit("upload-fail", message)
    console.error(`[${uploadTypeLabel}] 업로드 실패:`, error)
  } finally {
    isUploading.value = false
    uploadPhase.value = "idle"
    closeDropdown()

    if (event?.target) {
      event.target.value = ""
    }
  }
}

const handleFileChange = async (event) => {
  await handleUpload(event, "파일")
}

const handleFolderChange = async (event) => {
  await handleUpload(event, "폴더")
}

const handleKeydown = (event) => {
  if (event.key === "Escape" && isDropdownOpen.value) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener("keydown", handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleKeydown)
})
</script>

<style scoped>
</style>
