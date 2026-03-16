<script setup>
import { computed } from "vue";
import BaseFileView from "@/components/BaseFileView.vue";
import { useFileStore } from "@/stores/useFileStore";

const fileStore = useFileStore();
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const recentFilesMonth = computed(() =>
  fileStore.recentFiles.filter((file) => new Date(file.lastModified) >= thirtyDaysAgo),
);
</script>

<template>
  <BaseFileView
    title="최근 파일"
    :files="recentFilesMonth"
    @delete="fileStore.moveToTrash"
  />
</template>
