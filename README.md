<!-- =======================================================
FileInNOut - README (Premium Style)
======================================================= -->

<div align="center">
<!-- 타이틀 타이핑 효과 -->
<img src="Image/mainimage.png" alt="FileInNOut Typing" />
</div>

<div align="center">
<h3> 파일 관리와 실시간 문서 협업의 경계를 허무는



하이브리드 워크스페이스</h3>
<p>
스마트한 <b>파일 저장소</b>와 강력한 <b>블록 기반 에디터</b>가 하나로 통합됩니다.




클라우드 스토리지의 안정성과 Notion 스타일의 협업 경험을 동시에 제공합니다. 
</p>
</div>

<div align="center">
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Project-FileInNOut-2563EB%3Fstyle%3Dfor-the-badge%26logo%3Dgithub%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Platform-Web-2ea44f%3Fstyle%3Dfor-the-badge%26logo%3Dgooglechrome%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Status-Developing-F7DF1E%3Fstyle%3Dfor-the-badge" />
</div>

<!-- ✅ 팀원 소개 -->

<div align="center">
<table border="0" width="80%">
<tr>
<td align="center">
<b>👥 TEAM MEMBER</b>






<span style="font-size:18px; font-weight:700;">
김주형, 범윤준, 이선엽, 최재원
</span>
</td>
</tr>
</table>
</div>

<div align="center">
<a href="#-프로젝트-소개">✨ 소개</a> &nbsp;|&nbsp;
<a href="#-핵심-기능">🧩 기능</a> &nbsp;|&nbsp;
<a href="#-기술-스택">🛠️ 기술 스택</a> &nbsp;|&nbsp;
<a href="#-시스템-아키텍처">🏗️ 아키텍처</a> &nbsp;|&nbsp;
<a href="#-데이터베이스-설계-erd">🗺️ ERD</a>
</div>

<hr/>

- 기술 스택

<div align="center">
<!-- Backend -->
<h3>Backend & Storage</h3>
<img src="https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" alt="Java">
<img src="https://img.shields.io/badge/Spring_Boot-6DB33F?style=for-the-badge&logo=springboot&logoColor=white" alt="Spring Boot">
<img src="https://img.shields.io/badge/Spring_Security-6DB33F?style=for-the-badge&logo=spring-security&logoColor=white" alt="Spring Security">
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js">
<img src="https://img.shields.io/badge/WebSocket-010101?style=for-the-badge&logo=websocket&logoColor=white" alt="WebSocket">
<img src="https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white" alt="MariaDB">
<img src="https://img.shields.io/badge/MinIO-C72E49?style=for-the-badge&logo=minio&logoColor=white" alt="MinIO">
</div>

<div align="center">
<!-- Frontend -->
<h3>Frontend</h3>
<img src="https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue.js">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white" alt="Axios">
<img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
<img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">

</div>

<div align="center">
<!-- Infrastructure -->
<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
<img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" alt="Nginx">
<img src="https://img.shields.io/badge/HAProxy-1E90FF?style=for-the-badge&logo=haproxy&logoColor=white" alt="HAProxy">
<img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" alt="Linux">
<img src="https://img.shields.io/badge/Git-F05032?style=for-the-badge&logo=git&logoColor=white" alt="Git">
</div>

- 프로젝트 소개

"전환 비용(Switching Cost)을 0으로 만드는 통합 환경"

FileInNOut은 단순한 클라우드 저장소를 넘어, **파일 관리 시스템(File System)**과 실시간 문서 협업(Real-time Collaboration) 기능을 통합한 워크스페이스입니다.
파일을 다운로드해서 수정하고 다시 올리는 번거로움 없이, 웹상에서 팀원들과 동시에 문서를 작성하고 파일을 관리하세요.

Problem → Solution

<table width="100%">
<tr>
<td width="50%" valign="top">
<h3> Problem (Pain Points)</h3>
<ul>
<li><b>데이터 파편화</b>: 파일 저장소(Google Drive)와 문서 툴(Notion)의 분리로 인한 업무 비효율</li>
<li><b>협업의 단절</b>: 폴더 구조 내에서 실시간 편집 중인 문서를 직관적으로 찾기 어려움</li>
<li><b>복잡한 권한</b>: 파일별, 문서별로 제각각인 권한 설정 프로세스</li>
</ul>
</td>
<td width="50%" valign="top">
<h3> Solution (Key Values)</h3>
<ul>
<li><b>MinIO 오브젝트 스토리지</b>: 대용량 파일의 안정적인 저장 및 관리</li>
<li><b>Node.js & WebSocket</b>: 지연(Latency) 없는 실시간 동시 편집 에디터 구현</li>
<li><b>하이브리드 구조</b>: 파일 트리 안에서 문서(Page)를 무한 계층으로 생성 가능</li>
</ul>
</td>
</tr>
</table>


<p align="center">
  <a href="https://www.figma.com/proto/K8oFcphOgrW7w1iWJxIdtH/%ED%8C%80-FileInNOut?node-id=0-1&t=w4Zkr2hu29DYfQZg-1">
    <img src="https://img.shields.io/badge/Figma-View%20Prototype-F24E1E?style=for-the-badge&logo=figma&logoColor=white"/>
  </a>
</p>

<p align="center">
  <img src="Image/FileInNOut.png" alt="FileInNOut Typing" width="850" height="850"/>
</p>




