import api from '@/plugins/axiosinterceptor' 

// 게시글 저장
const savePost = async (formData) => {
  try {
    const response = await api.post('/workspace/save', formData);
    return response.data; 
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// 게시글 상세 조회
const getPost = async (idx) => {
  try {
    const response = await api.get(`/workspace/read/${idx}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// 모든 게시글 목록 조회
const allPosts = async () => {
  try {
    const response = await api.get('/workspace/list');
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// 게시글 삭제
const deletePost = async (idx) => {
  try {
    const response = await api.post(`/workspace/delete/${idx}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * 사용자 초대 API
 * @param {Object} inviteData - { email: string, uuid: string, type: string }
 */
const inviteUser = async (inviteData) => {
  try {
    // params에 email을 추가하여 @RequestParam이 인식할 수 있게 합니다.
    const response = await api.post('/workspace/invite', null, {
      params: {
        uuid: inviteData.uuid,
        type: inviteData.type,
        email: inviteData.email
      }
    });
    return response.data;
  } catch (error) {
    console.error('API Error (inviteUser):', error);
    throw error;
  }
}

/**
 * 공유 상태 업데이트 API
 * @param {Number|String} idx - 게시글 인덱스 (경로 변수)
 * @param {String} status - 'PRIVATE', 'SHARED', 'PUBLIC' (Enum 대응)
 */
const updateShareStatus = async (idx, status) => {
  try {
    // 백엔드 ReqType DTO 구조에 맞춤
    const requestBody = {
      type: status !== 'Private', // Private일 경우 false, 그 외에는 true
      status: status              // Private, Shared, Public 중 하나
    };
    
    // 경로에 post_idx 포함하여 전송
    const response = await api.post(`/workspace/isShared/${idx}`, requestBody);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
/**
 * 권한 리스트 불러오기 API
 * @param {Number|String} idx - 게시글 인덱스
 */
const loadRole = async (idx) => {
  try {
    const response = await api.get(`/workspace/loadRole/${idx}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * 변경된 권한 저장 API (차후 로직 구현용 틀)
 * @param {Number|String} idx - 게시글 인덱스
 * @param {Array} roleData - 변경된 멤버 권한 리스트
 */
const saveRole = async (idx, roleData) => {
  try {
    // 나중에 백엔드 API 주소 및 포맷이 확정되면 수정하세요.
    const response = await api.post(`/workspace/saveRole/${idx}`, roleData);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

/**
 * 워크스페이스 초대 인증 확인 API
 * @param {String} uuid - 이메일에서 넘어온 토큰값 (백엔드의 uuid)
 * @param {String} type - accept 또는 reject
 */
const verifyEmail = async (uuid, type) => {
  try {
    // 백엔드 컨트롤러(@RequestParam("uuid"), @RequestParam("type"))에 맞춰 파라미터 전송
    const response = await api.get('/workspace/verify', {
      params: {
        uuid: uuid,
        type: type
      }
    });
    return response.data;
  } catch (error) {
    console.error('Verify Email Error:', error);
    throw error;
  }
}


export default { 
  savePost, 
  getPost, 
  allPosts, 
  deletePost, 
  inviteUser, 
  updateShareStatus,
  loadRole,
  saveRole,
  verifyEmail
}