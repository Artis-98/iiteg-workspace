<?php
// Admin endpoint: /admin/workspace.php
// Single endpoint for the workspace module. Routing via ?resource=&action=
//
//   GET    ?resource=users                          -> list registered users
//   POST   ?resource=users        {email,password,name?,role?}  -> create user
//   DELETE ?resource=users&id=N                     -> delete user
//
//   GET    ?resource=channels                       -> list channels (+member ids)
//   POST   ?resource=channels     {name,description?,is_private,member_ids[]}
//   DELETE ?resource=channels&id=N
//
//   GET    ?resource=messages&channel_id=N          -> channel messages
//   GET    ?resource=messages&dm=USER_ID            -> direct messages with user
//   POST   ?resource=messages     {channel_id?|recipient_id?, body}
//   PUT    ?resource=messages&id=N {body}          -> edit your own message
//   DELETE ?resource=messages&id=N                 -> delete your own message
//
//   POST   ?resource=message_reactions {message_id, emoji}  -> toggle a reaction
//
//   GET    ?resource=spaces                         -> all spaces (flat, with parent_id)
//   POST   ?resource=spaces       {name,parent_id?,color?}
//   DELETE ?resource=spaces&id=N
//
//   GET    ?resource=tasks&space_id=N               -> tasks of space + all subspaces
//   PUT    ?resource=tasks&id=N   {any field}
//   DELETE ?resource=tasks&id=N
//
//   GET    ?resource=teams                          -> teams (+member ids)
//   POST   ?resource=teams        {name,description?,color?,member_ids[]}
//   PUT    ?resource=teams&id=N   {name?,description?,color?,member_ids[]?}
//   DELETE ?resource=teams&id=N
//
//   GET    ?resource=task_comments&task_id=N        -> per-task chat
//   POST   ?resource=task_comments {task_id,body}
//   DELETE ?resource=task_comments&id=N
//
//   GET    ?resource=docs                           -> all docs (no bodies)
//   GET    ?resource=docs&space_id=N                -> docs of space + all subspaces
//   GET    ?resource=docs&id=N                      -> one doc, with body
//   POST   ?resource=docs         {title,space_id?,body?}
//   PUT    ?resource=docs&id=N    {title?,body?,space_id?,is_pinned?}
//   DELETE ?resource=docs&id=N
//
//   GET    ?resource=read_state                     -> this user's seen-at map
//   PUT    ?resource=read_state   {scope,scope_id?,seen_at?}
//
//   GET    ?resource=time_entries[&task_id=N]       -> entries + running timer + total
//   POST   ?resource=time_entries {action:start|manual, task_id, ...}
//   PUT    ?resource=time_entries&id=N {action:stop} | {any field}
//   DELETE ?resource=time_entries&id=N
//
//   GET    ?resource=activity                       -> inbox feed (comments + messages)
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/permissions.php';

$auth = require_auth();
$meId = 0;
if (is_array($auth)) {
    $meId = (int)($auth['sub'] ?? $auth['id'] ?? $auth['user_id'] ?? 0);
}

$pdo      = db();

// The shared connection in config.php still negotiates utf8mb3, which silently
// replaces every 4-byte character with "?" on the way into the database — so
// emoji in chat messages were being destroyed long before reactions existed.
// It also makes any comparison against a utf8mb4 column fail outright with
// "illegal mix of collations". One statement per request fixes both; the real
// cure is charset=utf8mb4 in config.php, which would fix the other endpoints too.
try { $pdo->exec('SET NAMES utf8mb4'); } catch (Throwable $e) { /* pre-utf8mb4 server */ }

$method   = $_SERVER['REQUEST_METHOD'];
$resource = $_GET['resource'] ?? '';
$id       = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$in       = json_decode(file_get_contents('php://input'), true) ?: [];

if ($meId <= 0) fail(401, 'Unauthorized');

// Everything below hangs off $meId: get it wrong and the owner of the account
// is treated as an anonymous member. If the token carried an email but no id,
// resolve it here rather than silently dropping to the weakest role.
if ($meId === 0 && is_array($auth) && !empty($auth['email'])) {
    try {
        $st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $st->execute([(string)$auth['email']]);
        $meId = (int)$st->fetchColumn();
    } catch (Throwable $e) { /* leave it at 0 */ }
}

function ws_fail(int $code, string $msg) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

require_once __DIR__ . '/../lib/workspace.php';
require_once __DIR__ . '/scope.php';
ws_guard_scope($pdo, $meId, $resource, $id, $in);

