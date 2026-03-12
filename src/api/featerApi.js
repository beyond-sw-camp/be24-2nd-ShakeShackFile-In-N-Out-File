import { api } from "@/plugins/axiosinterceptor";

const extractObjectResult = (responseData) => {
  if (!responseData) return null;
  if (responseData?.result && typeof responseData.result === "object") return responseData.result;
  if (responseData?.data?.result && typeof responseData.data.result === "object") return responseData.data.result;
  if (typeof responseData === "object") return responseData;
  return null;
};

export async function fetchSettingsProfile() {
  const response = await api.get("/feater/settings/me");
  return extractObjectResult(response?.data);
}

export async function updateSettingsProfile(payload) {
  const response = await api.put("/feater/settings/me", payload);
  return extractObjectResult(response?.data);
}

export async function uploadSettingsProfileImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await api.post("/feater/settings/me/profile-image", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return extractObjectResult(response?.data);
}
