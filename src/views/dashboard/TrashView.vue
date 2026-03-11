<script setup>
import BaseFileView from "@/components/BaseFileView.vue";
import { useFileStore } from "@/stores/useFileStore";

const fileStore = useFileStore();

const handlePermanentDelete = async (id) => {
  await fileStore.permanentlyDelete(id);
};

const handleClearTrash = async () => {
  if (confirm("휴지통의 항목을 모두 영구 삭제하시겠습니까?")) {
    await fileStore.emptyTrash();
  }
};
</script>

<template>
  <BaseFileView
    title="휴지통"
    :files="fileStore.trashFiles"
    :show-empty="true"
    delete-mode="permanent"
    :show-folder-navigation="false"
    @delete="handlePermanentDelete"
  >
    <template #header-right>
      <button
        @click="handleClearTrash"
        class="rounded-lg px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
      >
        휴지통 비우기
      </button>
    </template>

    <template #header-bottom>
      <div class="mb-6 flex items-center gap-2 rounded-lg bg-gray-100 p-3 text-xs text-gray-500">
        <i class="fa-solid fa-circle-info"></i>
        휴지통에 있는 항목은 여기서 영구 삭제할 수 있습니다.
      </div>
    </template>
  </BaseFileView>
</template>
