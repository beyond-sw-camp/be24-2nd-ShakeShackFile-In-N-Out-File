import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'
import NotFound from '@/views/NotFound.vue'
import loadpost from '@/components/workspace/loadpost'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'intro',
      component: () => import('../views/IntroduceView.vue'),
      meta: { title: '소개 - FileInNOut', requiresAuth: false },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/user/LoginView.vue'),
      meta: { title: '로그인', requiresAuth: false },
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('../views/user/SignUpView.vue'),
      meta: { title: '회원가입', requiresAuth: false },
    },
    {
      path: '/payment',
      name: 'payment',
      component: () => import('../views/PaymentView.vue'),
      meta: { title: '요금제', requiresAuth: false },
    },
    {
      path: '/main',
      name: 'main',
      redirect: '/main/home',
      component: () => import('../views/MainView.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: 'home',
          name: 'home',
          component: () => import('../views/dashboard/HomeView.vue'),
          meta: { title: '홈', requiresAuth: true },
        },
        {
          path: 'drive',
          name: 'drive',
          component: () => import('../views/dashboard/DriveView.vue'),
          meta: { title: '내 드라이브', requiresAuth: true },
        },
        {
          path: 'shareFile',
          name: 'shareFile',
          component: () => import('../views/dashboard/ShareFileView.vue'),
          meta: { title: '공유 문서함', requiresAuth: true },
        },
        {
          path: 'recentFile',
          name: 'recentFile',
          component: () => import('../views/dashboard/RecentFileView.vue'),
          meta: { title: '최근 문서함', requiresAuth: true },
        },
        {
          path: 'trash',
          name: 'trash',
          component: () => import('../views/dashboard/TrashView.vue'),
          meta: { title: '휴지통', requiresAuth: true },
        },
        {
          path: 'storage',
          name: 'storage',
          component: () => import('../views/dashboard/StorageView.vue'),
          meta: { title: '저장용량', requiresAuth: true },
        },
        {
          path: 'administrator',
          name: 'administrator',
          component: () => import('../views/dashboard/AdministratorView.vue'),
          meta: { title: '관리자 페이지', requiresAuth: true, requiresAdmin: true },
        },
        {
          path: '/workspace', 
          name: 'workspace',
          component: () => import('@/views/workspace/WorkSpace.vue'),
          meta: { title: '워크스페이스', requiresAuth: true },
          children: [
            {
              // :id 뒤에 (\\d+)를 붙여 숫자만 매칭되도록 설정
              path: 'read/:id(\\d+)', 
              name: 'workspace_read',
              component: () => import('@/views/workspace/WorkSpace.vue'),
              meta: { title: '읽기 전용 ', requiresAuth: true },

              // 페이지 진입 전 실행되는 가드
              beforeEnter: (to, from, next) => {
                fetchWorkspaceData(to, next);
              }
            }
          ],
        },
        // /main/* 하위의 잘못된 경로도 404로 보내기
        {
          path: ':pathMatch(.*)*',
          component: NotFound,
          name : 'not_found',
          meta: { title: '404 - 페이지를 찾을 수 없습니다', requiresAuth: false }
        }
      ],
    },
    { 
      path: '/pay',
      name: 'pay',
      component: () => import('../views/Pay.vue'),
      meta: { title: '결제', requiresAuth: true },
    },
    { 
      path: '/FindMember',
      name: 'FindMember',
      component: () => import('../views/user/FindMember.vue'),
      meta: { title: '회원 찾기', requiresAuth: false },
    },
    {
          path: '/workspace/verify',
          name: 'WorkspaceVerify',
          component: () => import('@/views/workspace/InviteVerify.vue'),
          // postIdx가 꼭 경로에 필요하다면 아래처럼 쓸 수도 있지만, 
          // 이메일 링크의 token 방식을 쓰려면 /workspace/verify 가 가장 깔끔합니다.
    },
    // 404 페이지 - 모든 잘못된 경로를 캐치 (반드시 맨 마지막!)
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: NotFound,
      meta: { title: '404 - 페이지를 찾을 수 없습니다', requiresAuth: false }
    }
  ],
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // 1. 초기화: 로컬 스토리지 데이터 복구 (동기)
  if (!authStore.token) {
    authStore.checkLogin()
  }

  const hasTokenInUrl = to.query.accessToken || to.query.token
  const isAuthenticated = !!authStore.token
  const isAdministrator =
    authStore.user?.email === 'administrator@administrator.adm' &&
    authStore.user?.role === 'ROLE_ADMIN'

  // 2. 인증 필요 페이지 접근 제어 및 Silent Refresh 로직
  if (to.meta.requiresAuth && !isAuthenticated && !hasTokenInUrl) {
    try {
      // Access Token이 없지만 HttpOnly 쿠키의 Refresh Token으로 재발급 시도
      await authStore.reissueToken()
      isAuthenticated = true // 재발급 성공 시 상태 업데이트
    } catch (error) {
      // Refresh Token 만료 또는 쿠키 없음. 재발급 실패 시 로그인 페이지로 강제 이동
      return next({ name: 'login' })
    }
  }

  if (to.meta.requiresAdmin && !isAdministrator) {
    return next({ name: isAuthenticated ? 'home' : 'login' })
  }

  // 4. 워크스페이스 데이터 로드 로직 (방법 3 통합)
  // 대상이 workspace_read 페이지이고, ID가 바뀔 때만 실행
  // 3. 재발급 시도 이후에도 인증되지 않았다면 차단 방어 로직
  if (to.meta.requiresAuth && !isAuthenticated && !hasTokenInUrl) {
    return next({ name: 'login' })
  }

  // 4. 워크스페이스 데이터 로드 로직 (기존 코드 유지)
  if (to.name === 'workspace_read' && to.params.id) {
    if (to.params.id !== from.params.id) {
      try {
        const result = await loadpost.read_post(to.params.id);
        
        if (result && result.title !== undefined) {
          to.meta.initialData = {
            idx: result.idx,
            title: result.title,
            contents: result.contents
          };
          return next();
        } else {
          return next({ name: 'not_found' });
        }
      } catch (error) {
        console.error('워크스페이스 로드 중 에러:', error);
        return next({ name: 'not_found' });
      }
    }
  }

  // 일반적인 라우팅 처리 진행
  next()
})

// 1. 데이터 로드 로직을 별도 함수로 분리 (중복 방지)
const fetchWorkspaceData = async (to, next) => {
  try {
    const result = await loadpost.read_post(to.params.id);
    console.log('라우터 가드에서 받은 데이터:', result);

    if (result && result.title !== undefined) {
      to.meta.initialData = {
        idx: result.idx,
        title: result.title,
        contents: result.contents
      };
      next();
    } else {
      next({ name: 'not_found' });
    }
  } catch (error) {
    console.error('데이터 로드 에러:', error);
    next({ name: 'not_found' });
  }
};


export default router
