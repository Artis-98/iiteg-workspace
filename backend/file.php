<?php
require_once __DIR__.'/config.php';
$id=(string)($_GET['id']??'');$sig=(string)($_GET['sig']??'');
if(!preg_match('/^[a-f0-9]{48}\.(jpg|png|gif|webp|pdf|txt)$/',$id) || !hash_equals(hash_hmac('sha256',$id,token_key()),$sig)) fail(404,'File not found');
$path=env('UPLOAD_DIR',__DIR__.'/storage/uploads').'/'.$id;
if(!is_file($path)) fail(404,'File not found');
$mime=(new finfo(FILEINFO_MIME_TYPE))->file($path);
header('Content-Type: '.$mime);header('Content-Security-Policy: sandbox');
header('Content-Disposition: '.(str_starts_with($mime,'image/')?'inline':'attachment').'; filename="'.$id.'"');
header('Content-Length: '.filesize($path));readfile($path);
