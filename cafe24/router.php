<?php
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if (preg_match('~^/(?:_private|data|tests)(?:/|$)|(?:^|/)\.|^/(?:preview|router)\.php$|\.(?:json|log|cmd|ps1)$~i',$path)) { http_response_code(403); exit; }
if (preg_match('~^/api(?:/|$)~',$path)) { require __DIR__.'/api.php'; return true; }
return false;
