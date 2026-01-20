import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/plugins/axiosinterceptor.js'

export const useFileStore = defineStore('file', () => {
  const allFiles = ref([])
  const currentFolderId = ref(null)
  // 데이터 로드
  const fetchFiles = async () => {
    try {
      const response = await api.api.get('/json/files/fileList')
      allFiles.value = response.data
    } catch (error) {
      console.error("파일 로드 실패:", error)
    }
  }

  // 1. 내 드라이브 (휴지통에 없고, 공유되지 않은 내 파일)
  const driveFiles = computed(() => 
    allFiles.value.filter(f => 
      !f.isTrash && 
      f.owner === '나' && 
      (f.parentId || null) === currentFolderId.value
    )
  )

  // 2. 공유 문서함 (공유 상태인 파일)
  const sharedFiles = computed(() => 
    allFiles.value.filter(f => f.isShared && !f.isTrash)
  )

  // 3. 최근 문서함 (최근 수정일 순으로 정렬)
  const recentFiles = computed(() => {
  return [...allFiles.value]
    .filter(f => !f.isTrash && f.type !== 'folder') // 이 부분에 type 체크 추가
    .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
  })

  // 4. 휴지통 (isTrash가 true인 파일)
  const trashFiles = computed(() => 
    allFiles.value.filter(f => f.isTrash)
  )

  // 휴지통으로 이동 함수
  const moveToTrash = (fileId) => {
    const file = allFiles.value.find(f => f.id === fileId)
    if (file) {
      file.isTrash = true
      alert(`'${file.name}'이(가) 휴지통으로 이동되었습니다.`)
    }
  }
  // 폴더 만들기 함수
  const createFolder = (folderName) => {
  const newFolder = {
    id: Date.now(), // 임시 ID 생성
    name: folderName,
    reason: "새로 생성됨",
    owner: "나",
    location: "내 드라이브",
    date: new Date().toLocaleDateString(),
    lastModified: new Date().toISOString(),
    isTrash: false,
    isShared: false,
    type: 'folder' // 파일과 구분하기 위한 타입 추가
  }
  allFiles.value.unshift(newFolder) // 목록 맨 앞에 추가
}
  
  //폴더 진입 함수
  const enterFolder = (folderId) => {
    currentFolderId.value = folderId
  }

  // 3. 상위로 나가기 (뒤로가기)
  const goBack = () => {
    if (currentFolderId.value) {
      const currentFolder = allFiles.value.find(f => f.id === currentFolderId.value)
      // 부모의 부모 ID로 이동하거나, 없으면 최상위(null)로
      currentFolderId.value = currentFolder?.parentId || null
    }
  }
 const moveFileToFolder = (fileId, folderId) => {
    const file = allFiles.value.find(f => String(f.id) === String(fileId))
    if (file) {
      file.parentId = folderId // 여기서 parentId를 심어줘야 필터링이 작동함
      file.location = allFiles.value.find(f => f.id === folderId)?.name || '폴더'
    }
  }
  const allOnlyFiles = computed(() => 
  allFiles.value.filter(f => !f.isTrash && f.type !== 'folder')
  )

  return { allFiles, 
  currentFolderId, 
  driveFiles, 
  sharedFiles, 
  recentFiles,  
  trashFiles,   
  enterFolder, 
  goBack, 
  moveFileToFolder, 
  fetchFiles, 
  createFolder,
  moveToTrash }
})