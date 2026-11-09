<?php
// Fictional content only. Dummy members have random discarded passwords.
$pdo->beginTransaction();
try {
$owner=(int)$pdo->query('SELECT id FROM users ORDER BY id LIMIT 1')->fetchColumn();
$people=[];
foreach([['alex@example.com','Alex Morgan'],['sam@example.com','Sam Rivera']] as [$email,$name]) {
    $pdo->prepare('INSERT INTO users(email,password_hash,full_name,role) VALUES (?,?,?,?)')->execute([$email,password_hash(bin2hex(random_bytes(32)),PASSWORD_BCRYPT),$name,'member']);$people[]=(int)$pdo->lastInsertId();
}
foreach([['general','A fictional team channel'],['ideas','Share ideas for the next milestone']] as [$name,$desc]) $pdo->prepare('INSERT INTO ws_channels(name,description,created_by) VALUES (?,?,?)')->execute([$name,$desc,$owner]);
$channel=(int)$pdo->query('SELECT id FROM ws_channels ORDER BY id LIMIT 1')->fetchColumn();
$pdo->prepare('INSERT INTO ws_messages(channel_id,sender_id,body) VALUES (?,?,?)')->execute([$channel,$people[0],'Welcome to the demo workspace! These people and projects are fictional.']);
$spaces=[];
foreach([['Product','#5197ee','box'],['Design','#e79f69','lightbulb'],['Operations','#65a58d','cog']] as [$name,$color,$icon]) {
    $pdo->prepare('INSERT INTO ws_spaces(name,color,icon,created_by) VALUES (?,?,?,?)')->execute([$name,$color,$icon,$owner]);$spaces[]=(int)$pdo->lastInsertId();
}
$tasks=[['Plan the first milestone','todo',0],['Sketch the onboarding flow','in_progress',1],['Review the welcome guide','review',0],['Set up the team workspace','done',2],['Collect launch feedback','todo',0],['Choose a visual direction','in_progress',1]];
foreach($tasks as $i=>[$title,$status,$sp]) {
    $pdo->prepare('INSERT INTO ws_tasks(space_id,title,description,status,priority,assignee_id,start_date,end_date,due_date,project_no) VALUES (?,?,?,?,?,?,?,?,?,?)')->execute([$spaces[$sp],$title,'Example task — edit or remove this fictional content.',$status,$i===0?'high':'normal',$i%2?$people[0]:$owner,date('Y-m-d',strtotime('+'.$i.' days')),date('Y-m-d',strtotime('+'.($i+3).' days')),date('Y-m-d',strtotime('+'.($i+3).' days')),sprintf('%s-%03d',date('y'),$i+1)]);
    $tid=(int)$pdo->lastInsertId();ws_set_task_assignees($pdo,$tid,[$i%2?$people[0]:$owner]);
}
$pdo->prepare('INSERT INTO ws_tasks(space_id,title,status,parent_id,item_no) VALUES (?,?,?,?,?)')->execute([$spaces[0],'Write the milestone checklist','todo',(int)$pdo->query('SELECT id FROM ws_tasks ORDER BY id LIMIT 1')->fetchColumn(),0]);
$pdo->prepare('INSERT INTO ws_docs(title,body,is_pinned,created_by,updated_by) VALUES (?,?,1,?,?)')->execute(['Welcome to your workspace',"# Welcome\n\nThis is fictional demo content.\n\n- Open a space to explore the board.\n- Drag a task between columns.\n- Visit Planner to move dates.\n- Edit this document or create your own.\n\n## Make it yours\n\nCustom subsidiaries live in `src/extensions/manifest.json`. Read `docs/EXTENSIONS.md` to add a React panel.",$owner,$owner]);
$pdo->prepare('INSERT INTO ws_teams(name,description,color,created_by) VALUES (?,?,?,?)')->execute(['Example Team','Fictional demo members','#5197ee',$owner]);
$team=(int)$pdo->lastInsertId();foreach([$owner,...$people] as $uid) $pdo->prepare('INSERT INTO ws_team_members(team_id,user_id) VALUES (?,?)')->execute([$team,$uid]);
$pdo->commit();echo "Loaded fictional demo content.\n";
}catch(Throwable $e){$pdo->rollBack();throw $e;}
