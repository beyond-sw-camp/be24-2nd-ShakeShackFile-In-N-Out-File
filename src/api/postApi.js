import api from '@/plugins/axiosinterceptor' // default import이므로 이름을 api로 받습니다.

// 게시글 저장 / 불러오기 / 모두 불러오기
const savePost = async (formData) => {
  try {
    // interceptor에서 baseURL이 '/api'이므로 그 뒤의 경로만 적습니다.
    const response = await api.post('/workspace/save', formData);
    return response.data; // axios는 결과가 data에 담깁니다.
  } catch (error) {
    console.error(error);
    throw error;
  }
}

const getPost = async (idx) => {
  try {
    // baseURL(/api) + 경로이므로 'api/'는 중복이라 제거했습니다.
    console.log(idx);
    const response = await api.get(`/workspace/read/${idx}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

const allPosts = async () => {
  try {
    const response = await api.get('/workspace/list');
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export default { savePost, getPost, allPosts }