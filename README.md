<div align="center">
<!-- 타이틀 이미지 -->
<img src="Image/mainimage.png" alt="FileInNOut Typing" />
</div>

<div align="center">
<h3>파일 관리와 실시간 문서 협업의 경계를 허무는 하이브리드 워크스페이스</h3>
<p>
스마트한 <b>파일 저장소</b>와 강력한 <b>블록 기반 에디터</b>가 하나로 통합된 시스템입니다.
클라우드 스토리지의 안정성과 실시간 협업 경험을 동시에 제공합니다.
</p>
</div>

<div align="center">
<table border="0" width="80%">
<tr>
<td align="center" colspan="4">
<b>TEAM MEMBER</b>
</td>
</tr>
<tr>
<td align="center" width="25%">
<a href="https://github.com/Joohyeng">
<img src="https://github.com/Joohyeng.png" width="100"/>





김주형
</a>
</td>
<td align="center" width="25%">
<a href="https://github.com/Yoonjoon13">
<img src="https://github.com/Yoonjoon13.png" width="100"/>





범윤준
</a>
</td>
<td align="center" width="25%">
<a href="https://github.com/sunyeoplee0">
<img src="https://github.com/sunyeoplee0.png" width="100"/>





이선엽
</a>
</td>
<td align="center" width="25%">
<a href="https://github.com/Lumisia">
<img src="https://github.com/Lumisia.png" width="100"/>





최재원
</a>
</td>
</tr>
</table>
</div>

<div align="center">
<a href="#프로젝트-소개">소개</a> &nbsp;|&nbsp;
<a href="#기술-스택">기술 스택</a> &nbsp;|&nbsp;
<a href="#요구사항-정의">요구사항</a> &nbsp;|&nbsp;
<a href="#피그마-프로토타입">피그마</a> &nbsp;|&nbsp;
<a href="#시스템-아키텍처">아키텍처</a> &nbsp;|&nbsp;
<a href="#데이터베이스-설계">ERD</a> &nbsp;|&nbsp;
<a href="#서비스-도메인">도메인</a>
</div>

<hr/>

<h2 id="프로젝트-소개">프로젝트 소개</h2>

<div align="center">
<p><b>"전환 비용(Switching Cost)을 0으로 만드는 통합 환경"</b></p>
<p>
FileInNOut은 클라우드 저장소와 실시간 문서 협업 기능을 통합한 워크스페이스입니다.
웹상에서 팀원들과 동시에 문서를 작성하고 파일을 관리할 수 있는 환경을 제공합니다.
</p>
</div>

<h3>Problem & Solution</h3>

<table width="100%">
<tr>
<td width="50%" valign="top">
<h3>Problem (Pain Points)</h3>
<ul>
<li><b>데이터 파편화</b>: 파일 저장소와 문서 툴의 분리로 인한 업무 비효율</li>
<li><b>협업의 단절</b>: 폴더 구조 내에서 실시간 편집 중인 문서 식별의 어려움</li>
<li><b>복잡한 권한</b>: 파일 및 문서별 상이한 권한 설정 프로세스</li>
</ul>
</td>
<td width="50%" valign="top">
<h3>Solution (Key Values)</h3>
<ul>
<li><b>MinIO 오브젝트 스토리지</b>: 대용량 파일의 안정적인 저장 및 관리</li>
<li><b>Node.js & WebSocket</b>: 지연 없는 실시간 동시 편집 에디터 구현</li>
<li><b>하이브리드 구조</b>: 파일 트리 내 문서(Page) 무한 계층 생성 지원</li>
</ul>
</td>
</tr>
</table>

<hr/>

<h2 id="기술-스택">기술 스택</h2>

<div align="center">
<h3>Backend & Storage</h3>
<img src="https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java">
<img src="https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot">
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
<img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=websocket&logoColor=white" alt="WebSocket">
<img src="https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white" alt="MariaDB">

<h3>Frontend</h3>
<img src="https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue.js">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white" alt="Axios">
<img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
<img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">

<h3>Infrastructure</h3>
<img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" alt="Nginx">
<img src="https://img.shields.io/badge/HAProxy-1E90FF?style=for-the-badge&logo=haproxy&logoColor=white" alt="HAProxy">
<img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux">
<img src="https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white" alt="Git">
</div>

<hr/>

<h2 id="요구사항-정의">요구사항 정의</h2>
<details>
<summary>요구사항 정의서 상세 보기</summary>

<p><a href="./docs/요구사항%20정의서.pdf">요구사항 정의서 다운로드 (PDF)</a></p>
<img src="Image/Requirements.png" alt="FileInNOut Requirements" width="850"/>
</details>

<hr/>

<h2 id="피그마-프로토타입">피그마 프로토타입</h2>
<details>
<summary>피그마 프로토타입 상세 보기</summary>

<p>
<a href="https://www.figma.com/proto/K8oFcphOgrW7w1iWJxIdtH/%ED%8C%80-FileInNOut?node-id=0-1&t=w4Zkr2hu29DYfQZg-1">
<img src="https://img.shields.io/badge/Figma-View%20Prototype-F24E1E?style=for-the-badge&logo=figma&logoColor=white" alt="Figma Badge"/>
</a>
</p>
<img src="Image/FileInNOut.png" alt="FileInNOut Prototype" width="850"/>
</details>

<hr/>

<h2 id="시스템-아키텍처">시스템 아키텍처</h2>
<details>
<summary>시스템 아키텍처 상세 보기</summary>

<img src="Image/Systemarchitecture_ver01.png" alt="FileInNOut System Architecture" width="850"/>
</details>

<hr/>

<h2 id="데이터베이스-설계">데이터베이스 설계 (ERD)</h2>
<details>
<summary>데이터베이스 설계도(ERD) 상세 보기</summary>

<img src="Image/DB.png" alt="FileInNOut DB ERD" width="850"/> </details>

<hr/>

<h2 id="서비스-도메인">서비스 도메인</h2>
<div align="left">
<a href="http://www.innoutfile.kro.kr" target="_blank" rel="noopener noreferrer">
<p>www.innoutfile.kro.kr</p>
</a>
</div>

<hr/>

<h2 id="서비스-시나리오">서비스 시나리오 및 기능 데모</h2>

<p>FileInNOut의 주요 핵심 기능을 시나리오별로 정리하였습니다. 각 항목을 클릭하여 상세 동작 과정과 데모 영상을 확인할 수 있습니다.</p>

<details>
<summary>1. 사용자 인증 (회원가입 및 로그인)</summary>
<div align="center">
<img src="./Image/user_auth.gif" width="850" controls>.
<p>계정 생성 및 보안 인증을 통한 사용자 접속 프로세스</p>
</div>
</details>

<details>
<summary>2. 파일 및 문서 관리</summary>
<div align="center">
<img src="./Image/file_docs.gif" width="850" controls>
<p>파일 트리 구조 내 폴더/파일 업로드 및 문서(Page) 생성 관리</p>
</div>
</details>

<details>
<summary>3. 채팅 기능</summary>
<div align="center">
<img src="./Image/chat.gif" width="850" controls>
<p>협업 중인 팀원들과의 실시간 소통 기능</p>
</div>
</details>

<details>
<summary>4. 문서 편집기</summary>
<div align="center">
<img src="./Image/editor.gif" width="850" controls>
</video>
<p>블록 기반의 실시간 동시 편집 에디터</p>

</details>