import postApi from "@/api/postApi";
import { ref } from 'vue';

// 상태 관리
const personalItems = ref([]); 
const sharedItems = ref([]);   
const isPersonalOpen = ref(true);
const isSharedOpen = ref(true);

/**
 * 사이드바 목록을 가져오는 함수
 * 백엔드 ResList DTO의 UUID 필드를 포함한 전체 객체를 저장합니다.
 */
const side_list = async () => {
    try {
        const response = await postApi.allPosts();
        console.log('목록 가져오기 성공:', response);

        if (response && response.result && response.result.body) {
            const allItems = response.result.body; 

            // 초기화
            personalItems.value = [];
            sharedItems.value = [];

            allItems.forEach(item => {
                // item 객체 내부에는 post_idx, title, status, uuid(UUID)가 포함되어 있음
                if (item.status && item.status.toUpperCase() !== 'PRIVATE') {
                    sharedItems.value.push(item);
                } else {
                    personalItems.value.push(item);
                }
            });
        }

        return response; 
        
    } catch (e) {
        console.error('side_list error:', e);
        personalItems.value = [];
        sharedItems.value = [];
    }
}

// 상세 데이터를 담을 변수 추가
const currentPost = ref({ title: '', contents: null });

const read_post = async (idx) => {
    try {
        const response = await postApi.getPost(idx);
        console.log('워크스페이스 가져오기 성공:', response);

        const data = response.result.body;

        let parsedContents;
        try {
            if (typeof data.contents === 'string' && data.contents.trim().startsWith('{')) {
                parsedContents = JSON.parse(data.contents);
            } else {
                parsedContents = data.contents;
            }
        } catch (jsonError) {
            console.warn('JSON 파싱 실패, 원본 데이터를 사용합니다.');
            parsedContents = data.contents;
        }

        currentPost.value = {
            idx: data.idx,
            title: data.title,
            contents: parsedContents 
        };

        return currentPost.value;
        
    } catch (e) {
        console.error('read_post error:', e);
    }
}

export default {
    personalItems,
    sharedItems,
    isPersonalOpen,
    isSharedOpen,
    side_list,
    read_post
}