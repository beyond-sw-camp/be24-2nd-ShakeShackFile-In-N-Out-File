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
          redirect: { name: 'home' },
          meta: { title: '홈', requiresAuth: true },
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
              // 추가된 부분: /invite 로 들어와도 WorkSpace 컴포넌트를 연결해줌
              path: 'invite',
              name: 'workspace_invite',
              component: () => import('@/views/workspace/WorkSpace.vue'),
              meta: { title: '초대 링크 이동 중', requiresAuth: true },
            },
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
            },
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
    {
      path: '/workspace/readonly/:id',
      name: 'workspace_readonly',
      component: () => import('@/views/workspace/WorkSpaceReadOnly.vue'),
      meta : { requiresAuth: true},
    },
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
  
  // 1. 초기화: 로컬 스토리지 데이터 복구
  if (!authStore.token) {
    authStore.checkLogin()
  }

  // 2. URL 파라미터에 accessToken이 있는지 확인 (소셜 로그인용)
  // to.query는 라우터가 분석한 URL 쿼리 파라미터입니다.
  const hasTokenInUrl = to.query.accessToken || to.query.token
  const isAuthenticated = !!authStore.token
  const adminEmail = String(authStore.user?.email || '').toLowerCase()
  const adminRole = String(authStore.user?.role || '').toUpperCase()
  const isAdministrator =
    adminRole.includes('ADMIN') ||
    adminEmail === 'administrator@administrator.adm'

  // 3. 네비게이션 가드 로직
  if (to.meta.requiresAuth) {
    // 인증이 필요한데 토큰이 없고, URL에도 토큰이 없다면 튕김
    if (!isAuthenticated && !hasTokenInUrl) {
      return next({ name: 'login' })
    }
  }

  if (to.meta.requiresAdmin && !isAdministrator) {
    return next({ name: isAuthenticated ? 'home' : 'login' })
  }

  // 4. 워크스페이스 데이터 로드 로직 (기존 코드 유지 및 type 보강)
  if (to.name === 'workspace_read' && to.params.id) {
    // 이전 페이지와 ID가 다르거나, 아예 처음 진입하는 경우 데이터 호출
    if (to.params.id !== from.params.id) {
      try {
        const result = await loadpost.read_post(to.params.id);
        
        if (result && result.title !== undefined) {
          // 데이터를 meta에 저장하여 컴포넌트에서 쓸 수 있게 함
          to.meta.initialData = {
            idx: result.idx,
            title: result.title,
            contents: result.contents,
            type: result.type,
            status: result.status,
            uuid: result.uuid,
            accessRole: result.accessRole || result.level,
            level: result.level || result.accessRole,
          };
          return next(); // 데이터 로드 성공 시 이동
        } else {
          return next({ name: 'not_found' });
        }
      } catch (error) {
        console.error('워크스페이스 로드 중 에러:', error);
        return next({ name: 'not_found' });
      }
    }
  }

  // 위 조건들에 해당하지 않는 일반적인 이동은 그대로 진행
  next()
})

// ✨ 데이터 로드 로직 함수 수정 (type 필드 추가)
const fetchWorkspaceData = async (to, next) => {
  try {
    const result = await loadpost.read_post(to.params.id);
    console.log('라우터 가드에서 받은 데이터:', result);

    if (result && result.title !== undefined) {
      to.meta.initialData = {
        idx: result.idx,
        title: result.title,
        contents: result.contents,
        type: result.type,
        status: result.status,
        uuid: result.uuid,
        accessRole: result.accessRole || result.level,
        level: result.level || result.accessRole,
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
