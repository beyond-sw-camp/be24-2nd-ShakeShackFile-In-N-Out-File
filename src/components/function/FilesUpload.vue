<template>
  <div>
    <!-- 업로드 버튼 -->
    

        <!-- 업로드 버튼 (label 자체가 버튼 역할) -->
        <label class="upload-btn w-full cursor-pointer flex items-center justify-center">
            파일 업로드
            <input type="file" multiple hidden @change="handleFileChange"/>
        </label>

    <!-- 숨겨진 파일 input -->
    <input
      type="file"
      ref="fileInput"
      multiple
      hidden
      @change="handleFileChange"
    />

    <!-- 미리보기 -->
     <!-- <div class="preview">
      <div v-for="file in uploadedFiles" :key="file.url" class="item">
        <img
          v-if="file.type?.startsWith('image/')"
          :src="serverUrl + file.url"
          width="200"
        />
        <video
          v-else-if="file.type?.startsWith('video/')"
          :src="serverUrl + file.url"
          controls
          width="300"
        ></video>

        <a
          v-else
          :href="serverUrl + file.url"
          target="_blank"
          download
        >
          {{ file.originalName }}
        </a>
      </div>
    </div> -->
  </div>
</template>

<script setup>
import { ref } from "vue";
import { uploadFiles } from "@/api/filesApi.js";

const fileInput = ref(null);
const uploadedFiles = ref([]);
const serverUrl = "http://www.cheeseduck.kro.kr:8080";

const triggerFileInput = () => {
  fileInput.value.click();
};

const handleFileChange = async (event) => {
  const files = event.target.files;
  if (!files.length) return;

  try {
    const res = await uploadFiles(files);
    if (res.data.success) {
      uploadedFiles.value = res.data.fileUrls;
    }
  } catch (e) {
    console.error("파일 업로드 실패", e);
  }
};
</script>

<style scoped>
/*
.upload-btn {
  padding: 10px 16px;
  background: #f07d18;
  color: white;
  border-radius: 8px;
}
.preview {
  margin-top: 20px;
}
.item {
  margin-bottom: 12px;
}

*/
</style>