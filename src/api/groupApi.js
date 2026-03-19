import { api } from "@/plugins/axiosinterceptor";

const unwrapResult = (response) => response?.data?.result?.body ?? response?.data?.result ?? response?.data;

export const fetchGroupOverview = async () => {
  const response = await api.get("/group/overview");
  return unwrapResult(response);
};

export const fetchChatShareOverview = async () => {
  const response = await api.get("/group/share/chats/overview");
  return unwrapResult(response);
};

export const fetchRelationships = async () => {
  const response = await api.get("/group/relationships");
  return unwrapResult(response);
};

export const createRelationshipInvite = async (payload) => {
  const response = await api.post("/group/invites", payload);
  return unwrapResult(response);
};

export const deleteRelationship = async (relationshipId) => {
  const response = await api.delete(`/group/relationships/${relationshipId}`);
  return unwrapResult(response);
};

export const acceptRelationshipInvite = async (inviteId) => {
  const response = await api.patch(`/group/invites/${inviteId}/accept`);
  return unwrapResult(response);
};

export const rejectRelationshipInvite = async (inviteId) => {
  const response = await api.patch(`/group/invites/${inviteId}/reject`);
  return unwrapResult(response);
};

export const createGroup = async (name) => {
  const response = await api.post("/group/groups", { name });
  return unwrapResult(response);
};

export const renameGroup = async (groupId, name) => {
  const response = await api.patch(`/group/groups/${groupId}`, { name });
  return unwrapResult(response);
};

export const deleteGroup = async (groupId) => {
  const response = await api.delete(`/group/groups/${groupId}`);
  return unwrapResult(response);
};

export const addRelationshipToGroup = async (relationshipId, groupId) => {
  const response = await api.post(`/group/relationships/${relationshipId}/groups`, { groupId });
  return unwrapResult(response);
};

export const replaceRelationshipGroups = async (relationshipId, groupIds) => {
  const response = await api.put(`/group/relationships/${relationshipId}/groups`, { groupIds });
  return unwrapResult(response);
};

export const removeRelationshipFromGroup = async (relationshipId, groupId) => {
  const response = await api.delete(`/group/relationships/${relationshipId}/groups/${groupId}`);
  return unwrapResult(response);
};

export const createGroupInvite = async (payload) => {
  const response = await api.post("/group/group-invites", payload);
  return unwrapResult(response);
};

export const acceptGroupInvite = async (inviteId) => {
  const response = await api.patch(`/group/group-invites/${inviteId}/accept`);
  return unwrapResult(response);
};

export const rejectGroupInvite = async (inviteId) => {
  const response = await api.patch(`/group/group-invites/${inviteId}/reject`);
  return unwrapResult(response);
};

export const shareFilesWithTargets = async ({ fileIds, userIds = [], groupIds = [], emails = [] }) => {
  const response = await api.post("/group/share/files", {
    fileIds,
    userIds,
    groupIds,
    emails,
  });
  return unwrapResult(response);
};

export const shareWorkspacesWithTargets = async ({ workspaceId, userIds = [], groupIds = [], emails = [] }) => {
  const response = await api.post("/group/share/workspaces", {
    workspaceId,
    userIds,
    groupIds,
    emails,
  });
  return unwrapResult(response);
};

export const shareChatsWithTargets = async ({ roomId, userIds = [], groupIds = [], emails = [] }) => {
  const response = await api.post("/group/share/chats", {
    roomId,
    userIds,
    groupIds,
    emails,
  });
  return unwrapResult(response);
};
