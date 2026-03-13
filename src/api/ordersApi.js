import { api } from "@/plugins/axiosinterceptor";

export const ordersApi = {
  // 1. 주문 생성 (결제 전)
  async createOrder(payload) {
    const response = await api.post("/api/orders", payload);
    return response.data;
  },
  
  // 2. 주문 검증 (결제 후)
  async verifyOrder(payload) {
    const response = await api.post("/api/orders/verify", payload);
    return response.data;
  }
};
