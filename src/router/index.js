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
          meta: { title: '저장 용량', requiresAuth: true },
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
          component: () => import('../views/WorkSpace.vue'),
          meta: { title: '워크스페이스', requiresAuth: true },
          children: [
            {
              path: 'read/:id(\\d+)',
              name: 'workspace_read',
              component: () => import('../views/WorkSpace.vue'),
              meta: { title: '읽기 전용', requiresAuth: true },
              beforeEnter: (to, from, next) => {
                fetchWorkspaceData(to, next)
              },
            },
          ],
        },
        {
          path: ':pathMatch(.*)*',
          component: NotFound,
          name: 'not_found',
          meta: { title: '404 - 페이지를 찾을 수 없습니다', requiresAuth: false },
        },
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
      path: '/:pathMatch(.*)*',
      name: 'notFound',
      component: NotFound,
      meta: { title: '404 - 페이지를 찾을 수 없습니다', requiresAuth: false },
    },
  ],
})

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  if (!authStore.token) {
    authStore.checkLogin()
  }

  const hasTokenInUrl = to.query.accessToken || to.query.token
  const isAuthenticated = !!authStore.token
  const isAdministrator = authStore.user?.email === 'administrator@administrator.adm' && authStore.user?.role === 'ROLE_ADMIN'

  if (to.meta.requiresAuth) {
    if (!isAuthenticated && !hasTokenInUrl) {
      return next({ name: 'login' })
    }
  }

  if (to.meta.requiresAdmin && !isAdministrator) {
    return next({ name: isAuthenticated ? 'home' : 'login' })
  }

  if (to.name === 'workspace_read' && to.params.id) {
    if (to.params.id !== from.params.id) {
      try {
        const result = await loadpost.read_post(to.params.id)

        if (result && result.title !== undefined) {
          to.meta.initialData = {
            idx: result.idx,
            title: result.title,
            contents: result.contents,
          }
          return next()
        }
        return next({ name: 'not_found' })
      } catch (error) {
        console.error('워크스페이스 로드 중 에러:', error)
        return next({ name: 'not_found' })
      }
    }
  }

  next()
})

const fetchWorkspaceData = async (to, next) => {
  try {
    const result = await loadpost.read_post(to.params.id)
    console.log('라우트 가드에서 받은 데이터:', result)

    if (result && result.title !== undefined) {
      to.meta.initialData = {
        idx: result.idx,
        title: result.title,
        contents: result.contents,
      }
      next()
    } else {
      next({ name: 'not_found' })
    }
  } catch (error) {
    console.error('데이터 로드 에러:', error)
    next({ name: 'not_found' })
  }
}

export default router
