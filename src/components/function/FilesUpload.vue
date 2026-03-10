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

        <div class="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden group-hover/sub:block">
          <RouterLink :to="{ name: 'workspace' }">
            <div class="px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-t-xl text-gray-800 dark:text-gray-200">
              새 문서 만들기
            </div>
          </RouterLink>
          <div
            @click="createNewFolder"
            class="px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-b-xl text-gray-800 dark:text-gray-200"
          >
            새 폴더 만들기
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

        <div class="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden group-hover/sub:block">
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
      업로드 중...
    </p>

    <div
      v-if="isDropdownOpen"
      @click="closeDropdown"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue"
import axios from "axios"
import { uploadFiles, parseUploadResponse } from "@/api/filesApi.js"

const isDropdownOpen = ref(false)
const uploadedFiles = ref([])
const isUploading = ref(false)
const uploadError = ref("")

const emit = defineEmits(["upload-complete", "upload-fail"])
const MAX_UPLOAD_COUNT = 10

const toggleDropdown = () => {
  if (isUploading.value) return
  isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
  isDropdownOpen.value = false
}

const createNewFolder = () => {
  const folderName = prompt("폴더 이름을 입력하세요")
  if (folderName) {
    console.log("폴더 생성:", folderName)
  }
  closeDropdown()
}

const uploadToPresignedUrl = async (file, presignedUploadUrl) => {
  if (!presignedUploadUrl) {
    throw new Error("업로드 URL이 없습니다.")
  }

  await axios.put(presignedUploadUrl, file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  })
}

const toNormalizedError = (error) => {
  if (!error) return "업로드에 실패했습니다."
  if (typeof error === "string") return error

  if (error.response) {
    if (typeof error.response.data === "string") return error.response.data
    if (error.response.data?.message) return error.response.data.message
    if (error.response.data?.result?.message) return error.response.data.result.message
    return `업로드 실패. 상태 코드: ${error.response.status}`
  }

  if (error.message) return error.message
  return "업로드에 실패했습니다."
}

const handleUpload = async (event, uploadTypeLabel) => {
  const selectedFiles = Array.from(event?.target?.files || [])
  if (!selectedFiles.length) return

  uploadError.value = ""
  isUploading.value = true

  try {
    if (selectedFiles.length > MAX_UPLOAD_COUNT) {
      throw new Error(`한 번에 최대 ${MAX_UPLOAD_COUNT}개까지만 업로드할 수 있습니다.`)
    }

    const invalidName = selectedFiles.find((file) => !file?.name || typeof file.name !== "string")
    if (invalidName) {
      throw new Error("유효하지 않은 파일이 있습니다.")
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
    const count = Math.min(selectedFiles.length, presignedResponses.length)

    for (let index = 0; index < count; index++) {
      const targetFile = selectedFiles[index]
      const meta = presignedResponses[index]

      await uploadToPresignedUrl(targetFile, meta?.presignedUploadUrl)
      successList.push(meta?.fileOriginName || targetFile.name)
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
