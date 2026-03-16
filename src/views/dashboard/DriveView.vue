<script setup>
import BaseFileView from "@/components/BaseFileView.vue";
import { useFileStore } from "@/stores/useFileStore";

const fileStore = useFileStore();
</script>

<template>
  <BaseFileView
    title="홈"
    :files="fileStore.driveFiles"
    :show-folder-navigation="true"
    @delete="fileStore.moveToTrash"
  />
</template>
