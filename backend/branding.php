<?php
// Public GET exposes only display branding. Writes require role-management permission.
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function wb_fail(int $status, string $message) { http_response_code($status); echo json_encode(['error'=>$message]); exit; }
function wb_logo($value) {
    if ($value === null || $value === '') return null;
    if (!is_string($value) || strlen($value)>2048 || preg_match('/[\x00-\x20]/', $value)) wb_fail(422, 'Use a valid logo URL');
    if (preg_match('~^/(?!/)[^\\\\]*$~', $value)) return $value;
    if (!filter_var($value,FILTER_VALIDATE_URL) || !in_array(strtolower((string)parse_url($value,PHP_URL_SCHEME)),['http','https'],true)) wb_fail(422,'Logo URLs must use HTTP or HTTPS');
    if (parse_url($value,PHP_URL_USER)!==null || parse_url($value,PHP_URL_PASS)!==null) wb_fail(422,'Logo URLs cannot include credentials');
    return $value;
}
function wb_clean(array $input): array {
    if (!is_string($input['name']??null)) wb_fail(422,'Workspace name must be text');
    $name=trim($input['name']);
    if ($name==='' || mb_strlen($name)>80 || preg_match('/[\x00-\x1f\x7f]/',$name)) wb_fail(422,'Workspace name must be 1–80 characters');
    $show=$input['show_name']??true;
    if (!is_bool($show)) wb_fail(422,'show_name must be true or false');
    return ['name'=>$name,'logo_url'=>wb_logo($input['logo_url']??null),'logo_dark_url'=>wb_logo($input['logo_dark_url']??null),'show_name'=>$show];
}
$method=$_SERVER['REQUEST_METHOD']??'GET';
if($method==='OPTIONS'){http_response_code(204);exit;}
if(!in_array($method,['GET','PUT'],true)) wb_fail(405,'Method not allowed');
$defaults=['name'=>'IITEG Workspace','logo_url'=>null,'logo_dark_url'=>null,'show_name'=>true];
// Optional operator defaults contain public name/logo values only. Never distribute a company override.
$defaultsPath=__DIR__.'/branding.defaults.json';
if(is_file($defaultsPath)){
    $local=json_decode(file_get_contents($defaultsPath),true);
    if(is_array($local)) $defaults=wb_clean(array_merge($defaults,array_intersect_key($local,$defaults)));
}
try {
    $pdo=db();
    $pdo->exec('CREATE TABLE IF NOT EXISTS ws_branding (id TINYINT UNSIGNED NOT NULL PRIMARY KEY, data TEXT NULL, updated_by INT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    $st=$pdo->prepare('SELECT data FROM ws_branding WHERE id=?');$st->execute([1]);
    $raw=$st->fetchColumn();$stored=$raw?json_decode($raw,true):[];
    $current=wb_clean(array_merge($defaults,is_array($stored)?array_intersect_key($stored,$defaults):[]));
    if($method==='GET'){echo json_encode(['branding'=>$current],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
    require_once __DIR__.'/admin/permissions.php';
    $auth=require_auth();
    $uid=is_array($auth)?(int)($auth['sub']??$auth['id']??$auth['user_id']??0):0;
    if(!$uid && is_array($auth) && !empty($auth['email'])){
        $st=$pdo->prepare('SELECT id FROM users WHERE email=?');$st->execute([$auth['email']]);$uid=(int)$st->fetchColumn();
    }
    if(!$uid) wb_fail(401,'Unauthorized');
    ws_require($pdo,$uid,'roles.manage');
    $input=json_decode(file_get_contents('php://input'),true);
    if(!is_array($input)) wb_fail(422,'A JSON object is required');
    $clean=wb_clean(array_merge($current,array_intersect_key($input,$defaults)));
    $st=$pdo->prepare('INSERT INTO ws_branding(id,data,updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE data=VALUES(data),updated_by=VALUES(updated_by)');
    $st->execute([1,json_encode($clean,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE),$uid]);
    echo json_encode(['branding'=>$clean],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
} catch(Throwable $e) {
    error_log((string)$e);
    if($method==='GET') {echo json_encode(['branding'=>$defaults],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
    wb_fail(500,'Could not save workspace branding');
}
