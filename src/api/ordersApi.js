import { api } from "@/plugins/axiosinterceptor";

const extractObjectResult = (responseData) => {
  if (!responseData) return null;
  if (responseData?.result && typeof responseData.result === "object") return responseData.result;
  if (responseData?.data?.result && typeof responseData.data.result === "object") return responseData.data.result;
  if (typeof responseData === "object") return responseData;
  return null;
};

export async function createOrder(productCode) {
  const response = await api.post("/api/orders", {
    productCode,
  });
  return extractObjectResult(response?.data);
}

export async function verifyOrder(paymentId, orderId) {
  const response = await api.post("/api/orders/verify", {
    paymentId,
    orderId,
  });
  return extractObjectResult(response?.data) || response?.data;
}