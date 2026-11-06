import axios from 'axios'

// 백엔드 주소
export const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const client = axios.create({
  baseURL: BASE_URL,
})

// 모든 요청에 로그인 토큰을 자동으로 붙여요
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default client