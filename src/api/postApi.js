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
 * @param {Object} inviteData - { email: string, post_idx: number|string }
 */
const inviteUser = async (idx) => {
  try {
    const response = await api.post(`/workspace/invite/${idx}`);
    return response.data;
  } catch (error) {
    console.error(error);
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

export default { 
  savePost, 
  getPost, 
  allPosts, 
  deletePost, 
  inviteUser, 
  updateShareStatus 
}