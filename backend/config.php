<?php
declare(strict_types=1);
// Configuration is supplied by the operator; no production hosts or credentials.
$envFile = dirname(__DIR__) . '/.env';
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES) as $line) {
        if (preg_match('/^([A-Z_][A-Z0-9_]*)=(.*)$/', trim($line), $m) && getenv($m[1]) === false) {
            putenv($m[1] . '=' . trim($m[2], "\"'"));
        }
    }
}
function env(string $key, string $default = ''): string {
    $v = getenv($key); return $v === false ? $default : $v;
}
function fail(int $code, string $message): never {
    http_response_code($code); echo json_encode(['error' => $message]); exit;
}
function db(): PDO {
    static $pdo;
    if (!$pdo) {
        $pdo = new PDO('mysql:host='.env('DB_HOST','127.0.0.1').';port='.env('DB_PORT','3306').';dbname='.env('DB_NAME','workspace').';charset=utf8mb4', env('DB_USER','workspace'), env('DB_PASSWORD'), [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
        $pdo->exec("SET time_zone = '+00:00'");
    }
    return $pdo;
}
function json_input(): array { return json_decode(file_get_contents('php://input'), true) ?: []; }
function token_key(): string {
    $key=env('APP_KEY');
    if (strlen($key)<32 || str_contains($key,'change-me')) throw new RuntimeException('Configure a unique APP_KEY of at least 32 characters');
    return $key;
}
function b64(string $s): string { return rtrim(strtr(base64_encode($s),'+/','-_'),'='); }
function issue_token(array $user): string {
    $head=b64(json_encode(['alg'=>'HS256','typ'=>'JWT']));
    $body=b64(json_encode(['sub'=>(int)$user['id'],'iat'=>time(),'exp'=>time()+43200,'ver'=>hash('sha256',$user['password_hash'])]));
    return "$head.$body.".b64(hash_hmac('sha256',"$head.$body",token_key(),true));
}
function require_auth(): array {
    $header=$_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer (\S+)$/i',$header,$m)) fail(401,'Unauthorized');
    $parts=explode('.',$m[1]);
    if(count($parts)!==3) fail(401,'Unauthorized');
    [$h,$p,$sig]=$parts;
    if(!hash_equals(b64(hash_hmac('sha256',"$h.$p",token_key(),true)),$sig)) fail(401,'Unauthorized');
    $head=json_decode(base64_decode(strtr($h,'-_','+/')),true);
    $claims=json_decode(base64_decode(strtr($p,'-_','+/')),true);
    if(($head['alg']??'')!=='HS256' || !is_array($claims) || (int)($claims['exp']??0)<=time() || (int)($claims['sub']??0)<=0) fail(401,'Unauthorized');
    $st=db()->prepare('SELECT id,password_hash FROM users WHERE id=?');$st->execute([(int)$claims['sub']]);$u=$st->fetch();
    if(!$u || !hash_equals(hash('sha256',$u['password_hash']),(string)($claims['ver']??''))) fail(401,'Unauthorized');
    return $claims;
}
if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    // Same-origin /api proxy by default. An optional explicit origin supports separate hosting.
    $origin=env('FRONTEND_ORIGIN');
    if($origin!=='' && ($_SERVER['HTTP_ORIGIN']??'')===$origin) {
        header('Access-Control-Allow-Origin: '.$origin);header('Vary: Origin');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if(($_SERVER['REQUEST_METHOD']??'')==='OPTIONS') {http_response_code(204);exit;}
    set_exception_handler(function(Throwable $e) { error_log((string)$e); fail(500,'Internal server error'); });
}
