<?php
// PHP 7.4+ / Apache. Upload the contents of this directory to www.
declare(strict_types=1);
ini_set('display_errors', '0');
date_default_timezone_set('Asia/Seoul');
const STORE = __DIR__ . '/_private';
const UPLOADS = __DIR__ . '/uploads';
function answer(int $status, $value = null): void {
    http_response_code($status); header('Content-Type: application/json; charset=utf-8'); header('Cache-Control: no-store');
    if ($status !== 204) echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function load(string $name, $default = []) { $file = STORE . '/' . $name . '.json'; return is_file($file) ? json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR) : $default; }
function save(string $name, $value): void {
    $file = STORE . '/' . $name . '.json'; $tmp = tempnam(STORE, 'write-');
    if ($tmp === false || file_put_contents($tmp, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)) === false || !rename($tmp, $file)) throw new RuntimeException('데이터를 저장할 수 없습니다. _private 폴더 쓰기 권한을 확인하세요.');
    @chmod($file, 0600);
}
function account() { return load('admin', null); }
function signed_in(): bool { $a = account(); return $a && isset($_SESSION['version']) && hash_equals($a['version'], $_SESSION['version']); }
function guard(): void { if (!signed_in()) answer(401, ['error' => '관리자 로그인이 필요합니다.']); }
function session_login(array $a): void { session_regenerate_id(true); $_SESSION['version'] = $a['version']; answer(200, ['authenticated' => true]); }
function text_length(string $s): int { return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : preg_match_all('/./us', $s); }
function valid_name($value): string { $n = trim((string)$value); if (!$n || text_length($n) > 40) throw new InvalidArgumentException('이름은 1~40자로 입력하세요.'); return $n; }
function index_of(array $list, string $id): int { foreach ($list as $i => $item) if ($item['id'] === $id) return $i; answer(404, ['error' => '항목을 찾을 수 없습니다.']); }
function exists_id(array $items, string $id): bool { foreach ($items as $item) if ($item['id'] === $id) return true; return false; }
function new_id(string $name, array $items): string { $base = trim(preg_replace('/[^a-z0-9_-]+/', '-', strtolower($name)), '-') ?: 'menu'; $id = $base; for ($i = 2; exists_id($items, $id); $i++) $id = $base . '-' . $i; return $id; }
function external_image(string $value): array {
    $url = trim($value); $p = parse_url($url);
    if (!filter_var($url, FILTER_VALIDATE_URL) || !in_array(strtolower($p['scheme'] ?? ''), ['http', 'https'], true) || isset($p['user']) || isset($p['pass'])) throw new InvalidArgumentException('http 또는 https 이미지 주소를 입력하세요.');
    return ['mediaUrl' => $url, 'mediaType' => 'image/*'];
}
function store_media($media): array {
    if (empty($media['data'])) return [];
    if (!preg_match('~^data:([^;]+);base64,(.+)$~s', $media['data'], $m)) throw new InvalidArgumentException('올바른 이미지 파일을 업로드하세요.');
    $types = ['image/jpeg'=>'.jpg','image/png'=>'.png','image/gif'=>'.gif','image/webp'=>'.webp','video/mp4'=>'.mp4','video/webm'=>'.webm'];
    if (!isset($types[$m[1]])) throw new InvalidArgumentException('지원하지 않는 파일 형식입니다.');
    $bytes = base64_decode($m[2], true); if ($bytes === false || strlen($bytes) > 20 * 1024 * 1024) throw new InvalidArgumentException('파일은 20MB 이하만 업로드할 수 있습니다.');
    if (strpos($m[1], 'image/') === 0) { $info = @getimagesizefromstring($bytes); if (!$info || ($info['mime'] ?? '') !== $m[1]) throw new InvalidArgumentException('이미지 파일 내용과 형식이 일치하지 않습니다.'); }
    $file = bin2hex(random_bytes(16)) . $types[$m[1]];
    if (file_put_contents(UPLOADS . '/' . $file, $bytes) === false) throw new RuntimeException('uploads 폴더 쓰기 권한을 확인하세요.');
    return ['mediaUrl'=>'/uploads/' . $file, 'mediaType'=>$m[1]];
}
function media_urls(array $post): array { $urls = [$post['mediaUrl'] ?? null]; foreach ($post['blocks'] ?? [] as $b) $urls[] = $b['mediaUrl'] ?? null; return array_filter($urls); }
function cleanup(array $old, array $retained = []): void {
    $keep = media_urls($retained); foreach (array_unique(media_urls($old)) as $url) if (!in_array($url, $keep, true) && preg_match('~^/uploads/[a-zA-Z0-9-]+\.(jpg|png|gif|webp|mp4|webm)$~', $url)) @unlink(UPLOADS . '/' . basename($url));
}
function make_post(array $input, array $existing = []): array {
    $category = (string)($input['category'] ?? ''); $title = trim((string)($input['title'] ?? ''));
    if (!$title || !exists_id(array_merge(load('sections'), load('categories')), $category)) throw new InvalidArgumentException('제목과 카테고리를 확인하세요.');
    $blocks = []; $created = [];
    try {
        foreach ($input['blocks'] ?? [['type'=>'text','content'=>$input['body'] ?? '']] as $block) {
            if (($block['type'] ?? '') === 'text') { if (trim((string)($block['content'] ?? '')) !== '') $blocks[] = ['type'=>'text','content'=>(string)$block['content']]; continue; }
            if (($block['type'] ?? '') !== 'image') throw new InvalidArgumentException('지원하지 않는 본문 형식입니다.');
            if (!empty($block['media']['data'])) { $media = store_media($block['media']); $created[] = $media; }
            else { $url = (string)($block['mediaUrl'] ?? ''); if (strpos($url, '/uploads/') === 0 && in_array($url, media_urls($existing), true) && is_file(UPLOADS . '/' . basename($url))) $media = ['mediaUrl'=>$url,'mediaType'=>'image/*']; else $media = external_image($url); }
            $blocks[] = array_merge(['type'=>'image'], $media);
        }
        if (!$blocks) throw new InvalidArgumentException('내용을 입력하거나 이미지를 추가하세요.');
        $body = implode("\n", array_column(array_filter($blocks, function($b) { return $b['type'] === 'text'; }), 'content'));
        $images = array_values(array_filter($blocks, function($b) { return $b['type'] === 'image'; }));
        $thumb = $images[0] ?? preview_image($body);
        // Retain a previously generated link thumbnail when only its text is edited.
        if (!$thumb && empty($existing['blocks']) === false && empty(array_filter($existing['blocks'], function($b) { return $b['type'] === 'image'; })) && ($existing['body'] ?? '') === $body) $thumb = ['mediaUrl'=>$existing['mediaUrl'] ?? null,'mediaType'=>$existing['mediaType'] ?? null];
        return array_merge($existing, ['category'=>$category,'title'=>function_exists('mb_substr') ? mb_substr($title,0,160,'UTF-8') : $title,'body'=>$body,'blocks'=>$blocks,'mediaUrl'=>$thumb['mediaUrl'] ?? null,'mediaType'=>$thumb['mediaType'] ?? null]);
    } catch (Throwable $e) { foreach ($created as $media) cleanup($media); throw $e; }
}
require __DIR__ . '/preview.php';
try {
    if (!is_dir(STORE) || !is_dir(UPLOADS)) throw new RuntimeException('_private와 uploads 폴더를 업로드하고 쓰기 권한을 확인하세요.');
    $lock = fopen(STORE . '/store.lock', 'c'); if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('저장소 잠금 실패');
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('memoir_php'); session_set_cookie_params(['lifetime'=>604800,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Lax']); ini_set('session.use_strict_mode','1'); session_start();
    $method = $_SERVER['REQUEST_METHOD']; $route = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $input = [];
    if ($method !== 'GET') {
        if (!empty($_SERVER['HTTP_ORIGIN'])) { $origin = parse_url($_SERVER['HTTP_ORIGIN']); if (($origin['host'] ?? '') !== explode(':', $_SERVER['HTTP_HOST'])[0] || ($origin['scheme'] ?? '') !== ($secure ? 'https' : 'http')) answer(403, ['error'=>'외부 사이트에서의 저장 요청은 허용되지 않습니다.']); }
        if ($method !== 'DELETE') {
            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            if (strpos($contentType, 'multipart/form-data') === 0) {
                if ($method !== 'POST' || !preg_match('~^/api/posts(?:/[a-zA-Z0-9_-]+)?$~', $route)) answer(415,['error'=>'이미지 업로드 주소를 확인하세요.']);
                guard();
                if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 29 * 1024 * 1024) answer(413,['error'=>'업로드 크기를 줄여주세요.']);
                $input = json_decode($_POST['payload'] ?? '', true, 512, JSON_THROW_ON_ERROR);
                if (!is_array($input) || !is_array($input['blocks'] ?? null)) throw new InvalidArgumentException('올바른 저장 요청이 아닙니다.');
                foreach ($input['blocks'] as &$block) {
                    if (!isset($block['uploadField'])) continue;
                    $field = $block['uploadField'];
                    if (!is_string($field) || !preg_match('/^image_[0-9]+$/', $field)) throw new InvalidArgumentException('이미지 필드를 확인하세요.');
                    $file = $_FILES[$field] ?? null;
                    if (!$file || is_array($file['error']) || $file['error'] !== UPLOAD_ERR_OK) throw new InvalidArgumentException('이미지 업로드에 실패했습니다. 파일 용량과 호스팅 제한을 확인하세요.');
                    if ($file['size'] > 20 * 1024 * 1024) answer(413,['error'=>'이미지는 20MB 이하만 업로드할 수 있습니다.']);
                    if (!is_uploaded_file($file['tmp_name'])) throw new InvalidArgumentException('올바른 업로드 파일이 아닙니다.');
                    $info = @getimagesize($file['tmp_name']);
                    if (!$info || !in_array($info['mime'] ?? '', ['image/jpeg','image/png','image/gif','image/webp'], true)) throw new InvalidArgumentException('지원되는 이미지 파일을 선택하세요.');
                    $bytes = file_get_contents($file['tmp_name']);
                    if ($bytes === false) throw new RuntimeException('업로드 파일을 읽지 못했습니다.');
                    $block = ['type'=>'image','media'=>['data'=>'data:'.$info['mime'].';base64,'.base64_encode($bytes)]];
                }
                unset($block);
                if (preg_match('~^/api/posts/[a-zA-Z0-9_-]+$~', $route)) $method = 'PUT';
            } else {
                if (strpos($contentType, 'application/json') !== 0) answer(415, ['error'=>'JSON 요청이 필요합니다.']);
                $raw=file_get_contents('php://input', false, null, 0, 29 * 1024 * 1024 + 1);
                if (strlen($raw) > 29 * 1024 * 1024) answer(413,['error'=>'업로드 크기를 줄여주세요.']);
                $input=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
                if (!is_array($input)) throw new InvalidArgumentException('올바른 저장 요청이 아닙니다.');
            }
        }
    }
    if ($route === '/api/capabilities' && $method === 'GET') answer(200,['imageUrls'=>true,'version'=>'cafe24-php-v1']);
    if ($route === '/api/auth/status' && $method === 'GET') answer(200,['configured'=>(bool)account(),'authenticated'=>signed_in(),'setupKeyRequired'=>is_file(STORE.'/setup-key.json')]);
    if ($route === '/api/auth/setup' && $method === 'POST') {
        $setup=load('setup-key',null); if ($setup && !hash_equals($setup['key'],(string)($input['setupKey'] ?? ''))) answer(403,['error'=>'배포 파일과 함께 받은 초기 설정 코드를 입력하세요.']);
        if (account()) answer(409,['error'=>'관리자 계정이 이미 설정돼 있습니다.']);
        if (!preg_match('/^[a-zA-Z0-9_-]{3,32}$/', $input['username'] ?? '') || text_length((string)($input['password'] ?? '')) < 10 || text_length((string)$input['password']) > 256) throw new InvalidArgumentException('ID는 3~32자, 비밀번호는 10~256자로 입력하세요.');
        $a=['username'=>$input['username'],'passwordHash'=>password_hash($input['password'], PASSWORD_DEFAULT),'version'=>bin2hex(random_bytes(16))]; save('admin',$a); @unlink(STORE.'/setup-key.json'); session_login($a);
    }
    if ($route === '/api/auth/login' && $method === 'POST') {
        $key=hash('sha256',$_SERVER['REMOTE_ADDR'] ?? 'local'); $attempts=load('login-attempts'); $entry=$attempts[$key] ?? ['count'=>0,'time'=>time()]; if (time()-$entry['time'] > 900) $entry=['count'=>0,'time'=>time()];
        if ($entry['count'] >= 10) answer(429,['error'=>'로그인 시도가 많습니다. 15분 후 다시 시도하세요.']);
        $a=account(); if (!$a || ($input['username'] ?? '') !== $a['username'] || !password_verify((string)($input['password'] ?? ''),$a['passwordHash'])) { $entry['count']++; $attempts[$key]=$entry; save('login-attempts',$attempts); answer(401,['error'=>'아이디 또는 비밀번호가 올바르지 않습니다.']); }
        unset($attempts[$key]); save('login-attempts',$attempts); session_login($a);
    }
    if ($route === '/api/auth/logout' && $method === 'POST') { $_SESSION=[]; session_regenerate_id(true); answer(200,['authenticated'=>false]); }
    if ($route === '/api/auth/password' && $method === 'POST') {
        guard(); $a=account(); if (!password_verify((string)($input['currentPassword'] ?? ''),$a['passwordHash'])) throw new InvalidArgumentException('현재 비밀번호가 올바르지 않습니다.');
        $pw=(string)($input['newPassword'] ?? ''); if (text_length($pw)<10 || text_length($pw)>256 || $pw !== ($input['confirmPassword'] ?? '')) throw new InvalidArgumentException('새 비밀번호는 10~256자이며 확인 입력과 같아야 합니다.'); if (password_verify($pw,$a['passwordHash'])) throw new InvalidArgumentException('현재 비밀번호와 다른 비밀번호를 입력하세요.');
        $a['passwordHash']=password_hash($pw,PASSWORD_DEFAULT); $a['version']=bin2hex(random_bytes(16)); save('admin',$a); session_login($a);
    }
    if (preg_match('~^/api/(sections|categories|posts)(?:/([a-zA-Z0-9_-]+))?$~', $route, $match)) {
        $kind=$match[1]; $id=$match[2] ?? null; $items=load($kind);
        if ($method === 'GET' && !$id) { if ($kind === 'categories') $items=array_map(function($c) { $c['parentId']=$c['parentId'] ?? 'archive'; return $c; },$items); answer(200,$items); }
        guard(); if (!in_array($method,['POST','PUT','DELETE'],true)) answer(405,['error'=>'지원하지 않는 요청입니다.']);
        if (($method === 'POST' && $id) || ($method !== 'POST' && !$id)) answer(405,['error'=>'요청 주소를 확인하세요.']);
        $i=$id ? index_of($items,$id) : null; $old=$id ? $items[$i] : [];
        if ($method === 'DELETE') {
            if ($kind === 'sections') { if (!empty($old['locked'])) answer(409,['error'=>'기본 메뉴는 삭제할 수 없습니다.']); foreach (load('categories') as $c) if (($c['parentId'] ?? 'archive') === $id) answer(409,['error'=>'하위 카테고리를 먼저 삭제하세요.']); foreach (load('posts') as $p) if ($p['category'] === $id || ($p['sectionId'] ?? '') === $id) answer(409,['error'=>'글을 먼저 이동하거나 삭제하세요.']); }
            if ($kind === 'categories') foreach (load('posts') as $p) if ($p['category'] === $id) answer(409,['error'=>'글을 먼저 이동하거나 삭제하세요.']);
            array_splice($items,$i,1); save($kind,$items); cleanup($old); answer(204);
        }
        if ($kind === 'posts') $item=make_post($input,$old);
        else { $name=valid_name($input['name'] ?? ''); $item=array_merge($old,['name'=>$name]); if (!$id) $item['id']=new_id($name,array_merge(load('sections'),load('categories')));
            if ($kind === 'categories') { $parent=(string)($input['parentId'] ?? $old['parentId'] ?? 'archive'); if (!exists_id(load('sections'),$parent)) throw new InvalidArgumentException('상위 메뉴를 확인하세요.'); $item['parentId']=$parent; if (!empty($input['media'])) $item=array_merge($item,store_media($input['media'])); }
        }
        if ($method === 'POST') { if ($kind === 'posts') { $item['id']=bin2hex(random_bytes(16)); $item['date']=date('Y.n.j.'); array_unshift($items,$item); } else $items[]=$item; }
        else $items[$i]=$item;
        save($kind,$items); if ($id) cleanup($old,$item); answer($method === 'POST' ? 201 : 200,$item);
    }
    answer(404,['error'=>'API 주소를 찾을 수 없습니다.']);
} catch (InvalidArgumentException $e) { answer(400,['error'=>$e->getMessage()]); }
catch (JsonException $e) { error_log('Blog JSON error: '.$e->getMessage()); answer(400,['error'=>'JSON 데이터가 올바르지 않습니다.']); }
catch (Throwable $e) { error_log('Blog server error: '.$e->getMessage()); answer(500,['error'=>'서버 저장 오류입니다. 폴더 권한과 호스팅 오류 로그를 확인하세요.']); }
