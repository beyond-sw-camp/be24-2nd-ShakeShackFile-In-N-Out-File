<template>
  <div class="relative">
    <button
      @click="toggleDropdown"
      class="w-full flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-bold text-blue-700 bg-sky-200 rounded-xl transition-all duration-150 hover:bg-sky-300 active:bg-sky-400"
    >
      <i class="fa-solid fa-plus"></i>
      <span>생성 / 업로드</span>
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
            <span class="font-medium">생성하기</span>
          </div>
          <i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>
        </div>

        <div class="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden group-hover/sub:block">
          <div @click="createNewFile" class="px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-t-xl">파일 생성하기</div>
          <div @click="createNewFolder" class="px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-b-xl">폴더 생성하기</div>
        </div>
      </div>

      <div class="relative group/sub">
        <div
          class="flex items-center justify-between px-4 py-3 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors rounded-b-2xl border-t border-gray-100 dark:border-gray-700"
        >
          <div class="flex items-center gap-3">
            <i class="fa-solid fa-cloud-arrow-up w-5 text-center text-gray-600 dark:text-gray-400"></i>
            <span class="font-medium">업로드 하기</span>
          </div>
          <i class="fa-solid fa-chevron-right text-[10px] text-gray-400"></i>
        </div>

        <div class="absolute left-full top-0 ml-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl hidden group-hover/sub:block">
          <label class="block px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-t-xl">
            파일 업로드
            <input type="file" multiple hidden @change="handleFileChange" />
          </label>
          <label class="block px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer rounded-b-xl">
            폴더 업로드
            <input type="file" webkitdirectory directory multiple hidden @change="handleFolderChange" />
          </label>
        </div>
      </div>
    </div>

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

// [추가] 파일 생성하기 로직
const createNewFile = () => {
  const fileName = prompt("새 파일 이름을 입력하세요:");
  if (fileName) {
    console.log("새 파일 생성:", fileName);
  }
  closeDropdown();
}

// 새 폴더 생성
const createNewFolder = () => {
  const folderName = prompt("새 폴더 이름을 입력하세요:");
  if (folderName) {
    console.log("새 폴더 생성:", folderName);
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