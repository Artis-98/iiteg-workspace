<?php
require_once __DIR__.'/../config.php';
$auth=require_auth();
if($_SERVER['REQUEST_METHOD']!=='POST') fail(405,'Method not allowed');
$file=$_FILES['file']??null;
if(!$file || $file['error']!==UPLOAD_ERR_OK || $file['size']>10*1024*1024) fail(422,'Choose a file under 10 MB');
$mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
$allowed=['image/jpeg'=>'jpg','image/png'=>'png','image/gif'=>'gif','image/webp'=>'webp','application/pdf'=>'pdf','text/plain'=>'txt'];
if(!isset($allowed[$mime])) fail(422,'Supported files: JPEG, PNG, GIF, WebP, PDF, plain text');
$dir=env('UPLOAD_DIR',dirname(__DIR__).'/storage/uploads');
if(!is_dir($dir) && !mkdir($dir,0700,true)) throw new RuntimeException('Cannot create upload directory');
$id=bin2hex(random_bytes(24)).'.'.$allowed[$mime];
if(!move_uploaded_file($file['tmp_name'],$dir.'/'.$id)) throw new RuntimeException('Cannot save upload');
// A signed capability URL supports images in <img> without exposing bearer tokens.
$sig=hash_hmac('sha256',$id,token_key());
echo json_encode(['url'=>rtrim(env('PUBLIC_API_URL','http://localhost:8080/api'),'/').'/file.php?id='.$id.'&sig='.$sig]);
