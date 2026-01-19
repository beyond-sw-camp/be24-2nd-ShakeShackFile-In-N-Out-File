<!-- =======================================================
FileInNOut - README (Premium Style)
======================================================= -->

<div align="center">
<!-- 타이틀 타이핑 효과 -->
<img src="/MainImg.png" alt="FileInNOut Typing" />
</div>

<div align="center">
<h3>📁 파일 관리와 📝 실시간 문서 협업의 경계를 허무는



하이브리드 워크스페이스</h3>
<p>
스마트한 <b>파일 저장소</b>와 강력한 <b>블록 기반 에디터</b>가 하나로 통합됩니다.




클라우드 스토리지의 안정성과 Notion 스타일의 협업 경험을 동시에 제공합니다. 🚀
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
[팀원 성함 입력]
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

✨ 프로젝트 소개

"전환 비용(Switching Cost)을 0으로 만드는 통합 환경"

FileInNOut은 단순한 클라우드 저장소를 넘어, **파일 관리 시스템(File System)**과 실시간 문서 협업(Real-time Collaboration) 기능을 완벽하게 통합한 차세대 워크스페이스입니다.
파일을 다운로드해서 수정하고 다시 올리는 번거로움 없이, 웹상에서 팀원들과 동시에 문서를 작성하고 파일을 관리하세요.

🎯 Problem → Solution

<table width="100%">
<tr>
<td width="50%" valign="top">
<h3>😵 Problem (Pain Points)</h3>
<ul>
<li><b>데이터 파편화</b>: 파일 저장소(Google Drive)와 문서 툴(Notion)의 분리로 인한 업무 비효율</li>
<li><b>협업의 단절</b>: 폴더 구조 내에서 실시간 편집 중인 문서를 직관적으로 찾기 어려움</li>
<li><b>복잡한 권한</b>: 파일별, 문서별로 제각각인 권한 설정 프로세스</li>
</ul>
</td>
<td width="50%" valign="top">
<h3>😎 Solution (Key Values)</h3>
<ul>
<li><b>MinIO 오브젝트 스토리지</b>: 대용량 파일의 안정적인 저장 및 관리</li>
<li><b>Node.js & WebSocket</b>: 지연(Latency) 없는 실시간 동시 편집 에디터 구현</li>
<li><b>하이브리드 구조</b>: 파일 트리 안에서 문서(Page)를 무한 계층으로 생성 가능</li>
</ul>
</td>
</tr>
</table>

🧩 핵심 기능

Category

Features

Description

📁 File Management

폴더 트리 & 탐색기

직관적인 트리 구조로 파일/폴더 이동 및 관리



확장 검색

파일명, 확장자, 업로드 날짜 기반의 정밀 필터링

📝 Collaboration

실시간 동시 편집

WebSocket 기반 다중 사용자 편집 (커서 공유, 락킹)



블록 에디터

텍스트, 이미지, 코드 블록, 체크리스트 등 모듈형 문서 작성

🔒 Governance

세밀한 권한 제어

사용자/그룹별 읽기(Read), 쓰기(Write) 권한 부여



링크 공유

외부 사용자를 위한 만료 기한이 있는 보안 링크 생성

🚀 Infra

고가용성(HA)

Master-Slave DB 및 로드밸런싱을 통한 무중단 서비스 지향

🧰 기술 스택

<div align="center">
<!-- Backend -->
<h3>Backend & Storage</h3>
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Java-ED8B00%3Fstyle%3Dfor-the-badge%26logo%3Dopenjdk%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Spring_Boot-6DB33F%3Fstyle%3Dfor-the-badge%26logo%3Dspringboot%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Spring_Security-6DB33F%3Fstyle%3Dfor-the-badge%26logo%3Dspringsecurity%26logoColor%3Dwhite" />





<img src="https://www.google.com/search?q=https://img.shields.io/badge/Node.js-339933%3Fstyle%3Dfor-the-badge%26logo%3Dnodedotjs%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/WebSocket-010101%3Fstyle%3Dfor-the-badge%26logo%3Dsocketdotio%26logoColor%3Dwhite" />





<img src="https://img.shields.io/badge/MariaDB-003545?style=for-the-badge&logo=mariadb&logoColor=white" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/MinIO-C72E49%3Fstyle%3Dfor-the-badge%26logo%3Dminio%26logoColor%3Dwhite" />
</div>

<div align="center">
<!-- Frontend -->
<h3>Frontend</h3>
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Vue.js-4FC08D%3Fstyle%3Dfor-the-badge%26logo%3Dvuedotjs%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/JavaScript-F7DF1E%3Fstyle%3Dfor-the-badge%26logo%3Djavascript%26logoColor%3Dblack" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Axios-5A29E4%3Fstyle%3Dfor-the-badge%26logo%3Daxios%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/HTML5-E34F26%3Fstyle%3Dfor-the-badge%26logo%3Dhtml5%26logoColor%3Dwhite" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/CSS3-1572B6%3Fstyle%3Dfor-the-badge%26logo%3Dcss3%26logoColor%3Dwhite" />
</div>

