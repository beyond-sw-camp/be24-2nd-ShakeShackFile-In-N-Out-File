import { api } from '@/plugins/axiosinterceptor'

const signup = async (req) => {
  const res = await api.post('/user/signup', req)

  return res
}

const login = async (req) => {
  const res = await api.post('/user/login', req)

  return res
}

export default { signup, login }
