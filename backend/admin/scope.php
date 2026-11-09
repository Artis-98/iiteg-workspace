<?php
function ws_guard_scope(PDO $pdo,int $meId,string $resource,int $id,array $in): void {
    $spaces=ws_visible_space_ids($pdo,$meId);
    $checkSpace=static function($sid) use($spaces) {
        if($sid!==null && (int)$sid>0 && !in_array((int)$sid,$spaces,true)) ws_fail(403,'That space is private or unavailable');
    };
    foreach(['space_id','parent_space_id'] as $f) {
        if(isset($in[$f])) $checkSpace($in[$f]);
        if(isset($_GET[$f])) $checkSpace($_GET[$f]);
    }
    if(in_array($resource,['spaces','space_columns'],true)) {
        if($resource==='spaces' && $id) $checkSpace($id);
        if(!empty($in['parent_id'])) {
            $checkSpace($in['parent_id']);
            if($id && in_array((int)$in['parent_id'],ws_space_tree($pdo,$id),true)) ws_fail(422,'A space cannot contain itself');
        }
    }
    $taskIds=[];
    if($resource==='tasks' && $id) $taskIds[]=$id;
    if(in_array($resource,['task_comments','time_entries'],true)) $taskIds[]=(int)($in['task_id']??$_GET['task_id']??0);
    if($resource==='tasks' && !empty($in['parent_id'])) {
        $taskIds[]=(int)$in['parent_id'];
        if($id && in_array((int)$in['parent_id'],ws_task_tree($pdo,$id),true)) ws_fail(422,'A task cannot contain itself');
    }
    foreach(array_filter($taskIds) as $tid) {
        $st=$pdo->prepare('SELECT space_id FROM ws_tasks WHERE id=?');$st->execute([$tid]);$row=$st->fetch();
        if(!$row) ws_fail(404,'Task not found');$checkSpace($row['space_id']);
    }
    if($resource==='docs' && $id) {
        $st=$pdo->prepare('SELECT space_id FROM ws_docs WHERE id=?');$st->execute([$id]);$row=$st->fetch();
        if($row) $checkSpace($row['space_id']);
    }
    if($resource==='channels' && $id && !in_array($id,ws_visible_channel_ids($pdo,$meId),true)) ws_fail(403,'That channel is private');
}
