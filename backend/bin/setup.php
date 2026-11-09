<?php
if(PHP_SAPI!=='cli') {http_response_code(404);exit;}
require_once __DIR__.'/../config.php';
require_once __DIR__.'/../admin/permissions.php';
require_once __DIR__.'/../lib/workspace.php';
token_key();
$pdo=db();
$pdo->exec(file_get_contents(__DIR__.'/../schema.sql'));
foreach(['ws_ensure_roles','ws_ensure_profile','ws_ensure_teams','ws_ensure_acl','ws_ensure_date_cols','ws_ensure_parent_col','ws_ensure_numbering','ws_ensure_columns','ws_ensure_task_assignees','ws_ensure_task_comments','ws_ensure_message_extras','ws_ensure_productivity_tables','ws_ensure_space_icon','ws_ensure_channel_look','ws_ensure_subsidiaries','ws_ensure_settings','ws_ensure_presence','ws_ensure_docs'] as $fn) $fn($pdo);
if(!(int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn()) {
    $email=env('ADMIN_EMAIL');$pass=env('ADMIN_PASSWORD');
    if(!filter_var($email,FILTER_VALIDATE_EMAIL) || strlen($pass)<12) throw new RuntimeException('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters');
    $pdo->prepare('INSERT INTO users(email,password_hash,full_name,role) VALUES (?,?,?,?)')->execute([$email,password_hash($pass,PASSWORD_BCRYPT),env('ADMIN_NAME','Workspace Owner'),'op']);
    echo "Created workspace owner.\n";
}
if(in_array('--demo',$argv,true)) {
    if((int)$pdo->query('SELECT COUNT(*) FROM ws_spaces')->fetchColumn()) throw new RuntimeException('Demo seeding requires an empty workspace');
    require __DIR__.'/seed-demo.php';
}
echo "Workspace database ready.\n";
