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
          path: '/workspace', 
          name: 'workspace',
          component: () => import('../views/WorkSpace.vue'),
          meta: { title: '워크스페이스', requiresAuth: true },
          children: [
            {
              // :id 뒤에 (\\d+)를 붙여 숫자만 매칭되도록 설정
              path: 'read/:id(\\d+)', 
              name: 'workspace_read',
              component: () => import('../views/WorkSpace.vue'),
              meta: { title: '읽기 전용 ', requiresAuth: true },

              // 페이지 진입 전 실행되는 가드
              beforeEnter: async (to, from, next) => {
                try {
                  // result는 이미 { idx, title, contents } 형태입니다.
                  const result = await loadpost.read_post(to.params.id);
                  
                  console.log('라우터 가드에서 받은 데이터:', result);

                  if (result && result.title !== undefined) {
                    to.meta.initialData = {
                      idx: result.idx, // 위에서 추가했다면 사용 가능
                      title: result.title,
                      contents: result.contents
                    };
                    next();
                  } else {
                    next({ name: 'not_found' });
                  }
                } catch (error) {
                  console.error('진입 전 로드 에러:', error);
                  next({ name: 'not_found' });
                }
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
    // 404 페이지 - 모든 잘못된 경로를 캐치 (반드시 맨 마지막!)
    {
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: NotFound,
      meta: { title: '404 - 페이지를 찾을 수 없습니다', requiresAuth: false }
    }
  ],
})

router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  
  // 1. 초기화: 로컬 스토리지 데이터 복구
  if (!authStore.token) {
    authStore.checkLogin()
  }

  // 2. URL 파라미터에 accessToken이 있는지 확인 (소셜 로그인용)
  // to.query는 라우터가 분석한 URL 쿼리 파라미터입니다.
  const hasTokenInUrl = to.query.accessToken || to.query.token

  const isAuthenticated = !!authStore.token

  // 3. 네비게이션 가드 로직
  if (to.meta.requiresAuth) {
    // 인증이 필요한데 토큰이 없고, URL에도 토큰이 없다면 튕김
    if (!isAuthenticated && !hasTokenInUrl) {
      next({ name: 'login' })
    } else {
      // 토큰이 있거나, 지금 막 URL을 통해 토큰을 가지고 들어오는 중이라면 허용
      next()
    }
  } else {
    next()
  }
})

export default router