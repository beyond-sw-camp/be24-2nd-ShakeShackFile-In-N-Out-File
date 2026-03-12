<template>
  <div class="flex items-center justify-center h-screen">
    <div class="text-center">
      <i class="fa-solid fa-spinner fa-spin text-3xl text-blue-500 mb-4"></i>
      <p class="text-[var(--text-main)]">초대를 확인하고 있습니다. 잠시만 기다려주세요...</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import postApi from '@/api/postApi';
import loadpost from '@/components/workspace/loadpost';

const route = useRoute();
const router = useRouter();

onMounted(async () => {
  const postIdx = route.params.postIdx;

  try {
    // 백엔드에 초대 수락/확인 API 요청을 보냅니다.
    // (백엔드에 해당 API가 구현되어 있어야 합니다. 예: acceptInvite)
    await postApi.inviteUser(postIdx);
    
    alert('초대가 수락되었습니다!');
    
    // 처리가 완료되면 해당 워크스페이스 읽기 페이지로 이동
    await loadpost.side_list();
    router.push(`/workspace/read/${postIdx}`);
  } catch (error) {
    if(error == 200) {
        console.error('Invite error:', error);
        alert('본인의 Post에 본인을 초대할수 없습니다.');
    }else if(error == 300) {
        console.error('Invite error:', error);
        alert('만료된 초대이거나 권한이 없습니다.');
    }
    router.push({ name: 'home' });
  }
});
</script>