try {
    /* ---------------- ME ----------------
       Who the caller is and what their role lets them do. The client hides
       every edit affordance the answer does not cover. */
    if ($resource === 'me') {
        if ($method === 'GET') {
            echo json_encode(['me' => ws_me($pdo, $meId)]);
            exit;
        }

        /* Self-service profile. No permission needed — this is your own account,
           and it is the only path that may change a password. Email is not
           editable here: it is the login identity. */
        if ($method === 'PUT' || $method === 'PATCH') {
            if ($meId <= 0) ws_fail(401, 'not signed in');
            ws_ensure_profile($pdo);

            $sets = []; $vals = [];

            if (array_key_exists('name', $in)) {
                $newName = trim((string)$in['name']);
                if ($newName === '') ws_fail(422, 'Your name cannot be empty');
                if (mb_strlen($newName) > 120) ws_fail(422, 'That name is too long');
                $nameCol = ws_display_name_col($pdo);
                if (!$nameCol) ws_fail(500, 'users table has no name column');
                $sets[] = "`$nameCol` = ?"; $vals[] = $newName;
            }

            if (array_key_exists('avatar_url', $in)) {
                $url = trim((string)($in['avatar_url'] ?? ''));
                if ($url === '') {
                    $sets[] = 'avatar_url = ?'; $vals[] = null;   // back to initials
                } else {
                    if (!preg_match('~^https?://~i', $url)) ws_fail(422, 'avatar_url must be a http(s) URL');
                    if (strlen($url) > 255) ws_fail(422, 'That image URL is too long');
                    $sets[] = 'avatar_url = ?'; $vals[] = $url;
                }
            }

            if (array_key_exists('new_password', $in)) {
                $new = (string)$in['new_password'];
                $cur = (string)($in['current_password'] ?? '');
                if (strlen($new) < 8) ws_fail(422, 'New password must be at least 8 characters');

                $pwCol = ws_password_col($pdo);
                if (!$pwCol) ws_fail(500, 'users table has no password column');

                $st = $pdo->prepare("SELECT `$pwCol` FROM users WHERE id = ?");
                $st->execute([$meId]);
                $hash = (string)$st->fetchColumn();
                if (!ws_password_matches($cur, $hash)) {
                    ws_fail(403, 'Your current password is not right');
                }
                $sets[] = "`$pwCol` = ?"; $vals[] = password_hash($new, PASSWORD_BCRYPT);
            }

            if (!$sets) ws_fail(422, 'nothing to update');
            $vals[] = $meId;
            $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);

            echo json_encode(['success' => true, 'me' => ws_me($pdo, $meId, true)]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- ROLES ----------------
       `rank` orders the hierarchy: OP is 0 and higher numbers are weaker. You
       may only touch a role that sits strictly below your own, and only an OP
       can hand out the wildcard permission. */
    if ($resource === 'roles') {
        ws_ensure_roles($pdo);
        $me   = ws_me($pdo, $meId);
        $isOp = in_array('*', $me['permissions'], true);

        if ($method === 'GET') {
            $rows   = $pdo->query('SELECT * FROM ws_roles ORDER BY `rank`, name')->fetchAll();
            $counts = [];
            foreach ($pdo->query('SELECT role, COUNT(*) AS n FROM users GROUP BY role')->fetchAll() as $c) {
                $counts[(string)$c['role']] = (int)$c['n'];
            }
            foreach ($rows as &$r) {
                $r['id']          = (int)$r['id'];
                $r['rank']        = (int)$r['rank'];
                $r['is_system']   = (int)$r['is_system'];
                $perms            = json_decode((string)$r['permissions'], true);
                $r['permissions'] = is_array($perms) ? array_values($perms) : [];
                $r['user_count']  = $counts[(string)$r['slug']] ?? 0;
            }
            unset($r);
            echo json_encode(['roles' => $rows, 'all_permissions' => WS_PERMISSIONS, 'me' => $me]);
            exit;
        }

        ws_require($pdo, $meId, 'roles.manage');

        if ($method === 'POST') {
            $name = trim((string)($in['name'] ?? ''));
            if ($name === '') ws_fail(422, 'name required');
            $rank = (int)($in['rank'] ?? 100);
            if ($rank <= 0) ws_fail(422, 'Rank 0 belongs to OP alone');
            if ($rank <= $me['rank'] && !$isOp) {
                ws_fail(403, 'You cannot create a role at or above your own rank');
            }
            $perms = ws_clean_permissions(is_array($in['permissions'] ?? null) ? $in['permissions'] : []);
            if (in_array('*', $perms, true) && !$isOp) ws_fail(403, 'Only an OP can grant every permission');

            $slug = ws_role_slug($pdo, (string)($in['slug'] ?? $name));
            $st = $pdo->prepare(
                'INSERT INTO ws_roles (slug, name, `rank`, color, permissions, is_system) VALUES (?, ?, ?, ?, ?, 0)'
            );
            $st->execute([$slug, $name, $rank, $in['color'] ?? null, json_encode($perms)]);
            echo json_encode(['id' => (int)$pdo->lastInsertId(), 'slug' => $slug]);
            exit;
        }

        if (($method === 'PUT' || $method === 'PATCH') && $id) {
            $st = $pdo->prepare('SELECT * FROM ws_roles WHERE id = ?');
            $st->execute([$id]);
            $role = $st->fetch();
            if (!$role) ws_fail(404, 'role not found');
            if ((int)$role['is_system'] === 1 && !$isOp) ws_fail(403, 'Built-in roles can only be changed by an OP');
            if ((int)$role['rank'] <= $me['rank'] && !$isOp) {
                ws_fail(403, 'You cannot change a role at or above your own rank');
            }

            $sets = []; $vals = [];
            if (array_key_exists('name', $in)) {
                $n = trim((string)$in['name']);
                if ($n === '') ws_fail(422, 'name cannot be empty');
                $sets[] = 'name = ?'; $vals[] = $n;
            }
            if (array_key_exists('color', $in)) { $sets[] = 'color = ?'; $vals[] = $in['color'] ?: null; }

            // The OP role is the anchor of the hierarchy: it keeps rank 0 and
            // the wildcard, or an OP could lock every door in the building.
            if ($role['slug'] !== 'op') {
                if (array_key_exists('rank', $in)) {
                    $rank = (int)$in['rank'];
                    if ($rank <= $me['rank'] && !$isOp) ws_fail(403, 'That rank is at or above your own');
                    if ($rank <= 0) ws_fail(422, 'Only OP may hold rank 0');
                    $sets[] = '`rank` = ?'; $vals[] = $rank;
                }
                if (array_key_exists('permissions', $in) && is_array($in['permissions'])) {
                    $perms = ws_clean_permissions($in['permissions']);
                    if (in_array('*', $perms, true) && !$isOp) ws_fail(403, 'Only an OP can grant every permission');
                    $sets[] = 'permissions = ?'; $vals[] = json_encode($perms);
                }
            }

            if (!$sets) ws_fail(422, 'nothing to update');
            $vals[] = $id;
            $pdo->prepare('UPDATE ws_roles SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            echo json_encode(['success' => true]);
            exit;
        }

        if ($method === 'DELETE' && $id) {
            $st = $pdo->prepare('SELECT * FROM ws_roles WHERE id = ?');
            $st->execute([$id]);
            $role = $st->fetch();
            if (!$role) ws_fail(404, 'role not found');
            if ((int)$role['is_system'] === 1) ws_fail(403, 'Built-in roles cannot be deleted');
            if ((int)$role['rank'] <= $me['rank'] && !$isOp) {
                ws_fail(403, 'You cannot delete a role at or above your own rank');
            }
            // Whoever held it lands on Member rather than on a dangling slug.
            $pdo->prepare("UPDATE users SET role = 'member' WHERE role = ?")->execute([$role['slug']]);
            $pdo->prepare('DELETE FROM ws_roles WHERE id = ?')->execute([$id]);
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- USERS ---------------- */
    if ($resource === 'users') {
        if ($method === 'GET') {
            ws_ensure_profile($pdo);
            $cols   = ws_user_cols($pdo);
            $select = ['id', 'email', ws_user_name_expr($pdo)];
            foreach (['role', 'created_at', 'avatar_url'] as $opt) {
                if (in_array($opt, $cols, true)) $select[] = $opt;
            }
            $rows = $pdo->query('SELECT ' . implode(', ', $select) . ' FROM users ORDER BY id')->fetchAll();
            foreach ($rows as &$r) {
                if (!isset($r['role'])) $r['role'] = 'member';
            }
            unset($r);


            echo json_encode(['users' => $rows]);
            exit;
        }
        if ($method === 'POST') {
            ws_require($pdo, $meId, 'users.create');
            $email = trim($in['email'] ?? '');
            $pass  = (string)($in['password'] ?? '');
            if ($email === '' || strlen($pass) < 8) ws_fail(422, 'email and password (min 8 chars) required');
            $name  = trim($in['name'] ?? '') ?: explode('@', $email)[0];
            $role  = (string)($in['role'] ?? 'member');
            ws_require_can_assign($pdo, $meId, $role);
            $hash  = password_hash($pass, PASSWORD_BCRYPT);
            $cols  = ws_user_cols($pdo);
            $nameCol = ws_user_name_col($pdo);
            $insCols = ['email']; $vals = [$email];
            if ($nameCol) { $insCols[] = $nameCol; $vals[] = $name; }
            if (in_array('role', $cols, true)) { $insCols[] = 'role'; $vals[] = $role; }
            $pwCol = in_array('password_hash', $cols, true) ? 'password_hash' : (in_array('password', $cols, true) ? 'password' : null);
            if (!$pwCol) ws_fail(500, 'users table has no password column');
            $insCols[] = $pwCol; $vals[] = $hash;
            $ph = implode(', ', array_fill(0, count($insCols), '?'));
            $st = $pdo->prepare('INSERT INTO users (' . implode(', ', $insCols) . ") VALUES ($ph)");
            $st->execute($vals);


            echo json_encode(['id' => (int)$pdo->lastInsertId()]);
            exit;
        }
        /* Role assignment lives here: PUT ?resource=users&id=N {role} */
        if (($method === 'PUT' || $method === 'PATCH') && $id) {
            ws_require($pdo, $meId, 'users.edit');
            $sets = []; $vals = [];

            if (array_key_exists('role', $in)) {
                $role = (string)$in['role'];
                ws_require_can_assign($pdo, $meId, $role);
                if ($role !== 'op') ws_guard_last_op($pdo, $id);
                $sets[] = 'role = ?'; $vals[] = $role;
            }
            $nameCol = ws_user_name_col($pdo);
            if ($nameCol && array_key_exists('name', $in)) {
                $n = trim((string)$in['name']);
                if ($n === '') ws_fail(422, 'name cannot be empty');
                $sets[] = "$nameCol = ?"; $vals[] = $n;
            }

            if (!$sets) ws_fail(422, 'nothing to update');
            $vals[] = $id;
            $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            echo json_encode(['success' => true]);
            exit;
        }
        if ($method === 'DELETE' && $id) {
            ws_require($pdo, $meId, 'users.delete');
            ws_guard_last_op($pdo, $id);
            $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- CHANNELS ---------------- */
    if ($resource === 'channels') {
        ws_ensure_channel_look($pdo);
        if ($method === 'GET') {
            $visible = ws_visible_channel_ids($pdo, $meId);
            $chs = $pdo->query(
                'SELECT * FROM ws_channels WHERE ' . ws_id_in($visible, 'id') . ' ORDER BY name'
            )->fetchAll();
            foreach ($chs as &$c) {
                $c['id']         = (int)$c['id'];
                $c['is_private'] = (int)$c['is_private'];
                $acl             = ws_acl_for($pdo, 'channel', $c['id']);
                $c['member_ids'] = $acl['user_ids'];
                $c['team_ids']   = $acl['team_ids'];
            }
            unset($c);
            echo json_encode(['channels' => $chs]);
            exit;
        }
        if ($method === 'POST') {
            ws_require($pdo, $meId, 'channels.create');
            $name = strtolower(trim($in['name'] ?? ''));
            if ($name === '') ws_fail(422, 'name required');
            $priv = !empty($in['is_private']) ? 1 : 0;
            $st = $pdo->prepare('INSERT INTO ws_channels (name, description, is_private, icon, color, created_by) VALUES (?, ?, ?, ?, ?, ?)');
            $st->execute([$name, $in['description'] ?? null, $priv, $in['icon'] ?? null, $in['color'] ?? null, $meId ?: null]);
            $cid = (int)$pdo->lastInsertId();

            // Whoever creates a private channel is always on its list.
            $members = is_array($in['member_ids'] ?? null) ? $in['member_ids'] : [];
            if ($priv && $meId) $members[] = $meId;
            ws_acl_save($pdo, 'channel', $cid, $members, is_array($in['team_ids'] ?? null) ? $in['team_ids'] : []);

            echo json_encode(['id' => $cid]);
            exit;
        }
        if (($method === 'PUT' || $method === 'PATCH') && $id) {
            ws_require($pdo, $meId, 'channels.edit');
            $sets = []; $vals = [];
            if (array_key_exists('name', $in)) {
                $n = strtolower(trim((string)$in['name']));
                if ($n === '') ws_fail(422, 'name cannot be empty');
                $sets[] = 'name = ?'; $vals[] = $n;
            }
            foreach (['description', 'icon', 'color'] as $f) {
                if (array_key_exists($f, $in)) {
                    $sets[] = "$f = ?";
                    $vals[] = $in[$f] === '' ? null : $in[$f];
                }
            }
            if (array_key_exists('is_private', $in)) {
                $sets[] = 'is_private = ?'; $vals[] = empty($in['is_private']) ? 0 : 1;
            }
            if (!$sets) ws_fail(422, 'nothing to update');
            $vals[] = $id;
            $pdo->prepare('UPDATE ws_channels SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            ws_acl_save(
                $pdo, 'channel', $id,
                is_array($in['member_ids'] ?? null) ? $in['member_ids'] : null,
                is_array($in['team_ids'] ?? null) ? $in['team_ids'] : null
            );
            echo json_encode(['success' => true]);
            exit;
        }
        if ($method === 'DELETE' && $id) {
            ws_require($pdo, $meId, 'channels.delete');
            $pdo->prepare('DELETE FROM ws_channels WHERE id = ?')->execute([$id]);
            ws_acl_clear($pdo, 'channel', $id);
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- SETTINGS ----------------
       One JSON blob per scope. PUT merges, so a client that knows about only
       some keys cannot wipe the ones it has never heard of. */
    if ($resource === 'settings') {
        ws_ensure_settings($pdo);
        $scope = trim((string)($_GET['scope'] ?? ($in['scope'] ?? '')));
        if ($scope === '') ws_fail(422, 'scope required');

        $read = function () use ($pdo, $scope): array {
            $st = $pdo->prepare('SELECT data FROM ws_settings WHERE scope = ?');
            $st->execute([$scope]);
            $raw = $st->fetchColumn();
            $decoded = $raw ? json_decode($raw, true) : [];
            return is_array($decoded) ? $decoded : [];
        };

        if ($method === 'GET') {
            echo json_encode(['scope' => $scope, 'settings' => (object)$read()]);
            exit;
        }
        if ($method === 'PUT' || $method === 'PATCH' || $method === 'POST') {
            $patch = is_array($in['settings'] ?? null) ? $in['settings'] : [];
            if (!$patch) ws_fail(422, 'settings object required');
            $merged = array_merge($read(), $patch);
            $st = $pdo->prepare(
                'INSERT INTO ws_settings (scope, data, updated_by) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE data = VALUES(data), updated_by = VALUES(updated_by)'
            );
            $st->execute([$scope, json_encode($merged), $meId ?: null]);
            echo json_encode(['settings' => (object)$merged]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- PRESENCE ----------------
       The client reports only whether it is active or idle. Whether that counts
       as online at all is decided here from the heartbeat age, so a browser that
       closes without firing an unload event still decays to offline. */
    if ($resource === 'presence') {
        ws_ensure_presence($pdo);

        if ($method === 'GET') {
            $rows = $pdo->query('SELECT user_id, state, last_seen FROM ws_presence')->fetchAll();
            $now = time();
            $out = [];
            foreach ($rows as $r) {
                $age = max(0, $now - strtotime($r['last_seen']));
                if ($age > WS_PRESENCE_TTL)      $state = 'offline';
                elseif ($r['state'] === 'idle')  $state = 'afk';
                else                             $state = 'online';
                $out[] = [
                    'user_id'     => (int)$r['user_id'],
                    'state'       => $state,
                    'seconds_ago' => $age,
                ];
            }
            echo json_encode(['presence' => $out]);
            exit;
        }

        if ($method === 'PUT' || $method === 'PATCH' || $method === 'POST') {
            if (!$meId) ws_fail(401, 'authenticated user required');
            $reported = (string)($in['state'] ?? 'active');
            if ($reported === 'gone') {
                // Tab closed or signed out: drop the row so nothing lingers.
                $pdo->prepare('DELETE FROM ws_presence WHERE user_id = ?')->execute([$meId]);
                echo json_encode(['success' => true]);
                exit;
            }
            $state = $reported === 'idle' ? 'idle' : 'active';
            $st = $pdo->prepare(
                'INSERT INTO ws_presence (user_id, state, last_seen) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE state = VALUES(state), last_seen = VALUES(last_seen)'
            );
            $st->execute([$meId, $state, date('Y-m-d H:i:s')]);
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- SUBSIDIARY LOOK OVERRIDES ---------------- */
    if ($resource === 'subsidiaries') {
        ws_ensure_subsidiaries($pdo);
        ws_ensure_acl($pdo);
        if ($method === 'GET') {
            // The subsidiary list itself is hard-coded in the client, so the
            // slugs the caller may not see come back separately for it to drop.
            $out = []; $hidden = [];
            foreach ($pdo->query('SELECT * FROM ws_subsidiaries')->fetchAll() as $r) {
                $slug = (string)$r['slug'];
                $priv = (int)($r['is_private'] ?? 0) === 1;
                if (!ws_acl_allows($pdo, $meId, 'subsidiary', $slug, $priv)) {
                    $hidden[] = $slug;
                    continue;
                }
                $acl = ws_acl_for($pdo, 'subsidiary', $slug);
                $r['is_private'] = $priv ? 1 : 0;
                $r['member_ids'] = $acl['user_ids'];
                $r['team_ids']   = $acl['team_ids'];
                $out[] = $r;
            }
            echo json_encode(['subsidiaries' => $out, 'hidden' => $hidden]);
            exit;
        }
        if ($method === 'PUT' || $method === 'PATCH' || $method === 'POST') {
            ws_require($pdo, $meId, 'subsidiaries.edit');
            $slug = trim((string)($in['slug'] ?? ''));
            if ($slug === '') ws_fail(422, 'slug required');
            // Only write what the caller actually sent. The upsert here used to
            // set every column unconditionally, so updating an icon silently
            // reset is_private to 0 and unshared a private subsidiary. Same
            // partial-update approach for every optional field.
            $fields = [];
            if (array_key_exists('icon', $in))  $fields['icon']  = $in['icon'] !== null ? (string)$in['icon'] : null;
            if (array_key_exists('color', $in)) $fields['color'] = $in['color'] !== null ? (string)$in['color'] : null;
            if (array_key_exists('is_private', $in)) $fields['is_private'] = empty($in['is_private']) ? 0 : 1;
            // is_private is not created by any migration here, so it is present
            // on deployed databases but not on a fresh one.
            $subCols = ws_table_cols($pdo, 'ws_subsidiaries');
            $fields  = array_intersect_key($fields, array_flip($subCols));

            $pdo->prepare('INSERT IGNORE INTO ws_subsidiaries (slug) VALUES (?)')->execute([$slug]);
            if ($fields) {
                $set = implode(', ', array_map(static fn(string $c): string => "$c = :$c", array_keys($fields)));
                $params = [':slug' => $slug];
                foreach ($fields as $k => $v) $params[":$k"] = $v;
                $pdo->prepare("UPDATE ws_subsidiaries SET $set WHERE slug = :slug")->execute($params);
            }
            ws_acl_save(
                $pdo, 'subsidiary', $slug,
                is_array($in['member_ids'] ?? null) ? $in['member_ids'] : null,
                is_array($in['team_ids'] ?? null) ? $in['team_ids'] : null
            );
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- MESSAGES ---------------- */
    if ($resource === 'messages') {
        ws_ensure_message_extras($pdo);
        if ($method === 'GET') {
            $channelId = isset($_GET['channel_id']) ? (int)$_GET['channel_id'] : 0;
            $dm        = isset($_GET['dm']) ? (int)$_GET['dm'] : 0;
            $senderExpr = str_replace(' AS name', ' AS sender_name', ws_user_name_expr($pdo, 'u'));
            // The quoted line comes back with the message so the client never
            // has to hold the whole history to render what a reply answers.
            $hasReply   = in_array('reply_to', ws_table_cols($pdo, 'ws_messages'), true);
            $replyExpr  = str_replace(' AS name', ' AS reply_sender_name', ws_user_name_expr($pdo, 'ru'));
            $replySel   = $hasReply ? ", rm.body AS reply_body, $replyExpr" : '';
            $replyJoin  = $hasReply
                ? ' LEFT JOIN ws_messages rm ON rm.id = m.reply_to LEFT JOIN users ru ON ru.id = rm.sender_id'
                : '';
            if ($channelId) {
                if (!in_array($channelId, ws_visible_channel_ids($pdo, $meId), true)) {
                    ws_fail(403, 'That channel is private');
                }
                $st = $pdo->prepare(
                    "SELECT m.*, $senderExpr, u.email AS sender_email$replySel
                     FROM ws_messages m LEFT JOIN users u ON u.id = m.sender_id$replyJoin
                     WHERE m.channel_id = ? ORDER BY m.id ASC LIMIT 500"
                );
                $st->execute([$channelId]);
            } elseif ($dm) {
                $st = $pdo->prepare(
                    "SELECT m.*, $senderExpr, u.email AS sender_email$replySel
                     FROM ws_messages m LEFT JOIN users u ON u.id = m.sender_id$replyJoin
                     WHERE m.channel_id IS NULL
                       AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))
                     ORDER BY m.id ASC LIMIT 500"
                );
                $st->execute([$meId, $dm, $dm, $meId]);
            } else {
                ws_fail(422, 'channel_id or dm required');
            }
            echo json_encode(['messages' => ws_with_reactions($pdo, $st->fetchAll(), $meId)]);
            exit;
        }
        if ($method === 'POST') {
            $body = trim($in['body'] ?? '');
            if ($body === '') ws_fail(422, 'body required');
            if (!empty($in['channel_id'])
                && !in_array((int)$in['channel_id'], ws_visible_channel_ids($pdo, $meId), true)) {
                ws_fail(403, 'That channel is private');
            }
            $cols = ['channel_id', 'sender_id', 'recipient_id', 'body'];
            $vals = [
                !empty($in['channel_id']) ? (int)$in['channel_id'] : null,
                $meId,
                !empty($in['recipient_id']) ? (int)$in['recipient_id'] : null,
                $body,
            ];
            // A reply must point at a message in the same conversation, or it
            // would quote something the reader cannot see.
            if (!empty($in['reply_to']) && in_array('reply_to', ws_table_cols($pdo, 'ws_messages'), true)) {
                $rt = (int)$in['reply_to'];
                $p  = $pdo->prepare('SELECT channel_id, sender_id, recipient_id FROM ws_messages WHERE id = ?');
                $p->execute([$rt]);
                $par = $p->fetch();
                $sameChannel = $par && !empty($in['channel_id'])
                    && (int)$par['channel_id'] === (int)$in['channel_id'];
                // The parent must be between the same two people, not merely a
                // conversation I am part of: checking only my own membership let
                // a message from one DM be quoted into another.
                $other  = !empty($in['recipient_id']) ? (int)$in['recipient_id'] : 0;
                $pair   = $par ? [(int)$par['sender_id'], (int)$par['recipient_id']] : [];
                sort($pair);
                $want   = [$meId, $other];
                sort($want);
                $sameDm = $par && empty($in['channel_id']) && $par['channel_id'] === null
                    && $other > 0 && $pair === $want;
                if (!$sameChannel && !$sameDm) ws_fail(422, 'reply_to is not in this conversation');
                $cols[] = 'reply_to';
                $vals[] = $rt;
            }
            $ph = implode(', ', array_fill(0, count($cols), '?'));
            $st = $pdo->prepare('INSERT INTO ws_messages (' . implode(', ', $cols) . ") VALUES ($ph)");
            $st->execute($vals);
            echo json_encode(['id' => (int)$pdo->lastInsertId()]);
            exit;
        }
        if ($method === 'PUT' && $id) {
            $body = trim($in['body'] ?? '');
            if ($body === '') ws_fail(422, 'body required');
            $st = $pdo->prepare('SELECT sender_id FROM ws_messages WHERE id = ?');
            $st->execute([$id]);
            $owner = $st->fetchColumn();
            if ($owner === false) ws_fail(404, 'no such message');
            // Editing is strictly first-person. Deleting someone else's message
            // is a moderation act; rewriting it puts words in their mouth, so no
            // permission unlocks this.
            if ((int)$owner !== $meId) ws_fail(403, 'You can only edit your own messages');
            // NOW() rather than PHP's clock: created_at comes from MySQL, and a
            // mixed pair reads as an edit that happened before the message.
            $pdo->prepare('UPDATE ws_messages SET body = ?, edited_at = NOW() WHERE id = ?')
                ->execute([$body, $id]);
            echo json_encode(['success' => true]);
            exit;
        }
        if ($method === 'DELETE' && $id) {
            $st = $pdo->prepare('SELECT sender_id FROM ws_messages WHERE id = ?');
            $st->execute([$id]);
            $owner = $st->fetchColumn();
            if ($owner === false) { echo json_encode(['success' => true]); exit; }
            if ((int)$owner !== $meId) ws_require($pdo, $meId, 'messages.delete');
            $pdo->prepare('DELETE FROM ws_message_reactions WHERE message_id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM ws_messages WHERE id = ?')->execute([$id]);
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- MESSAGE REACTIONS ----------------
       One POST toggles: the same emoji from the same person twice removes it,
       so the client never has to know which way round it is. */
    if ($resource === 'message_reactions') {
        ws_ensure_message_extras($pdo);
        if ($method !== 'POST') ws_fail(405, 'method not allowed');
        if (!$meId) ws_fail(401, 'sign in to react');
        $mid   = (int)($in['message_id'] ?? 0);
        $emoji = trim((string)($in['emoji'] ?? ''));
        if (!$mid || $emoji === '') ws_fail(422, 'message_id and emoji required');
        if (mb_strlen($emoji) > 8) ws_fail(422, 'that is not an emoji');

        // Reacting is reading: the same visibility rules the message list uses.
        $st = $pdo->prepare('SELECT channel_id, sender_id, recipient_id FROM ws_messages WHERE id = ?');
        $st->execute([$mid]);
        $msg = $st->fetch();
        if (!$msg) ws_fail(404, 'no such message');
        if ($msg['channel_id'] !== null) {
            if (!in_array((int)$msg['channel_id'], ws_visible_channel_ids($pdo, $meId), true)) {
                ws_fail(403, 'That channel is private');
            }
        } elseif ((int)$msg['sender_id'] !== $meId && (int)$msg['recipient_id'] !== $meId) {
            ws_fail(403, 'Not your conversation');
        }

        $del = $pdo->prepare('DELETE FROM ws_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?');
        $del->execute([$mid, $meId, $emoji]);
        $on = $del->rowCount() === 0;
        if ($on) {
            $pdo->prepare('INSERT IGNORE INTO ws_message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)')
                ->execute([$mid, $meId, $emoji]);
        }
        echo json_encode(['success' => true, 'on' => $on]);
        exit;
    }

    /* ---------------- PROJECT NUMBERING ----------------
       GET  -> { year, next, categories, preview }
       PUT  -> { next?, categories? }   correct the run, name the digits */
    if ($resource === 'numbering') {
        ws_ensure_numbering($pdo);
        if ($method === 'GET') {
            $cfg = ws_numbering_settings($pdo);
            $cfg['preview'] = sprintf('%02d-%03d', $cfg['year'], $cfg['next']);
            echo json_encode(['numbering' => $cfg]);
            exit;
        }
        if ($method === 'PUT' || $method === 'PATCH') {
            ws_require($pdo, $meId, 'tasks.edit');
            $cfg = ws_numbering_settings($pdo);
            if (array_key_exists('next', $in)) {
                $next = (int)$in['next'];
                if ($next < 1 || $next > 999) ws_fail(422, 'next must be between 1 and 999');
                $cfg['next'] = $next;
            }
            if (array_key_exists('categories', $in) && is_array($in['categories'])) {
                $clean = [];
                foreach ($in['categories'] as $digit => $label) {
                    $d = (string)(int)$digit;
                    if ($d < '0' || $d > '9' || strlen($d) !== 1) continue;
                    $label = trim((string)$label);
                    if ($label !== '') $clean[$d] = mb_substr($label, 0, 48);
                }
                $cfg['categories'] = $clean;
            }
            $cfg['backfilled'] = true;   // never undo the one-off pass
            ws_numbering_save($pdo, $cfg);
            $cfg = ws_numbering_settings($pdo);
            $cfg['preview'] = sprintf('%02d-%03d', $cfg['year'], $cfg['next']);
            echo json_encode(['numbering' => $cfg]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- BOARD COLUMNS ----------------
       GET    ?resource=space_columns&space_id=N
       PUT    ?resource=space_columns&space_id=N  {columns:[{key?,label,tone}], hidden:[key]}
       DELETE ?resource=space_columns&space_id=N  go back to inheriting */
    if ($resource === 'space_columns') {
        if (!ws_ensure_columns($pdo)) ws_fail(500, 'columns are not available on this database');
        $spaceId = isset($_GET['space_id']) ? (int)$_GET['space_id'] : 0;
        if (!$spaceId) ws_fail(422, 'space_id required');

        if ($method === 'GET') {
            $eff = ws_effective_columns($pdo, $spaceId);
            echo json_encode([
                'columns'  => $eff['columns'],
                'source'   => $eff['source'],
                'from'     => $eff['from'],
                'hidden'   => ws_hidden_columns($pdo, $spaceId),
                'rollup'   => ws_rollup_columns($pdo, $spaceId),
                'defaults' => WS_DEFAULT_COLUMNS,
            ]);
            exit;
        }

        if ($method === 'PUT' || $method === 'PATCH') {
            ws_require($pdo, $meId, 'spaces.edit');

            if (array_key_exists('columns', $in)) {
                $rows = is_array($in['columns']) ? $in['columns'] : [];
                $clean = [];
                $used  = [];
                foreach ($rows as $r) {
                    $label = trim((string)($r['label'] ?? ''));
                    if ($label === '') continue;
                    // Keep the key the client sent so a rename does not move
                    // every task; only invent one for a brand new column.
                    $key = ws_col_key((string)($r['key'] ?? '')) ?: ws_col_key($label);
                    if ($key === '') continue;
                    $base = $key; $n = 2;
                    while (isset($used[$key])) { $key = $base . '_' . $n; $n++; }
                    $used[$key] = true;
                    $clean[] = ['key' => $key, 'label' => mb_substr($label, 0, 48),
                                'tone' => mb_substr(trim((string)($r['tone'] ?? 'slate')), 0, 16) ?: 'slate'];
                }
                if (!$clean) ws_fail(422, 'a board needs at least one column');

                $pdo->beginTransaction();
                try {
                    $pdo->prepare('DELETE FROM ws_space_columns WHERE space_id = ?')->execute([$spaceId]);
                    $ins = $pdo->prepare(
                        'INSERT INTO ws_space_columns (space_id, col_key, label, tone, sort_order)
                         VALUES (?,?,?,?,?)'
                    );
                    foreach ($clean as $i => $c) $ins->execute([$spaceId, $c['key'], $c['label'], $c['tone'], $i]);
                    $pdo->commit();
                } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
            }

            if (array_key_exists('hidden', $in)) {
                $hide = is_array($in['hidden']) ? $in['hidden'] : [];
                $pdo->prepare('DELETE FROM ws_space_hidden_cols WHERE space_id = ?')->execute([$spaceId]);
                $ins = $pdo->prepare('INSERT IGNORE INTO ws_space_hidden_cols (space_id, col_key) VALUES (?,?)');
                foreach ($hide as $k) {
                    $k = ws_col_key((string)$k);
                    if ($k !== '') $ins->execute([$spaceId, $k]);
                }
            }

            $eff = ws_effective_columns($pdo, $spaceId);
            echo json_encode([
                'columns' => $eff['columns'], 'source' => $eff['source'], 'from' => $eff['from'],
                'hidden'  => ws_hidden_columns($pdo, $spaceId),
                'rollup'  => ws_rollup_columns($pdo, $spaceId),
            ]);
            exit;
        }

        if ($method === 'DELETE') {
            ws_require($pdo, $meId, 'spaces.edit');
            $pdo->prepare('DELETE FROM ws_space_columns WHERE space_id = ?')->execute([$spaceId]);
            $eff = ws_effective_columns($pdo, $spaceId);
            echo json_encode([
                'columns' => $eff['columns'], 'source' => $eff['source'], 'from' => $eff['from'],
                'hidden'  => ws_hidden_columns($pdo, $spaceId),
                'rollup'  => ws_rollup_columns($pdo, $spaceId),
            ]);
            exit;
        }

        ws_fail(405, 'method not allowed');
    }

    /* ---------------- SPACES ---------------- */
    if ($resource === 'spaces') {
        ws_ensure_space_icon($pdo);
        ws_ensure_acl($pdo);
        if ($method === 'GET') {
            $visible = ws_visible_space_ids($pdo, $meId);
            $rows = $pdo->query(
                'SELECT * FROM ws_spaces WHERE ' . ws_id_in($visible, 'id') . ' ORDER BY sort_order, name'
            )->fetchAll();
            foreach ($rows as &$r) {
                $r['id']         = (int)$r['id'];
                $r['parent_id']  = $r['parent_id'] === null ? null : (int)$r['parent_id'];
                $r['is_private'] = (int)($r['is_private'] ?? 0);
                $acl             = ws_acl_for($pdo, 'space', $r['id']);
                $r['member_ids'] = $acl['user_ids'];
                $r['team_ids']   = $acl['team_ids'];
            }
            unset($r);
            echo json_encode(['spaces' => $rows]);
            exit;
        }
        if ($method === 'POST') {
            ws_require($pdo, $meId, 'spaces.create');
            $name = trim($in['name'] ?? '');
            if ($name === '') ws_fail(422, 'name required');
            $priv = !empty($in['is_private']) ? 1 : 0;
            $st = $pdo->prepare('INSERT INTO ws_spaces (name, parent_id, color, icon, created_by, sort_order, is_private) VALUES (?, ?, ?, ?, ?, ?, ?)');
            $st->execute([
                $name,
                !empty($in['parent_id']) ? (int)$in['parent_id'] : null,
                $in['color'] ?? null,
                $in['icon'] ?? null,
                $meId ?: null,
                (int)($in['sort_order'] ?? 0),
                $priv,
            ]);
            $sid = (int)$pdo->lastInsertId();

            $members = is_array($in['member_ids'] ?? null) ? $in['member_ids'] : [];
            if ($priv && $meId) $members[] = $meId;
            ws_acl_save($pdo, 'space', $sid, $members, is_array($in['team_ids'] ?? null) ? $in['team_ids'] : []);

            echo json_encode(['id' => $sid]);
            exit;
        }
        if (($method === 'PUT' || $method === 'PATCH') && $id) {

            ws_require($pdo, $meId, 'spaces.edit');
            $sets = []; $vals = [];
            foreach (['name','color','icon','parent_id','sort_order'] as $f) {
                if (array_key_exists($f, $in)) {
                    $sets[] = "$f = ?";
                    $vals[] = ($in[$f] === '' ? null : $in[$f]);
                }
            }
            if (array_key_exists('is_private', $in)) {
                $sets[] = 'is_private = ?'; $vals[] = empty($in['is_private']) ? 0 : 1;
            }
            if (!$sets) ws_fail(422, 'nothing to update');
            $vals[] = $id;
            $pdo->prepare('UPDATE ws_spaces SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            ws_acl_save(
                $pdo, 'space', $id,
                is_array($in['member_ids'] ?? null) ? $in['member_ids'] : null,
                is_array($in['team_ids'] ?? null) ? $in['team_ids'] : null
            );
            echo json_encode(['success' => true]);
            exit;
        }

        if ($method === 'DELETE' && $id) {
            ws_require($pdo, $meId, 'spaces.delete');
            foreach (ws_space_tree($pdo, $id) as $sid) {
                $pdo->prepare('DELETE FROM ws_spaces WHERE id = ?')->execute([$sid]);
                ws_acl_clear($pdo, 'space', $sid);
            }
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- TASKS ---------------- */
    if ($resource === 'tasks') {
        ws_ensure_columns($pdo);
        if (ws_ensure_numbering($pdo)) ws_backfill_numbering($pdo);

        if ($method === 'GET') {
            $spaceId = isset($_GET['space_id']) ? (int)$_GET['space_id'] : 0;
            $all     = !empty($_GET['all']);
            if (!$spaceId && !$all) ws_fail(422, 'space_id or all required');
            ws_ensure_date_cols($pdo);
            $hasParent = ws_ensure_parent_col($pdo);
            ws_ensure_task_assignees($pdo);
            $assigneeExpr = str_replace(' AS name', ' AS assignee_name', ws_user_name_expr($pdo, 'u'));
            $extra = '';
            $joinP = '';
            if ($hasParent) {
                $extra .= ', pt.title AS parent_title';
                $joinP .= ' LEFT JOIN ws_tasks pt ON pt.id = t.parent_id';
            }
            if ($all) {
                $where = '1 = 1';
                $args  = [];
            } else {
                $ids   = ws_space_tree($pdo, $spaceId);
                $ph    = implode(',', array_fill(0, count($ids), '?'));
                $where = "t.space_id IN ($ph)";
                $args  = $ids;
            }
            // Tasks inherit the privacy of the space that holds them.
            $where = "($where) AND (t.space_id IS NULL OR "
                   . ws_id_in(ws_visible_space_ids($pdo, $meId), 't.space_id') . ')';
            $st = $pdo->prepare(
                "SELECT t.*, s.name AS space_name, {$assigneeExpr}{$extra}
                 FROM ws_tasks t
                 LEFT JOIN ws_spaces s ON s.id = t.space_id
                 LEFT JOIN users u ON u.id = t.assignee_id{$joinP}
                 WHERE $where
                 ORDER BY t.sort_order, t.id"
            );
            $st->execute($args);
            $tasks = $st->fetchAll();

            // Multi-assignees
            $nameCol = ws_user_name_col($pdo) ?: 'email';
            $arows = $pdo->query(
                "SELECT a.task_id, a.user_id, u.$nameCol AS name, u.email
                 FROM ws_task_assignees a LEFT JOIN users u ON u.id = a.user_id"
            )->fetchAll();
            // Comment counts
            ws_ensure_task_comments($pdo);
            ws_ensure_productivity_tables($pdo);
            $counts = [];
            foreach ($pdo->query('SELECT task_id, COUNT(*) AS c FROM ws_task_comments GROUP BY task_id')->fetchAll() as $r) {
                $counts[(int)$r['task_id']] = (int)$r['c'];
            }
            $tracked = [];
            foreach ($pdo->query('SELECT task_id, SUM(duration_seconds) AS seconds FROM ws_time_entries WHERE ended_at IS NOT NULL GROUP BY task_id')->fetchAll() as $r) {
                $tracked[(int)$r['task_id']] = (int)$r['seconds'];
            }
            // Roll every task's own time up through its ancestors, so a parent
            // reports the whole subtree — subtasks of subtasks included.
            $rollup = $tracked;
            if ($hasParent) {
                $parentOf = [];
                foreach ($pdo->query('SELECT id, parent_id FROM ws_tasks')->fetchAll() as $r) {
                    $parentOf[(int)$r['id']] = $r['parent_id'] === null ? null : (int)$r['parent_id'];
                }
                foreach ($tracked as $tid => $secs) {
                    $p = $parentOf[$tid] ?? null;
                    $guard = [];               // a cyclic parent chain must not hang the request
                    while ($p !== null && !isset($guard[$p])) {
                        $guard[$p]  = true;
                        $rollup[$p] = ($rollup[$p] ?? 0) + $secs;
                        $p = $parentOf[$p] ?? null;
                    }
                }
            }
            // A component is numbered against its project, so resolve every
            // task's top-level ancestor here rather than making each client
            // walk the tree with only a partial list in hand.
            $parentMap = [];
            $noMap     = [];
            foreach ($pdo->query('SELECT id, parent_id, project_no FROM ws_tasks')->fetchAll() as $r) {
                $parentMap[(int)$r['id']] = $r['parent_id'] === null ? null : (int)$r['parent_id'];
                $noMap[(int)$r['id']]     = $r['project_no'] ?? null;
            }
            $rootNo = static function (int $id) use ($parentMap, $noMap): ?string {
                $guard = [];
                while ($id && !isset($guard[$id])) {
                    $guard[$id] = true;
                    if (!empty($noMap[$id])) return $noMap[$id];
                    $id = (int)($parentMap[$id] ?? 0);
                }
                return null;
            };
            foreach ($tasks as &$t) {
                $tid = (int)$t['id'];
                $t['id'] = $tid;
                $t['parent_id']     = isset($t['parent_id']) && $t['parent_id'] !== null ? (int)$t['parent_id'] : null;
                $t['project_no']    = isset($t['project_no']) && $t['project_no'] !== '' ? $t['project_no'] : null;
                $t['item_no']       = isset($t['item_no']) && $t['item_no'] !== null ? (int)$t['item_no'] : null;
                $t['root_project_no'] = $rootNo($tid);
                $t['assignee_ids']  = [];
                $t['assignee_names'] = [];
                foreach ($arows as $a) {
                    if ((int)$a['task_id'] === $tid) {
                        $t['assignee_ids'][]   = (int)$a['user_id'];
                        $t['assignee_names'][] = $a['name'] ?: $a['email'];
                    }
                }
                $t['comment_count'] = $counts[$tid] ?? 0;
                $t['tracked_seconds'] = $tracked[$tid] ?? 0;        // this task alone
                $t['tracked_seconds_total'] = $rollup[$tid] ?? 0;   // task + whole subtree
            }
            unset($t);
            echo json_encode(['tasks' => $tasks]);
            exit;
        }
        if ($method === 'POST') {
            ws_require($pdo, $meId, 'tasks.create');
            $title = trim($in['title'] ?? '');
            if ($title === '' || empty($in['space_id'])) ws_fail(422, 'space_id and title required');
            $assigneeIds = is_array($in['assignee_ids'] ?? null)
                ? array_values(array_unique(array_filter(array_map('intval', $in['assignee_ids']))))
                : [];
            $cols = ['space_id','title','description','status','priority','assignee_id','due_date','sort_order'];
            $vals = [
                (int)$in['space_id'],
                $title,
                $in['description'] ?? null,
                $in['status'] ?? 'todo',
                $in['priority'] ?? 'none',
                !empty($in['assignee_id']) ? (int)$in['assignee_id'] : ($assigneeIds[0] ?? null),
                !empty($in['due_date']) ? $in['due_date'] : null,
                (int)($in['sort_order'] ?? 0),
            ];
            if (ws_ensure_date_cols($pdo)) {
                foreach (['start_date','end_date'] as $d) {
                    if (!empty($in[$d])) { $cols[] = $d; $vals[] = $in[$d]; }
                }
            }
            if (!empty($in['parent_id']) && ws_ensure_parent_col($pdo)) {
                $cols[] = 'parent_id';
                $vals[] = (int)$in['parent_id'];
            }
            // A new top-level task is a project and claims the next YY-NNN;
            // anything with a parent is a component and takes the next item
            // index under that project instead.
            if (ws_ensure_numbering($pdo)) {
                $parentId = !empty($in['parent_id']) ? (int)$in['parent_id'] : 0;
                if ($parentId) {
                    $root = ws_task_root($pdo, $parentId);
                    if ($root) { $cols[] = 'item_no'; $vals[] = ws_next_item_no($pdo, (int)$root['id']); }
                } else {
                    $cols[] = 'project_no';
                    $vals[] = ws_next_project_no($pdo);
                }
            }
            $ph = implode(', ', array_fill(0, count($cols), '?'));
            $st = $pdo->prepare('INSERT INTO ws_tasks (' . implode(', ', $cols) . ") VALUES ($ph)");
            $st->execute($vals);
            $newId = (int)$pdo->lastInsertId();
            if ($assigneeIds) ws_set_task_assignees($pdo, $newId, $assigneeIds);
            echo json_encode(['id' => $newId]);
            exit;
        }
        if (($method === 'PUT' || $method === 'PATCH') && $id) {
            ws_require($pdo, $meId, 'tasks.edit');
            $allowed = ['space_id','title','description','status','priority','assignee_id','due_date','sort_order'];
            if (ws_ensure_date_cols($pdo)) { $allowed[] = 'start_date'; $allowed[] = 'end_date'; }
            if (array_key_exists('parent_id', $in) && ws_ensure_parent_col($pdo)) $allowed[] = 'parent_id';
            $sets = [];
            $vals = [];
            foreach ($allowed as $f) {
                if (array_key_exists($f, $in)) {
                    $sets[] = "$f = ?";
                    $vals[] = $in[$f] === '' ? null : $in[$f];
                }
            }
            $hasAssignees = is_array($in['assignee_ids'] ?? null);
            if (!$sets && !$hasAssignees) ws_fail(422, 'nothing to update');
            if ($sets) {
                $vals[] = $id;
                $pdo->prepare('UPDATE ws_tasks SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            // A project moves as a whole. Moving only the top card left its
            // subtasks behind in the old space, split from their project.
            if (array_key_exists('space_id', $in) && (int)$in['space_id'] > 0) {
                $ids = ws_task_tree($pdo, $id);
                if (count($ids) > 1) {
                    $ph = implode(',', array_fill(0, count($ids), '?'));
                    $pdo->prepare("UPDATE ws_tasks SET space_id = ? WHERE id IN ($ph)")
                        ->execute(array_merge([(int)$in['space_id']], $ids));
                }
            }
            if ($hasAssignees) ws_set_task_assignees($pdo, $id, $in['assignee_ids']);
            echo json_encode(['success' => true]);
            exit;
        }
        if ($method === 'DELETE' && $id) {
            ws_require($pdo, $meId, 'tasks.delete');
            // Deleting a task removes every subtask below it, plus chat + assignees.
            ws_ensure_task_comments($pdo);
            ws_ensure_task_assignees($pdo);
            $ids = ws_task_tree($pdo, $id);
            foreach (array_reverse($ids) as $tid) {
                $pdo->prepare('DELETE FROM ws_task_comments WHERE task_id = ?')->execute([$tid]);
                $pdo->prepare('DELETE FROM ws_task_assignees WHERE task_id = ?')->execute([$tid]);
            }
            foreach (array_reverse($ids) as $tid) {
                $pdo->prepare('DELETE FROM ws_tasks WHERE id = ?')->execute([$tid]);
            }
            echo json_encode(['success' => true, 'deleted' => count($ids)]);
            exit;
        }
        ws_fail(405, 'method not allowed');

    }

    /* ---------------- TEAMS ---------------- */
    if ($resource === 'teams') {
        ws_ensure_teams($pdo);
        if ($method === 'GET') {
            $rows = $pdo->query('SELECT * FROM ws_teams ORDER BY name')->fetchAll();
            $mem  = $pdo->query('SELECT team_id, user_id FROM ws_team_members')->fetchAll();
            foreach ($rows as &$t) {
                $t['id'] = (int)$t['id'];
                $t['member_ids'] = [];
                foreach ($mem as $m) {
                    if ((int)$m['team_id'] === $t['id']) $t['member_ids'][] = (int)$m['user_id'];
                }
            }
            unset($t);
            echo json_encode(['teams' => $rows]);
            exit;
        }
        if ($method === 'POST') {
            ws_require($pdo, $meId, 'teams.manage');
            $name = trim($in['name'] ?? '');
            if ($name === '') ws_fail(422, 'name required');
            $st = $pdo->prepare('INSERT INTO ws_teams (name, description, color, created_by) VALUES (?, ?, ?, ?)');
            $st->execute([$name, $in['description'] ?? null, $in['color'] ?? null, $meId ?: null]);
            $tid = (int)$pdo->lastInsertId();
            $ins = $pdo->prepare('INSERT IGNORE INTO ws_team_members (team_id, user_id) VALUES (?, ?)');
            foreach (array_unique(array_map('intval', is_array($in['member_ids'] ?? null) ? $in['member_ids'] : [])) as $uid) {
                if ($uid) $ins->execute([$tid, $uid]);
            }
            echo json_encode(['id' => $tid]);
            exit;
        }
        if (($method === 'PUT' || $method === 'PATCH') && $id) {
            ws_require($pdo, $meId, 'teams.manage');
            $sets = []; $vals = [];
            foreach (['name','description','color'] as $f) {
                if (array_key_exists($f, $in)) { $sets[] = "$f = ?"; $vals[] = $in[$f] === '' ? null : $in[$f]; }
            }
            if ($sets) {
                $vals[] = $id;
                $pdo->prepare('UPDATE ws_teams SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            if (is_array($in['member_ids'] ?? null)) {
                $pdo->prepare('DELETE FROM ws_team_members WHERE team_id = ?')->execute([$id]);
                $ins = $pdo->prepare('INSERT IGNORE INTO ws_team_members (team_id, user_id) VALUES (?, ?)');
                foreach (array_unique(array_map('intval', $in['member_ids'])) as $uid) {
                    if ($uid) $ins->execute([$id, $uid]);
                }
            }
            echo json_encode(['success' => true]);
            exit;
        }
        if ($method === 'DELETE' && $id) {
            ws_require($pdo, $meId, 'teams.manage');
            $pdo->prepare('DELETE FROM ws_teams WHERE id = ?')->execute([$id]);
            $pdo->prepare('DELETE FROM ws_team_members WHERE team_id = ?')->execute([$id]);
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }


    /* ---------------- TASK CHAT ---------------- */
    if ($resource === 'task_comments') {
        ws_ensure_task_comments($pdo);
        $taskId = isset($_GET['task_id']) ? (int)$_GET['task_id'] : (int)($in['task_id'] ?? 0);
        if ($method === 'GET') {
            if (!$taskId) ws_fail(422, 'task_id required');
            $nameExpr = str_replace(' AS name', ' AS user_name', ws_user_name_expr($pdo, 'u'));
            $hasReply  = in_array('reply_to', ws_table_cols($pdo, 'ws_task_comments'), true);
            $replyExpr = str_replace(' AS name', ' AS reply_user_name', ws_user_name_expr($pdo, 'ru'));
            $replySel  = $hasReply ? ", rc.body AS reply_body, $replyExpr" : '';
            $replyJoin = $hasReply
                ? ' LEFT JOIN ws_task_comments rc ON rc.id = c.reply_to LEFT JOIN users ru ON ru.id = rc.user_id'
                : '';
            $st = $pdo->prepare(
                "SELECT c.*, $nameExpr, u.email AS user_email$replySel
                 FROM ws_task_comments c LEFT JOIN users u ON u.id = c.user_id$replyJoin
                 WHERE c.task_id = ? ORDER BY c.id ASC LIMIT 500"
            );
            $st->execute([$taskId]);
            echo json_encode(['comments' => $st->fetchAll()]);
            exit;
        }
        if ($method === 'POST') {
            $body = trim($in['body'] ?? '');
            if (!$taskId || $body === '') ws_fail(422, 'task_id and body required');
            $cols = ['task_id', 'user_id', 'body'];
            $vals = [$taskId, $meId ?: null, $body];
            if (!empty($in['reply_to']) && in_array('reply_to', ws_table_cols($pdo, 'ws_task_comments'), true)) {
                $rt = (int)$in['reply_to'];
                $p  = $pdo->prepare('SELECT task_id FROM ws_task_comments WHERE id = ?');
                $p->execute([$rt]);
                // Same rule as messages: only quote something on this task.
                if ((int)$p->fetchColumn() !== $taskId) ws_fail(422, 'reply_to is not on this task');
                $cols[] = 'reply_to';
                $vals[] = $rt;
            }
            $ph = implode(', ', array_fill(0, count($cols), '?'));
            $st = $pdo->prepare('INSERT INTO ws_task_comments (' . implode(', ', $cols) . ") VALUES ($ph)");
            $st->execute($vals);
            echo json_encode(['id' => (int)$pdo->lastInsertId()]);
            exit;
        }
        if ($method === 'DELETE' && $id) {
            // Your own comment is always yours to remove; anyone else's needs the permission.
            $st = $pdo->prepare('SELECT user_id FROM ws_task_comments WHERE id = ?');
            $st->execute([$id]);
            $owner = $st->fetchColumn();
            if ($owner !== false && (int)$owner !== $meId) {
                ws_require($pdo, $meId, 'messages.delete');
            }
            $pdo->prepare('DELETE FROM ws_task_comments WHERE id = ?')->execute([$id]);
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- DOCS (shared notes per space) ----------------
       Lists never carry the body — only a short excerpt — so opening the Docs
       pane stays cheap no matter how long the documents get. */
    if ($resource === 'docs') {
        ws_ensure_docs($pdo);
        $nameExpr = str_replace(' AS name', ' AS updated_by_name', ws_user_name_expr($pdo, 'u'));

        if ($method === 'GET') {
            if ($id) {
                $st = $pdo->prepare(
                    "SELECT d.*, s.name AS space_name, $nameExpr
                     FROM ws_docs d
                     LEFT JOIN ws_spaces s ON s.id = d.space_id
                     LEFT JOIN users u ON u.id = d.updated_by
                     WHERE d.id = ?"
                );
                $st->execute([$id]);
                $doc = $st->fetch();
                if (!$doc) ws_fail(404, 'doc not found');
                if ($doc['space_id'] !== null
                    && !in_array((int)$doc['space_id'], ws_visible_space_ids($pdo, $meId), true)) {
                    ws_fail(403, 'That document lives in a private space');
                }
                $doc['id']        = (int)$doc['id'];
                $doc['space_id']  = $doc['space_id'] === null ? null : (int)$doc['space_id'];
                $doc['is_pinned'] = (int)$doc['is_pinned'];
                echo json_encode(['doc' => $doc]);
                exit;
            }

            $spaceId = isset($_GET['space_id']) ? (int)$_GET['space_id'] : 0;
            $where   = '';
            $args    = [];
            if ($spaceId) {
                $tree  = ws_space_tree($pdo, $spaceId);
                $where = 'WHERE d.space_id IN (' . implode(',', array_fill(0, count($tree), '?')) . ')';
                $args  = $tree;
            }
            // Company-wide docs stay visible; the rest follow their space.
            $vis   = '(d.space_id IS NULL OR ' . ws_id_in(ws_visible_space_ids($pdo, $meId), 'd.space_id') . ')';
            $where = $where === '' ? "WHERE $vis" : "$where AND $vis";
            $st = $pdo->prepare(
                "SELECT d.id, d.space_id, d.title, d.is_pinned, d.created_by, d.updated_by,
                        d.created_at, d.updated_at,
                        LEFT(COALESCE(d.body, ''), 240) AS excerpt,
                        s.name AS space_name, $nameExpr
                 FROM ws_docs d
                 LEFT JOIN ws_spaces s ON s.id = d.space_id
                 LEFT JOIN users u ON u.id = d.updated_by
                 $where
                 ORDER BY d.is_pinned DESC, d.updated_at DESC
                 LIMIT 500"
            );
            $st->execute($args);
            $docs = $st->fetchAll();
            foreach ($docs as &$d) {
                $d['id']        = (int)$d['id'];
                $d['space_id']  = $d['space_id'] === null ? null : (int)$d['space_id'];
                $d['is_pinned'] = (int)$d['is_pinned'];
            }
            unset($d);
            echo json_encode(['docs' => $docs]);
            exit;
        }

        if ($method === 'POST') {
            ws_require($pdo, $meId, 'docs.create');
            $title = trim($in['title'] ?? '');
            if ($title === '') ws_fail(422, 'title required');
            $st = $pdo->prepare(
                'INSERT INTO ws_docs (space_id, title, body, is_pinned, created_by, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $st->execute([
                !empty($in['space_id']) ? (int)$in['space_id'] : null,
                $title,
                $in['body'] ?? null,
                !empty($in['is_pinned']) ? 1 : 0,
                $meId ?: null,
                $meId ?: null,
            ]);
            echo json_encode(['id' => (int)$pdo->lastInsertId()]);
            exit;
        }

        if (($method === 'PUT' || $method === 'PATCH') && $id) {
            ws_require($pdo, $meId, 'docs.edit');
            $sets = []; $vals = [];
            if (array_key_exists('title', $in)) {
                $title = trim((string)$in['title']);
                if ($title === '') ws_fail(422, 'title cannot be empty');
                $sets[] = 'title = ?'; $vals[] = $title;
            }
            if (array_key_exists('body', $in))      { $sets[] = 'body = ?';      $vals[] = (string)$in['body']; }
            if (array_key_exists('space_id', $in))  { $sets[] = 'space_id = ?';  $vals[] = empty($in['space_id']) ? null : (int)$in['space_id']; }
            if (array_key_exists('is_pinned', $in)) { $sets[] = 'is_pinned = ?'; $vals[] = empty($in['is_pinned']) ? 0 : 1; }
            if (!$sets) ws_fail(422, 'nothing to update');
            $sets[] = 'updated_by = ?'; $vals[] = $meId ?: null;
            $vals[] = $id;
            $pdo->prepare('UPDATE ws_docs SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            echo json_encode(['success' => true]);
            exit;
        }

        if ($method === 'DELETE' && $id) {
            ws_require($pdo, $meId, 'docs.delete');
            $pdo->prepare('DELETE FROM ws_docs WHERE id = ?')->execute([$id]);
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- SYNCED READ STATE ---------------- */
    if ($resource === 'read_state') {
        if (!$meId) ws_fail(401, 'authenticated user required');
        ws_ensure_productivity_tables($pdo);
        if ($method === 'GET') {
            $st = $pdo->prepare('SELECT scope, scope_id, seen_at FROM ws_read_state WHERE user_id = ?');
            $st->execute([$meId]);
            $states = $st->fetchAll();
            // First rollout: establish a current baseline instead of surfacing the entire message history.
            if (!$states) {
                $now = date('Y-m-d H:i:s');
                $seed = $pdo->prepare('INSERT IGNORE INTO ws_read_state (user_id, scope, scope_id, seen_at) VALUES (?, ?, ?, ?)');
                foreach (['inbox', 'mentions'] as $scope) $seed->execute([$meId, $scope, 0, $now]);
                foreach ($pdo->query('SELECT id FROM ws_channels')->fetchAll() as $channel) {
                    $seed->execute([$meId, 'channel', (int)$channel['id'], $now]);
                }
                $dm = $pdo->prepare('SELECT DISTINCT IF(sender_id = ?, recipient_id, sender_id) AS other_id FROM ws_messages WHERE sender_id = ? OR recipient_id = ?');
                $dm->execute([$meId, $meId, $meId]);
                foreach ($dm->fetchAll() as $row) {
                    if ((int)$row['other_id']) $seed->execute([$meId, 'dm', (int)$row['other_id'], $now]);
                }
                $st->execute([$meId]);
                $states = $st->fetchAll();
            }
            echo json_encode(['states' => $states]);
            exit;
        }
        if ($method === 'PUT' || $method === 'PATCH') {
            $scope = (string)($in['scope'] ?? '');
            $scopeId = (int)($in['scope_id'] ?? 0);
            $allowed = ['channel', 'dm', 'inbox', 'mentions'];
            if (!in_array($scope, $allowed, true)) ws_fail(422, 'invalid scope');
            $seenAt = !empty($in['seen_at']) ? date('Y-m-d H:i:s', strtotime($in['seen_at'])) : date('Y-m-d H:i:s');
            $st = $pdo->prepare(
                'INSERT INTO ws_read_state (user_id, scope, scope_id, seen_at) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE seen_at = GREATEST(seen_at, VALUES(seen_at))'
            );
            $st->execute([$meId, $scope, $scopeId, $seenAt]);
            echo json_encode(['success' => true]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- TIME TRACKING ---------------- */
    if ($resource === 'time_entries') {
        if (!$meId) ws_fail(401, 'authenticated user required');
        ws_ensure_productivity_tables($pdo);
        $taskId = isset($_GET['task_id']) ? (int)$_GET['task_id'] : 0;
        if ($method === 'GET') {
            $nameExpr = str_replace(' AS name', ' AS user_name', ws_user_name_expr($pdo, 'u'));
            // Asking about a task means asking about its whole subtree: a parent's
            // total has to include every subtask, at any depth.
            $treeIds = [];
            if ($taskId) {
                $treeIds = ws_task_tree($pdo, $taskId);
                $where = 'e.task_id IN (' . implode(',', array_fill(0, count($treeIds), '?')) . ')';
                $args  = $treeIds;
            } else {
                $where = 'e.user_id = ?';
                $args  = [$meId];
            }
            $st = $pdo->prepare(
                "SELECT e.*, t.title AS task_title, pt.title AS parent_title, s.name AS space_name,
                        $nameExpr, u.email AS user_email
                 FROM ws_time_entries e
                 JOIN ws_tasks t ON t.id = e.task_id
                 LEFT JOIN ws_tasks pt ON pt.id = t.parent_id
                 LEFT JOIN ws_spaces s ON s.id = t.space_id
                 LEFT JOIN users u ON u.id = e.user_id
                 WHERE $where ORDER BY e.started_at DESC LIMIT 300"
            );
            $st->execute($args);
            $entries = $st->fetchAll();
            $total = 0; $own = 0; $running = null;
            foreach ($entries as &$entry) {
                $entry['id'] = (int)$entry['id'];
                $entry['task_id'] = (int)$entry['task_id'];
                $entry['user_id'] = (int)$entry['user_id'];
                $entry['duration_seconds'] = (int)$entry['duration_seconds'];
                // DATETIME columns carry no zone, so a browser parses them as ITS
                // local time and a running timer is born hours old. Ship absolute
                // ISO-8601 alongside, and let the server own the elapsed count.
                $entry['started_at_iso'] = date('c', strtotime($entry['started_at']));
                $entry['ended_at_iso']   = $entry['ended_at'] ? date('c', strtotime($entry['ended_at'])) : null;
                if ($entry['ended_at'] === null && (int)$entry['user_id'] === $meId) {
                    $entry['elapsed_seconds'] = max(0, time() - strtotime($entry['started_at']));
                    $running = $entry;
                }
                if ($entry['ended_at'] !== null) {
                    $total += (int)$entry['duration_seconds'];
                    if ($taskId && (int)$entry['task_id'] === $taskId) $own += (int)$entry['duration_seconds'];
                }
            }
            unset($entry);
            echo json_encode([
                'entries'       => $entries,
                'running'       => $running,
                'total_seconds' => $total,        // whole subtree when task_id is given
                'own_seconds'   => $taskId ? $own : $total,
                'subtask_count' => $taskId ? max(0, count($treeIds) - 1) : 0,
                'server_now'    => date('c'),
            ]);
            exit;
        }
        if ($method === 'POST') {
            $action = $in['action'] ?? 'start';
            $tid = (int)($in['task_id'] ?? 0);
            if (!$tid) ws_fail(422, 'task_id required');
            if ($action === 'start') {
                $check = $pdo->prepare('SELECT id FROM ws_time_entries WHERE user_id = ? AND ended_at IS NULL LIMIT 1');
                $check->execute([$meId]);
                if ($check->fetchColumn()) ws_fail(409, 'Stop the active timer before starting another');
                $started = !empty($in['started_at']) ? date('Y-m-d H:i:s', strtotime($in['started_at'])) : date('Y-m-d H:i:s');
                $st = $pdo->prepare('INSERT INTO ws_time_entries (task_id, user_id, started_at, notes) VALUES (?, ?, ?, ?)');
                $st->execute([$tid, $meId, $started, $in['notes'] ?? null]);
            } elseif ($action === 'manual') {
                $duration = max(1, (int)($in['duration_seconds'] ?? 0));
                $started = date('Y-m-d H:i:s', strtotime($in['started_at'] ?? 'now'));
                $ended = !empty($in['ended_at'])
                    ? date('Y-m-d H:i:s', strtotime($in['ended_at']))
                    : date('Y-m-d H:i:s', strtotime("+$duration seconds", strtotime($started)));
                $st = $pdo->prepare('INSERT INTO ws_time_entries (task_id, user_id, started_at, ended_at, duration_seconds, notes) VALUES (?, ?, ?, ?, ?, ?)');
                $st->execute([$tid, $meId, $started, $ended, $duration, $in['notes'] ?? null]);
            } else ws_fail(422, 'invalid action');
            echo json_encode(['id' => (int)$pdo->lastInsertId()]);
            exit;
        }
        if (($method === 'PUT' || $method === 'PATCH') && $id) {
            $owner = $pdo->prepare('SELECT * FROM ws_time_entries WHERE id = ? AND user_id = ?');
            $owner->execute([$id, $meId]);
            $entry = $owner->fetch();
            if (!$entry) ws_fail(404, 'time entry not found');
            if (($in['action'] ?? '') === 'stop') {
                if ($entry['ended_at'] !== null) ws_fail(409, 'timer already stopped');
                $seconds = max(1, time() - strtotime($entry['started_at']));
                // started_at is written with PHP's clock, so ended_at must be too.
                // MySQL's NOW() can sit in a different timezone, which left rows
                // reading like "18:49-22:49" for a four-second entry.
                $pdo->prepare('UPDATE ws_time_entries SET ended_at = ?, duration_seconds = ? WHERE id = ?')
                    ->execute([date('Y-m-d H:i:s'), $seconds, $id]);
            } else {
                $sets = []; $vals = [];
                foreach (['task_id','started_at','ended_at','duration_seconds','notes'] as $field) {
                    if (array_key_exists($field, $in)) { $sets[] = "$field = ?"; $vals[] = $in[$field] === '' ? null : $in[$field]; }
                }
                if (!$sets) ws_fail(422, 'nothing to update');
                $vals[] = $id;
                $pdo->prepare('UPDATE ws_time_entries SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
            }
            echo json_encode(['success' => true]);
            exit;
        }
        if ($method === 'DELETE' && $id) {
            $st = $pdo->prepare('DELETE FROM ws_time_entries WHERE id = ? AND user_id = ?');
            $st->execute([$id, $meId]);
            echo json_encode(['success' => $st->rowCount() > 0]);
            exit;
        }
        ws_fail(405, 'method not allowed');
    }

    /* ---------------- ACTIVITY (inbox feed) ----------------
       Recent task chat + channel/DM traffic, enriched so the client can decide
       what belongs in someone's inbox (assigned tasks, @mentions, replies). */
    if ($resource === 'activity') {
        if ($method !== 'GET') ws_fail(405, 'method not allowed');
        ws_ensure_task_comments($pdo);
        ws_ensure_task_assignees($pdo);
        $hasParent = ws_ensure_parent_col($pdo);

        // The feed must not become a side door into private spaces and channels,
        // so both halves are filtered here rather than in the client.
        $visibleSpaces   = ws_visible_space_ids($pdo, $meId);
        $visibleChannels = ws_visible_channel_ids($pdo, $meId);

        $cName = str_replace(' AS name', ' AS user_name', ws_user_name_expr($pdo, 'u'));
        // Who wrote the message this one answers, so the Replies pane can mean
        // "someone replied to you" instead of guessing from shared threads.
        $cHasReply = in_array('reply_to', ws_table_cols($pdo, 'ws_task_comments'), true);
        $cReplySel = $cHasReply ? ', rc.user_id AS reply_to_user_id' : ', NULL AS reply_to_user_id';
        $cReplyJoin = $cHasReply ? ' LEFT JOIN ws_task_comments rc ON rc.id = c.reply_to' : '';
        $comments = $pdo->query(
            "SELECT c.id, c.task_id, c.user_id, c.body, c.created_at,
                    t.title AS task_title, t.status AS task_status,
                    " . ($hasParent ? 't.parent_id' : 'NULL AS parent_id') . ",
                    $cName, u.email AS user_email$cReplySel
             FROM ws_task_comments c
             LEFT JOIN ws_tasks t ON t.id = c.task_id
             LEFT JOIN users u ON u.id = c.user_id$cReplyJoin
             WHERE t.space_id IS NULL OR " . ws_id_in($visibleSpaces, 't.space_id') . "
             ORDER BY c.id DESC LIMIT 80"
        )->fetchAll();

        $assignees = [];
        foreach ($pdo->query('SELECT task_id, user_id FROM ws_task_assignees')->fetchAll() as $a) {
            $assignees[(int)$a['task_id']][] = (int)$a['user_id'];
        }
        foreach ($comments as &$c) {
            $c['id']            = (int)$c['id'];
            $c['task_id']       = (int)$c['task_id'];
            $c['user_id']       = $c['user_id'] === null ? null : (int)$c['user_id'];
            $c['parent_id']     = $c['parent_id'] === null ? null : (int)$c['parent_id'];
            $c['assignee_ids']  = $assignees[(int)$c['task_id']] ?? [];
            $c['reply_to_user_id'] = isset($c['reply_to_user_id']) && $c['reply_to_user_id'] !== null
                ? (int)$c['reply_to_user_id'] : null;
        }
        unset($c);

        $sName = str_replace(' AS name', ' AS sender_name', ws_user_name_expr($pdo, 'u'));
        $meSql = (int)$meId;
        $mHasReply  = in_array('reply_to', ws_table_cols($pdo, 'ws_messages'), true);
        $mReplySel  = $mHasReply ? ', rm.sender_id AS reply_to_user_id' : ', NULL AS reply_to_user_id';
        $mReplyJoin = $mHasReply ? ' LEFT JOIN ws_messages rm ON rm.id = m.reply_to' : '';
        $messages = $pdo->query(
            "SELECT m.id, m.channel_id, m.sender_id, m.recipient_id, m.body, m.created_at,
                    ch.name AS channel_name, $sName, u.email AS sender_email$mReplySel
             FROM ws_messages m
             LEFT JOIN ws_channels ch ON ch.id = m.channel_id
             LEFT JOIN users u ON u.id = m.sender_id$mReplyJoin
             WHERE (m.channel_id IS NOT NULL AND " . ws_id_in($visibleChannels, 'm.channel_id') . ")
                OR (m.channel_id IS NULL AND (m.sender_id = $meSql OR m.recipient_id = $meSql))
             ORDER BY m.id DESC LIMIT 80"
        )->fetchAll();
        foreach ($messages as &$m) {
            $m['id']           = (int)$m['id'];
            $m['channel_id']   = $m['channel_id'] === null ? null : (int)$m['channel_id'];
            $m['sender_id']    = (int)$m['sender_id'];
            $m['recipient_id'] = $m['recipient_id'] === null ? null : (int)$m['recipient_id'];
            $m['reply_to_user_id'] = isset($m['reply_to_user_id']) && $m['reply_to_user_id'] !== null
                ? (int)$m['reply_to_user_id'] : null;
        }
        unset($m);

        echo json_encode(['comments' => $comments, 'messages' => $messages]);
        exit;
    }

    ws_fail(400, 'unknown resource');

} catch (Throwable $e) {
    error_log((string)$e);
    ws_fail(500, 'Internal server error');
}
