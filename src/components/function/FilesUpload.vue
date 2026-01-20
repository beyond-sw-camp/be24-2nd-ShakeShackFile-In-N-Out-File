<template>
  <div class="relative">
    <!-- 업로드 버튼 -->
    <button
      @click="toggleDropdown"
      class="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-blue-700 bg-sky-200 rounded-xl transition-all duration-150 hover:bg-sky-300 active:bg-sky-400"
    >
      <i class="fa-solid fa-plus"></i>
      <span>새로 만들기</span>
    </button>

    <!-- 드롭다운 메뉴 -->
    <div
      v-if="isDropdownOpen"
      class="absolute top-full left-0 mt-2 w-58 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50"
    >
      <!-- 새 폴더 -->
      <div
        @click="createNewFolder"
        class="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      >
        <i class="fa-solid fa-folder w-5 text-center text-base text-gray-600 dark:text-gray-400"></i>
        <div class="flex-1">
          <span class="font-medium">새 폴더</span>
        </div>
      </div>

      <!-- 파일 업로드 -->
      <label
        class="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      >
        <i class="fa-solid fa-file-arrow-up w-5 text-center text-base text-gray-600 dark:text-gray-400"></i>
        <div class="flex-1">
          <span class="font-medium">파일 업로드</span>
        </div>
        <input
          type="file"
          multiple
          hidden
          @change="handleFileChange"
        />
      </label>

      <!-- 폴더 업로드 -->
      <label
        class="flex items-center gap-3 px-4 py-3 text-sm text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
      >
        <i class="fa-solid fa-folder-open w-5 text-center text-base text-gray-600 dark:text-gray-400"></i>
        <div class="flex-1">
          <span class="font-medium">폴더 업로드</span>
        </div>
        <input
          type="file"
          webkitdirectory
          directory
          multiple
          hidden
          @change="handleFolderChange"
        />
      </label>
    </div>

    <!-- 배경 클릭 시 드롭다운 닫기 -->
    <div
      v-if="isDropdownOpen"
      @click="closeDropdown"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { uploadFiles } from "@/api/filesApi.js";

const isDropdownOpen = ref(false);
const uploadedFiles = ref([]);
const serverUrl = "http://www.innoutfile.kro.kr:8080";

// 드롭다운 토글
const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value;
};

// 드롭다운 닫기
const closeDropdown = () => {
  isDropdownOpen.value = false;
};

// 새 폴더 생성
const createNewFolder = () => {
  const folderName = prompt("새 폴더 이름을 입력하세요:");
  if (folderName) {
    console.log("새 폴더 생성:", folderName);
    // TODO: 폴더 생성 API 호출
  }
  closeDropdown();
};

// 파일 업로드
const handleFileChange = async (event) => {
  const files = event.target.files;
  if (!files.length) return;

  try {
    const res = await uploadFiles(files);
    if (res.data.success) {
      uploadedFiles.value = res.data.fileUrls;
      console.log("파일 업로드 성공:", uploadedFiles.value);
    }
  } catch (e) {
    console.error("파일 업로드 실패", e);
  } finally {
    closeDropdown();
    // input 초기화
    event.target.value = '';
  }
};

// 폴더 업로드
const handleFolderChange = async (event) => {
  const files = event.target.files;
  if (!files.length) return;

  try {
    const res = await uploadFiles(files);
    if (res.data.success) {
      uploadedFiles.value = res.data.fileUrls;
      console.log("폴더 업로드 성공:", uploadedFiles.value);
    }
  } catch (e) {
    console.error("폴더 업로드 실패", e);
  } finally {
    closeDropdown();
    // input 초기화
    event.target.value = '';
  }
};

// ESC 키로 드롭다운 닫기
const handleKeydown = (event) => {
  if (event.key === 'Escape' && isDropdownOpen.value) {
    closeDropdown();
  }
};

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* 추가 스타일이 필요하면 여기에 작성 */
</style>