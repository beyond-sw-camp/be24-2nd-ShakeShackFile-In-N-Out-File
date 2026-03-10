import postApi from '@/plugins/axiosinterceptor'

const posts = postApi.postApi

// 게시글 저장 / 불러오기 / 모두 불러오기
const savePost = async (postData) => {
  try {
    const post = await posts.post('api/workspace/save', postData)
    console.log(post)
    return post
  } catch (error) {
    console.log(error)
    return error
  }
}
const getPost = async (idx) => {
  try {
    const post = await posts.get(`api/workspace/read/${idx}`)
    console.log(api)
    return post
  } catch (error) {
    console.log(error)
    return error
  }
}
const allPosts = async () => {
  try {
    const post = await posts.get('api/list')
    console.log(api)
    return post
  } catch (error) {
    console.log(error)
    return error
  }
}

export default { savePost, getPost, allPosts }