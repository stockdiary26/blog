# 카페24 PHP 블로그 배포

## 업로드

1. 카페24에서 PHP 버전을 확인합니다. 이 코드는 PHP 7.4 이상 문법을 사용하고 PHP 8.3.33에서 테스트했습니다. 가능하면 지원되는 PHP 8.x를 선택하세요.
2. 기존 www 폴더를 PC에 백업합니다.
3. cafe24-blog.zip을 PC에서 풉니다. 압축 안의 **파일과 폴더를 www 바로 아래**에 업로드합니다. cafe24-blog라는 상위 폴더를 만들지 마세요.
4. 숨김 파일 .htaccess, .user.ini 및 _private/.htaccess, uploads/.htaccess도 포함합니다.
5. _private와 uploads는 PHP에서 쓰기 가능해야 합니다. 먼저 755로 확인하고 호스팅 안내에 따라 소유권/권한을 조정하세요. 777로 설정하지 마세요.
6. https://miky2126.mycafe24.com/api/capabilities에서 `cafe24-php-v1`이 표시되는지 확인합니다.
7. https://miky2126.mycafe24.com/_private/posts.json이 **403**을 반환하는지 확인합니다. 확인 전 관리자 계정을 설정하지 마세요.
8. 사이트의 Sign in에서 관리자 ID, 새 비밀번호, 별도로 전달한 초기 설정 코드를 입력합니다. 기존 Node.js 관리자 비밀번호 파일은 이 배포에 포함하지 않습니다.
9. 테스트용 글 작성·수정, 이미지 URL/업로드, 로그인, Admin을 확인합니다. PHP 버전에서는 별도의 Node.js 실행 창이 필요 없습니다.

## 포함 기능

기존 디자인, 글 7개, 현재 업로드 이미지, 높이 190px 썸네일, 이미지 주소/업로드, 글 작성·수정·삭제, 메뉴/카테고리 관리, Admin 내부 비밀번호 변경.
본문의 일반 웹 링크 썸네일 미리보기는 PHP cURL과 호스팅의 외부 HTTPS 접속 허용이 필요합니다. 외부 연결에 실패해도 글 저장은 가능합니다. 이미지 URL은 방문자 브라우저가 직접 읽습니다.

## 업데이트와 백업

운영 후에는 `_private`와 `uploads`에 실제 글/계정/이미지가 저장됩니다. 이후 코드 업데이트 시 두 폴더를 초기 배포본으로 덮어쓰지 마세요. 두 폴더는 함께 백업해야 합니다.
초기 설정 코드는 첫 관리자 계정 생성 후 서버에서 제거됩니다. 코드가 들어 있는 파일은 웹 공개 폴더 밖에서 보관하세요.

## 오류 확인

- API 404: .htaccess 업로드 여부 및 www 루트 위치를 확인합니다.
- API 500: PHP 버전, _private/uploads 쓰기 권한, 카페24 PHP 오류 로그를 확인합니다.
- 업로드 요청 413/403: 호스팅의 요청 크기 제한 또는 보안 필터를 확인합니다. 단일 이미지 제한은 20MB이며 이미지 여러 장의 합계가 크면 서버 제한에 걸릴 수 있습니다.
- 로그인: 기존 Node.js 계정을 자동으로 이전하지 않습니다. 처음에 PHP 계정을 새로 설정해야 합니다.

카페24 운영 환경 및 Apache .htaccess 적용은 실제 업로드 후 별도로 확인해야 합니다.
공식 문서: https://help.cafe24.com/faq/web-hosting/introduce/setup-management/hosting_root_absolute_path/
공식 PHP 버전 변경: https://help.cafe24.com/faq/web-hosting/introduce/new-renewal-change/change-php-version-web-hosting/
