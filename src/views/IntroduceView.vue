<script setup>
import IntrodHeader from '@/components/IntrodHeader.vue';
</script>

<template>
  <div class="bg-white font-sans">
    <IntrodHeader></IntrodHeader>

    <section class="pt-20 pb-24 px-6 md:px-12 text-center">
      <h1 class="text-4xl md:text-6xl font-bold text-slate-900 leading-tight mb-6 tracking-tight">
        모든 파일을 한곳에,<br class="hidden md:block"> 팀 협업을 하나의 페이지에서.
      </h1>
      <p class="text-2g text-slate-550 max-w-2xl mx-auto mb-10 leading-relaxed">
        강력한 클라우드 드라이브와 실시간 문서 협업 도구의 결합.<br>
        FileInNOut으로 흩어진 도구들을 하나로 모으고 스마트한 워크플로우를 경험하세요.
      </p>
      <div class="flex justify-center gap-4 mb-16">
        <RouterLink to="/signup" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
          지금 시작하기 <i class="fa-solid fa-arrow-right ml-2 text-sm"></i>
        </RouterLink>
      </div>
      <div class="max-w-5xl mx-auto p-2 bg-slate-100 rounded-2xl shadow-xl overflow-hidden">
        <img src="@/assets/images/Dashboard.png" alt="FileInNOut Dashboard Preview" class="w-full rounded-xl border border-slate-200/50">
      </div>
    </section>

    <section class="py-24 bg-slate-50 px-6 md:px-12">
      <div class="max-w-6xl mx-auto">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-slate-900 mb-4">하나의 공간에서 완성되는 작업 흐름</h2>
          <p class="text-slate-500">개인의 파일 관리부터 팀 프로젝트 문서 작성까지 완벽하게 지원합니다.</p>
        </div>
        <div class="grid md:grid-cols-3 gap-8">
          <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
            <div class="w-14 h-14 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
              <i class="fa-solid fa-hard-drive"></i>
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-3">강력한 드라이브</h3>
            <p class="text-slate-500 leading-relaxed">모든 파일을 안전하게 저장하고, 직관적인 폴더 구조와 강력한 검색으로 빠르게 찾아보세요.</p>
          </div>
          <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
            <div class="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
              <i class="fa-solid fa-file-pen"></i>
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-3">실시간 협업 페이지</h3>
            <p class="text-slate-500 leading-relaxed">팀원들과 동시에 문서를 편집하고 의견을 나누세요. 블록 기반 에디터로 자유롭게 문서를 구성합니다.</p>
          </div>
          <div class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
            <div class="w-14 h-14 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform">
              <i class="fa-solid fa-users-gear"></i>
            </div>
            <h3 class="text-xl font-bold text-slate-800 mb-3">통합 워크스페이스</h3>
            <p class="text-slate-500 leading-relaxed">프로젝트별로 공간을 나누고 팀원을 초대하여 권한을 관리하세요. 모든 자료가 한곳에 모입니다.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="py-24 px-6 md:px-12 max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-20">
      <div class="md:w-1/2 order-2 md:order-1">
        <div class="p-2 bg-slate-100 rounded-2xl shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300">
          <img src="@/assets/images/Drive.png" alt="FileInNOut Drive Interface" class="w-full rounded-xl border border-slate-200/50">
        </div>
      </div>
      <div class="md:w-1/2 order-1 md:order-2 space-y-6">
        <span class="text-blue-600 font-bold text-sm uppercase tracking-wider">스마트 드라이브</span>
        <h2 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">흩어진 파일을<br>한눈에 관리하세요</h2>
        <p class="text-lg text-slate-500 leading-relaxed">
          직관적인 인터페이스로 개인 파일부터 팀 공유 문서까지 손쉽게 관리할 수 있습니다. 즐겨찾기, 최근 문서함, 강력한 검색 기능으로 필요한 자료에 즉시 접근하세요.
        </p>
        <ul class="space-y-3 text-slate-600 font-medium">
          <li class="flex items-center gap-3"><i class="fa-solid fa-check text-blue-500"></i> 직관적인 폴더 및 파일 관리</li>
          <li class="flex items-center gap-3"><i class="fa-solid fa-check text-blue-500"></i> 팀원 간 간편한 문서 공유 및 권한 설정</li>
          <li class="flex items-center gap-3"><i class="fa-solid fa-check text-blue-500"></i> 모든 파일 형식 지원 및 미리보기</li>
        </ul>
      </div>
    </section>

    <section class="py-24 px-6 md:px-12 bg-slate-50">
      <div class="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-20">
        <div class="md:w-1/2 space-y-6">
          <span class="text-indigo-600 font-bold text-sm uppercase tracking-wider">실시간 협업 페이지</span>
          <h2 class="text-3xl md:text-4xl font-bold text-slate-900 leading-tight">아이디어 공유와 문서 작성을<br>위한 살아있는 공간</h2>
          <p class="text-lg text-slate-500 leading-relaxed">
            팀원들과 동시에 접속하여 문서를 작성하고 댓글로 피드백을 주고받으세요. 텍스트, 이미지, 할 일 목록 등 다양한 블록을 레고처럼 조합하여 자유롭게 페이지를 구성할 수 있습니다.
          </p>
          <ul class="space-y-3 text-slate-600 font-medium">
            <li class="flex items-center gap-3"><i class="fa-solid fa-check text-indigo-500"></i> 다자간 실시간 동시 편집 지원</li>
            <li class="flex items-center gap-3"><i class="fa-solid fa-check text-indigo-500"></i> 직관적인 블록 기반 문서 에디터</li>
            <li class="flex items-center gap-3"><i class="fa-solid fa-check text-indigo-500"></i> 드라이브 파일과 문서의 완벽한 연결</li>
          </ul>
        </div>
        <div class="md:w-1/2">
          <div class="p-2 bg-white rounded-2xl shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 border border-slate-100">
            <img src="@/assets/images/Editor.png" alt="FileInNOut Collaboration Editor" class="w-full rounded-xl border border-slate-50">
            </div>
        </div>
      </div>
    </section>

    <section class="py-32 px-6 md:px-12 text-center bg-slate-900 relative overflow-hidden">
        <div class="absolute inset-0 opacity-10 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        <div class="relative z-10 max-w-3xl mx-auto">
          <h2 class="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight tracking-tight">더 이상 여러 도구를<br>오갈 필요가 없습니다.</h2>
          <p class="text-lg text-slate-300 mb-10 leading-relaxed">
              FileInNOut 하나로 파일 관리와 팀 협업을 통합하고,<br class="hidden md:block"> 가장 생산적인 업무 환경을 경험해보세요.
          </p>
          <RouterLink to="/signup" class="bg-blue-500 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              지금 무료로 시작하기
          </RouterLink>
        </div>
    </section>

    <footer class="py-12 px-6 md:px-12 border-t border-slate-100 text-center md:text-left">
        <div class="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div class="flex items-center gap-3">
        <div class="w-9 h-9 bg-blue-600 rounded-lg shadow-lg shadow-blue-200 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <p class="font-bold">FileInNOut</p>
      </div>
            <div class="flex gap-6 text-sm text-slate-500 font-medium">
                <a href="#" class="hover:text-blue-600 transition-colors">개인정보처리방침</a>
                <a href="#" class="hover:text-blue-600 transition-colors">이용약관</a>
                <a href="#" class="hover:text-blue-600 transition-colors">문의하기</a>
            </div>
            <p class="text-xs text-slate-400">© 2024 FileInNOut Inc. All rights reserved.</p>
        </div>
    </footer>
  </div>
</template>

<style>
/* Font Awesome CDN을 불러와야 아이콘이 정상적으로 보입니다. */
@import url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css");
</style>