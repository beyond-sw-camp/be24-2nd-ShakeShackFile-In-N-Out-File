import { api } from "@/plugins/axiosinterceptor";

const extractObjectResult = (responseData) => {
  if (!responseData) return null;
  if (responseData?.result && typeof responseData.result === "object") return responseData.result;
  if (responseData?.data?.result && typeof responseData.data.result === "object") return responseData.data.result;
  if (typeof responseData === "object") return responseData;
  return null;
};

export async function fetchAdministratorDashboard() {
  const response = await api.get("/administrator/dashboard", {
    timeout: 30000,
  });
  return extractObjectResult(response?.data);
}

export async function updateAdministratorUserStatus(userIdx, accountStatus) {
  const response = await api.patch(`/administrator/users/${userIdx}/status`, {
    accountStatus,
  });
  return extractObjectResult(response?.data);
}

export async function fetchAdministratorStorageAnalytics(rangeCode) {
  const response = await api.get("/administrator/storage-analytics", {
    params: rangeCode ? { range: rangeCode } : undefined,
    timeout: 30000,
  });
  return extractObjectResult(response?.data);
}

export async function updateAdministratorStorageCapacity(providerCapacityBytes, rangeCode) {
  const response = await api.patch(
    "/administrator/storage-capacity",
    { providerCapacityBytes },
    {
      params: rangeCode ? { range: rangeCode } : undefined,
    },
  );
  return extractObjectResult(response?.data);
}
