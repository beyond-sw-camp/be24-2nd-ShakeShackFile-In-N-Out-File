import postApi from "@/api/postApi";
import { ref } from 'vue';

// 상태 관리
const personalItems = ref([]); 
const sharedItems = ref([]);   
const isPersonalOpen = ref(true);
const isSharedOpen = ref(true);

/**
 * 사이드바 목록을 가져오는 함수
 * 인터셉터에서 토큰을 처리하므로 인자로 token을 직접 쓸 필요는 없으나, 
 * 구조 유지를 위해 유지하되 내부 로직은 최적화했습니다.
 */
const side_list = async () => {
    try {
        const response = await postApi.allPosts();
        console.log('목록 가져오기 성공:', response);

        // 1. 데이터가 있는지 안전하게 확인
        if (response && response.result && response.result.body) {
            const allItems = response.result.body; // 전체 리스트 (Array(2))

            // 2. 초기화 (재호출 시 데이터 중복 방지)
            personalItems.value = [];
            sharedItems.value = [];

            // 3. 반복문을 돌며 속성에 따라 분류
            allItems.forEach(item => {
                // 백엔드에서 구분해주는 필드명을 확인하세요 (예: item.type 또는 item.isTeam)
                if (item.Type === true) {
                    sharedItems.value.push(item);
                } else {
                    // 기본적으로는 개인 페이지로 분류
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
            // 내용이 문자열이고 JSON 형식({ 로 시작)일 때만 파싱
            if (typeof data.contents === 'string' && data.contents.trim().startsWith('{')) {
                parsedContents = JSON.parse(data.contents);
            } else {
                parsedContents = data.contents;
            }
        } catch (jsonError) {
            // 파싱 실패 시 원본 문자열을 그대로 사용 (에러 방지)
            console.warn('JSON 파싱 실패, 원본 데이터를 사용합니다.');
            parsedContents = data.contents;
        }

        currentPost.value = {
            idx: data.idx,
            title: data.title,
            contents: parsedContents // { time, blocks, version } 구조의 객체
        };

        return currentPost.value;
        
    } catch (e) {
        console.error('side_list error:', e);
    }
}

// 템플릿에서 사용할 변수와 함수를 같이 내보냅니다.
export default {
    personalItems,
    sharedItems,
    isPersonalOpen,
    isSharedOpen,
    side_list,
    read_post
}