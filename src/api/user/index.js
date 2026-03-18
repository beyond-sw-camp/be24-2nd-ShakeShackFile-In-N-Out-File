import { api } from '@/plugins/axiosinterceptor'

const signup = async (req) => {
  const res = await api.post('/user/signup', req)

  return res
}

const login = async (req) => {
  const res = await api.post('/login', req)

  return res
}

const logout = async () => {
  const res = await api.post('/auth/logout')
  return res
}

export default { signup, login, logout }
