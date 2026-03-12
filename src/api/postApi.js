import api from '@/plugins/axiosinterceptor' 

// 게시글 저장 / 불러오기 / 모두 불러오기 / 삭제
const savePost = async (formData) => {
  try {
    const response = await api.post('/workspace/save', formData);
    return response.data; 
  } catch (error) {
    console.error(error);
    throw error;
  }
}

const getPost = async (idx) => {
  try {
    const response = await api.get(`/workspace/read/${idx}`);
    return response.data; // 여기서 반환되는 객체에 title, contents가 있어야 함
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

const deletePost = async (idx) => {
  try {
    const response = await api.post(`/workspace/delete/${idx}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export default { savePost, getPost, allPosts, deletePost }