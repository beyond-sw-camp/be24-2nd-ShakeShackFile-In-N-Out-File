import postApi from "@/api/postApi";
import { ref } from 'vue';

// ─────────────────────────────────────────────────────────────────────────────
// 상태
// ─────────────────────────────────────────────────────────────────────────────

const personalItems = ref([]);
const sharedItems   = ref([]);
const isPersonalOpen = ref(true);
const isSharedOpen   = ref(true);
const currentPost    = ref({ title: '', contents: null });

// ─────────────────────────────────────────────────────────────────────────────
// 사이드바 목록
// apiCall → extractBody 를 거쳐 result.body 가 이미 unwrap 된 상태로 넘어옴
// allPosts() 반환값 = PostDto.ResList[]  (배열 그 자체)
// ─────────────────────────────────────────────────────────────────────────────

const side_list = async () => {
    try {
        // response = PostDto.ResList[]
        const response = await postApi.allPosts();
        console.log('목록 가져오기 성공:', response);

        personalItems.value = [];
        sharedItems.value   = [];

        if (Array.isArray(response)) {
            response.forEach(item => {
                if (item.status && item.status.toUpperCase() !== 'PRIVATE') {
                    sharedItems.value.push(item);
                } else {
                    personalItems.value.push(item);
                }
            });
        }

        return response;

    } catch (e) {
        // workspaceApi 에서 이미 [side_list] 실패 — [code] message 형태로 출력됨
        personalItems.value = [];
        sharedItems.value   = [];
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// 워크스페이스 단건 조회
// getPost() 반환값 = PostDto.ResPost  (객체 그 자체)
// ─────────────────────────────────────────────────────────────────────────────

const read_post = async (idx) => {
    try {
        // data = PostDto.ResPost
        const data = await postApi.getPost(idx);
        console.log('워크스페이스 가져오기 성공:', data);

        let parsedContents;
        try {
            if (typeof data.contents === 'string' && data.contents.trim().startsWith('{')) {
                parsedContents = JSON.parse(data.contents);
            } else {
                parsedContents = data.contents;
            }
        } catch {
            console.warn('JSON 파싱 실패, 원본 데이터를 사용합니다.');
            parsedContents = data.contents;
        }

        currentPost.value = {
            idx:        data.idx,
            title:      data.title,
            contents:   parsedContents,
            type:       data.type,
            status:     data.status     ?? 'Private',
            uuid:       data.uuid       ?? data.UUID ?? '',
            accessRole: data.accessRole ?? data.level ?? 'ADMIN',
            level:      data.level      ?? data.accessRole ?? 'ADMIN',
        };

        return currentPost.value;

    } catch (e) {
        // workspaceApi 에서 이미 [getPost] 실패 — [code] message 형태로 출력됨
    }
};

// ─────────────────────────────────────────────────────────────────────────────

export default {
    personalItems,
    sharedItems,
    isPersonalOpen,
    isSharedOpen,
    currentPost,
    side_list,
    read_post,
}