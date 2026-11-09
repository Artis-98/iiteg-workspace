<?php
require_once __DIR__.'/config.php';
if ($_SERVER['REQUEST_METHOD']!=='POST') fail(405,'Method not allowed');
$in=json_input();$email=strtolower(trim((string)($in['email']??'')));$password=(string)($in['password']??'');
if(!filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($email)>190 || strlen($password)>1024) fail(401,'Invalid credentials');
$pdo=db();
// Persist rate limits across PHP workers; never trust a forwarded IP from a client.
$key=hash('sha256',($_SERVER['REMOTE_ADDR']??'local').'|'.$email);
$pdo->prepare('INSERT IGNORE INTO login_attempts (bucket,attempts,window_start) VALUES (?,0,UTC_TIMESTAMP())')->execute([$key]);
$pdo->prepare('UPDATE login_attempts SET attempts=0,window_start=UTC_TIMESTAMP() WHERE bucket=? AND window_start < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)')->execute([$key]);
$pdo->prepare('UPDATE login_attempts SET attempts=attempts+1 WHERE bucket=?')->execute([$key]);
$st=$pdo->prepare('SELECT attempts FROM login_attempts WHERE bucket=?');$st->execute([$key]);
if((int)$st->fetchColumn()>20) fail(429,'Too many attempts. Try again in 15 minutes.');
$st=$pdo->prepare('SELECT * FROM users WHERE email=?');$st->execute([$email]);$u=$st->fetch();
$hash=$u['password_hash']??'$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
if(!password_verify($password,$hash) || !$u) fail(401,'Invalid credentials');
$pdo->prepare('DELETE FROM login_attempts WHERE bucket=?')->execute([$key]);
$pdo->prepare('UPDATE users SET last_login_at=UTC_TIMESTAMP() WHERE id=?')->execute([$u['id']]);
echo json_encode(['token'=>issue_token($u),'user'=>['id'=>(int)$u['id'],'email'=>$u['email'],'name'=>$u['full_name'],'role'=>$u['role'],'avatar_url'=>$u['avatar_url']]]);
