<?php
declare(strict_types=1);
function public_download(string $url, int $limit, float $deadline, int $redirects = 0): array {
    if (!function_exists('curl_init') || $redirects > 3 || microtime(true) >= $deadline) throw new RuntimeException('미리보기 시간 초과');
    $p=parse_url($url); $scheme=strtolower($p['scheme'] ?? ''); $host=$p['host'] ?? ''; $port=$p['port'] ?? ($scheme === 'https' ? 443 : 80);
    if (!in_array($scheme,['http','https'],true) || !$host || isset($p['user']) || isset($p['pass']) || !in_array($port,[80,443],true)) throw new RuntimeException('미리보기 주소 차단');
    $ips=filter_var($host,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4) ? [$host] : gethostbynamel($host);
    if (!$ips) throw new RuntimeException('미리보기 DNS 실패');
    foreach ($ips as $ip) if (!filter_var($ip,FILTER_VALIDATE_IP,FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) || preg_match('/^(?:100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.(?:18|19)\.|192\.0\.0\.)/',$ip)) throw new RuntimeException('내부 주소 차단');
    $bytes=''; $location=''; $type=''; $c=curl_init($url);
    curl_setopt_array($c,[CURLOPT_FOLLOWLOCATION=>false,CURLOPT_TIMEOUT_MS=>max(1,(int)(($deadline-microtime(true))*1000)),CURLOPT_CONNECTTIMEOUT_MS=>2000,CURLOPT_USERAGENT=>'PersonalBlog-LinkPreview/1.0',CURLOPT_PROTOCOLS=>CURLPROTO_HTTP | CURLPROTO_HTTPS,CURLOPT_RESOLVE=>[$host.':'.$port.':'.$ips[0]],CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,
        CURLOPT_WRITEFUNCTION=>function($handle,$chunk) use (&$bytes,$limit) { if (strlen($bytes)+strlen($chunk)>$limit) return 0; $bytes.=$chunk; return strlen($chunk); },
        CURLOPT_HEADERFUNCTION=>function($handle,$line) use (&$location,&$type) { if (stripos($line,'Location:')===0) $location=trim(substr($line,9)); if (stripos($line,'Content-Type:')===0) $type=strtolower(trim(explode(';',substr($line,13))[0])); return strlen($line); }]);
    $ok=curl_exec($c); $status=curl_getinfo($c,CURLINFO_HTTP_CODE); curl_close($c);
    if ($ok === false) throw new RuntimeException('미리보기 연결 실패');
    if (in_array($status,[301,302,303,307,308],true) && $location) return public_download(resolve_link($location,$url),$limit,$deadline,$redirects+1);
    if ($status !== 200) throw new RuntimeException('미리보기 응답 실패');
    return ['bytes'=>$bytes,'type'=>$type,'url'=>$url];
}
function resolve_link(string $value, string $base): string {
    if (preg_match('~^https?://~i',$value)) return $value;
    $p=parse_url($base); if (strpos($value,'//') === 0) return $p['scheme'].':'.$value;
    $origin=$p['scheme'].'://'.$p['host'].(isset($p['port']) ? ':'.$p['port'] : '');
    return $origin . ($value[0] === '/' ? $value : rtrim(str_replace('\\','/',dirname($p['path'] ?? '/')),'/').'/'.$value);
}
function preview_image(string $body): array {
    if (!preg_match('~https?://[^\s<>"\x27]+~i',$body,$m)) return [];
    try {
        $deadline=microtime(true)+7; $page=public_download(rtrim($m[0], '.,!?;:)}]'),1500000,$deadline);
        if (!in_array($page['type'],['text/html','application/xhtml+xml'],true)) return [];
        preg_match_all('~<meta\b[^>]*>~i',$page['bytes'],$tags); $meta=[];
        foreach ($tags[0] as $tag) { preg_match_all('~([\w:-]+)\s*=\s*(?:"([^"]*)"|\x27([^\x27]*)\x27|([^\s>]+))~',$tag,$matches,PREG_SET_ORDER); $attrs=[];
            foreach ($matches as $a) $attrs[strtolower($a[1])]=html_entity_decode($a[2] !== '' ? $a[2] : (($a[3] ?? '') ?: ($a[4] ?? '')), ENT_QUOTES | ENT_HTML5,'UTF-8');
            $key=strtolower($attrs['property'] ?? $attrs['name'] ?? ''); if (!empty($attrs['content']) && !isset($meta[$key])) $meta[$key]=$attrs['content']; }
        $source=$meta['og:image'] ?? $meta['twitter:image'] ?? $meta['twitter:image:src'] ?? null; if (!$source) return [];
        $image=public_download(resolve_link($source,$page['url']),5000000,$deadline); $info=@getimagesizefromstring($image['bytes']); if (!$info || !in_array($info['mime'],['image/jpeg','image/png','image/gif','image/webp'],true)) return [];
        return store_media(['data'=>'data:'.$info['mime'].';base64,'.base64_encode($image['bytes'])]);
    } catch (Throwable $e) { return []; }
}
