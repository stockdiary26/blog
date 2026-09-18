# 데스크탑에서 이어서 작업하기

현재 배포 대상은 카페24 뉴아우토반 일반형, PHP 8.4, https://miky2126.mycafe24.com 입니다.
`cafe24/`가 PHP 배포 버전입니다. 루트의 Node.js 버전도 유지하고 있습니다.

## 저장소 가져오기

Git과 Node.js를 설치한 뒤 PowerShell에서:

```powershell
git clone https://github.com/stockdiary26/blog.git
cd blog
```

이미 복제했다면 `git pull --ff-only`로 최신 코드를 받습니다.
Codex에서 **blog 폴더**를 프로젝트로 열고 `HANDOFF.md`를 읽고 이어서 작업하라고 요청하세요.

## PHP 버전 로컬 실행

PHP 8.x가 설치돼 있고 PATH에 등록돼 있다면:

```powershell
php -S 127.0.0.1:3003 -t cafe24 cafe24/router.php
```

http://127.0.0.1:3003/ 에 접속합니다. 실행 창은 열어둡니다.
초기 관리자 계정은 이 컴퓨터에서 직접 설정해야 합니다. 이전 컴퓨터의 관리자 비밀번호를 저장소로 전달하지 않습니다.
일반 웹 링크 썸네일 미리보기는 PHP cURL 확장이 필요합니다.

## Node.js 버전 실행

```powershell
npm start
```

http://localhost:3002/ 에 접속합니다. PHP 배포 버전과 Node.js는 별도의 데이터 폴더를 사용합니다.
카페24 배포용 수정은 `cafe24/`에 반영합니다. Node.js 버전도 수정하는 경우 대응 파일을 함께 갱신합니다.

## 카페24 업로드 파일 만들기

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-cafe24.ps1
```

`dist/cafe24-날짜-번호/`에 업로드 ZIP과 INITIAL-SETUP.txt가 생성됩니다.
초기 설정 코드는 Git에 올리지 않습니다. ZIP 내용물을 www 바로 아래에 업로드합니다.
배포 상세 안내는 `cafe24/README.md`를 참고합니다.
운영 중인 서버를 업데이트할 때는 `_private`와 `uploads`를 덮어쓰지 않습니다.

## GitHub 업로드가 아직 안 된 경우

노트북에서 마지막 `git push origin main`을 완료해야 데스크탑 clone에 최신 코드가 포함됩니다.
별도 전달한 git bundle을 받았다면 인터넷 없이도 다음과 같이 복제할 수 있습니다.

```powershell
git clone .\blog-transfer.bundle blog
cd blog
git remote set-url origin https://github.com/stockdiary26/blog.git
```