<div align="center">
<!-- Infrastructure -->
<h3>Infrastructure & DevOps</h3>
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Docker-2496ED%3Fstyle%3Dfor-the-badge%26logo%3Ddocker%26logoColor%3Dwhite" />
<img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" />
<img src="https://img.shields.io/badge/HAProxy-1E90FF?style=for-the-badge&logo=haproxy&logoColor=white" />





<img src="https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black" />
<img src="https://www.google.com/search?q=https://img.shields.io/badge/Git-F05032%3Fstyle%3Dfor-the-badge%26logo%3Dgit%26logoColor%3Dwhite" />
</div>

🏗️ 시스템 아키텍처

*본 프로젝트는 **고가용성(High Availability)*과 트래픽 분산을 최우선으로 설계되었습니다.

graph TD
    User[Client / Web Browser] -->|HTTPS Request| Nginx[Nginx Web Server]
    
    subgraph "Load Balancing Layer"
        Nginx -->|Proxy Pass| HAProxy[HAProxy]
    end
    
    subgraph "Application Layer"
        HAProxy -->|Round Robin| Spring1[Spring Boot API Server 1]
        HAProxy -->|Round Robin| Spring2[Spring Boot API Server 2]
        HAProxy -->|WebSocket| Node[Node.js Real-time Server]
    end
    
    subgraph "Data Storage Layer"
        Spring1 & Spring2 & Node -->|Read/Write| MasterDB[(MariaDB Master)]
        Spring1 & Spring2 -->|Read Only| SlaveDB[(MariaDB Slave)]
        MasterDB -->|Replication| SlaveDB
        Spring1 & Spring2 -->|File I/O| MinIO[(MinIO Object Storage)]
    end


💡 아키텍처 특징

Traffic Distribution: Nginx와 HAProxy를 이중으로 배치하여 정적 리소스 처리와 동적 API 요청을 효율적으로 분산합니다.

Database Replication: MariaDB를 Master-Slave 구조로 이중화하여, 쓰기(Write) 작업은 Master에서, 읽기(Read) 작업은 Slave에서 처리함으로써 부하를 분산합니다.

Real-time Processing: 문서 동시 편집과 같은 실시간성이 중요한 기능은 Node.js 전용 서버로 분리하여 메인 API 서버의 부하를 줄였습니다.

👤 사용자 시나리오 (User Journey)

📂 매니저 (Project Manager)

프로젝트 생성: 팀을 위한 루트 폴더를 생성하고 기본 권한을 설정합니다.

자료 업로드: 기획서(PDF), 디자인 시안(PNG) 등을 드래그 앤 드롭으로 대량 업로드합니다.

팀원 초대: 이메일 기반으로 팀원을 초대하고 편집자(Editor) 권한을 부여합니다.

✍️ 에디터 (Content Creator)

협업 페이지 접속: 공유받은 링크를 통해 문서 페이지에 접속합니다.

실시간 작성: 다른 동료가 작성 중인 커서를 확인하며 동시에 아이디어를 정리합니다.

미디어 삽입: 코드 블록을 열어 예제 코드를 작성하고, 관련 이미지를 본문에 바로 삽입합니다.

🛠️ 관리자 (System Admin)

모니터링: MinIO 대시보드를 통해 스토리지 사용량을 체크합니다.

시스템 관리: HAProxy 상태 페이지에서 트래픽 분산 현황을 모니터링하고 이상 징후를 파악합니다.

🗺️ 데이터베이스 설계 (ERD)

<details>
<summary><b>📋 ERD 다이어그램 보기 (Click)</b></summary>




아래 영역에 ERD 이미지를 첨부해주세요.

<div align="center" style="border: 2px dashed #ccc; padding: 20px; border-radius: 10px;">
<img src="https://www.google.com/search?q=https://via.placeholder.com/800x400.png%3Ftext%3DPlace%2BYour%2BERD%2BImage%2BHere" alt="ERD Placeholder" />
</div>

</details>

🚀 Future Scope

[ ] 버전 관리 시스템: 파일 및 문서의 변경 이력을 추적하고 복원하는 기능

[ ] 모바일 앱 지원: React Native를 활용한 모바일 환경 대응

[ ] AI 문서 요약: LLM을 연동하여 긴 문서를 자동으로 요약해주는 기능

<div align="center">
Copyright © 2026 FileInNOut Team. All rights reserved.
</div>

