<?php
// Roles, permissions and per-object privacy for the workspace module.
//
// Included by workspace.php. Every table and column here is self-migrating in
// the same style as the ws_ensure_* helpers, so the endpoint keeps working on a
// database that has not run backend/roles_privacy_migration.sql by hand.
//
// Model
//   - One role per user, stored as a slug in users.role.
//   - A role owns a rank (lower = more powerful) and a JSON list of permissions.
//   - '*' means every permission and is reserved for the OP role.
//   - Privacy is a per-object flag plus rows in ws_acl naming the users and
//     teams that may see it. Private with no rows = only those who bypass it.

/** Every permission the UI can tick. Unknown keys sent by a client are dropped. */
const WS_PERMISSIONS = [
    'channels.create', 'channels.edit', 'channels.delete',
    'spaces.create', 'spaces.edit', 'spaces.delete',
    'subsidiaries.edit',
    'docs.create', 'docs.edit', 'docs.delete',
    'tasks.create', 'tasks.edit', 'tasks.delete',
    'messages.delete',
    'teams.manage',
    'users.create', 'users.edit', 'users.delete',
    'roles.manage',
    'privacy.bypass',
];

/** Objects that can be made private. */
const WS_ACL_SCOPES = ['channel', 'space', 'subsidiary'];

function ws_perm_fail(int $code, string $msg) {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

/* ================= Schema ================= */

/** ws_roles + a widened users.role column, seeded with OP / Admin / Member. */
function ws_ensure_roles(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_roles (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            slug        VARCHAR(40) NOT NULL UNIQUE,
            name        VARCHAR(60) NOT NULL,
            `rank`      INT NOT NULL DEFAULT 100,
            color       VARCHAR(9) NULL,
            permissions TEXT NULL,
            is_system   TINYINT(1) NOT NULL DEFAULT 0,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ws_roles_rank (`rank`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    // users.role ships as ENUM('superadmin','admin','staff'), which cannot hold
    // a custom slug. Widen it once, then map the old values onto the new roles.
    $type = '';
    try {
        $st = $pdo->prepare(
            'SELECT COLUMN_TYPE FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $st->execute(['users', 'role']);
        $type = strtolower((string)$st->fetchColumn());
    } catch (Throwable $e) { /* fall through and treat as missing */ }

    if ($type === '') {
        try { $pdo->exec("ALTER TABLE users ADD COLUMN role VARCHAR(40) NOT NULL DEFAULT 'member'"); }
        catch (Throwable $e) { /* another request won the race */ }
    } elseif (strpos($type, 'enum') === 0) {
        try {
            $pdo->exec("ALTER TABLE users MODIFY role VARCHAR(40) NOT NULL DEFAULT 'member'");
            $pdo->exec("UPDATE users SET role = 'op'     WHERE role = 'superadmin'");
            $pdo->exec("UPDATE users SET role = 'member' WHERE role = 'staff'");
        } catch (Throwable $e) { /* leave the column as it is */ }
    }

    $seed = $pdo->prepare(
        'INSERT IGNORE INTO ws_roles (slug, name, `rank`, color, permissions, is_system)
         VALUES (?, ?, ?, ?, ?, 1)'
    );
    $seed->execute(['op', 'OP', 0, '#ff6b6b', json_encode(['*'])]);
    $seed->execute(['admin', 'Admin', 10, '#4ea1ff', json_encode(WS_PERMISSIONS)]);
    $seed->execute(['member', 'Member', 100, '#8a8f98', json_encode([
        'tasks.create', 'tasks.edit', 'docs.create', 'docs.edit',
    ])]);

    // Anyone holding a slug that no longer exists falls back to Member.
    try {
        $known = $pdo->query('SELECT slug FROM ws_roles')->fetchAll(PDO::FETCH_COLUMN);
        if ($known) {
            $ph = implode(',', array_fill(0, count($known), '?'));
            $st = $pdo->prepare(
                "UPDATE users SET role = 'member'
                  WHERE role IS NULL OR role = '' OR role NOT IN ($ph)"
            );
            $st->execute($known);
        }
    } catch (Throwable $e) { /* non-fatal */ }

    // Never leave the workspace without an OP — the lowest id inherits it.
    try {
        if ((int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'op'")->fetchColumn() === 0) {
            $pdo->exec("UPDATE users SET role = 'op' ORDER BY id ASC LIMIT 1");
        }
    } catch (Throwable $e) { /* empty users table */ }
}

/** ws_acl + the is_private flags that go with it. */
function ws_ensure_acl(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;

    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_acl (
            scope          VARCHAR(16) NOT NULL,
            scope_key      VARCHAR(64) NOT NULL,
            principal_type VARCHAR(8)  NOT NULL,
            principal_id   INT NOT NULL,
            PRIMARY KEY (scope, scope_key, principal_type, principal_id),
            INDEX idx_ws_acl_principal (principal_type, principal_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );

    foreach (['ws_spaces', 'ws_subsidiaries'] as $table) {
        try {
            $st = $pdo->prepare(
                'SELECT COUNT(*) FROM information_schema.COLUMNS
                  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
            );
            $st->execute([$table, 'is_private']);
            if ((int)$st->fetchColumn() === 0) {
                $pdo->exec("ALTER TABLE `$table` ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0");
            }
        } catch (Throwable $e) { /* table not created yet */ }
    }

    // Existing private-channel members become ACL rows so nobody loses access
    // the moment privacy starts being enforced.
    try {
        $pdo->exec(
            "INSERT IGNORE INTO ws_acl (scope, scope_key, principal_type, principal_id)
             SELECT 'channel', channel_id, 'user', user_id FROM ws_channel_members"
        );
    } catch (Throwable $e) { /* no ws_channel_members on a fresh install */ }
}

/** users.avatar_url, so people can put a face on their account. */
function ws_ensure_profile(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?'
        );
        $st->execute(['users', 'avatar_url']);
        if ((int)$st->fetchColumn() === 0) {
            $pdo->exec('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255) NULL');
        }
    } catch (Throwable $e) { /* non-fatal — the UI falls back to initials */ }
}

/**
 * bcrypt check that also accepts the $2b$ hashes bcryptjs writes. PHP's own
 * hashes carry $2y$; the two are the same algorithm with a different label, so
 * relabelling before the compare is safe and keeps existing logins working.
 */
function ws_password_matches(string $plain, string $hash): bool {
    if ($plain === '' || $hash === '') return false;
    if (password_verify($plain, $hash)) return true;
    if (strncmp($hash, '$2b$', 4) === 0) {
        return password_verify($plain, '$2y$' . substr($hash, 4));
    }
    return false;
}

/** The column holding the password hash, whatever this install calls it. */
function ws_password_col(PDO $pdo): ?string {
    static $col = false;
    if ($col !== false) return $col;
    $col = null;
    try {
        foreach ($pdo->query('SHOW COLUMNS FROM users')->fetchAll() as $r) {
            $name = strtolower($r['Field'] ?? $r[0] ?? '');
            if ($name === 'password_hash') { $col = 'password_hash'; return $col; }
            if ($name === 'password') $col = 'password';
        }
    } catch (Throwable $e) { /* leave it null */ }
    return $col;
}

/** The column holding the display name, whatever this install calls it. */
function ws_display_name_col(PDO $pdo): ?string {
    static $col = false;
    if ($col !== false) return $col;
    $col = null;
    try {
        $have = [];
        foreach ($pdo->query('SHOW COLUMNS FROM users')->fetchAll() as $r) {
            $have[] = strtolower($r['Field'] ?? $r[0] ?? '');
        }
        foreach (['full_name', 'name', 'display_name', 'username'] as $c) {
            if (in_array($c, $have, true)) { $col = $c; return $col; }
        }
    } catch (Throwable $e) { /* leave it null */ }
    return $col;
}

/* ================= Who am I ================= */

/**
 * The caller's profile and role, with permissions decoded. Never null.
 * Cached per request; pass $fresh after a profile write so the response does
 * not answer with the values from before the edit.
 */
function ws_me(PDO $pdo, int $meId, bool $fresh = false): array {
    static $cache = null;
    if ($cache !== null && !$fresh) return $cache;
    ws_ensure_roles($pdo);
    ws_ensure_profile($pdo);

    $slug = 'member';
    $row  = null;
    if ($meId > 0) {
        $st = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$meId]);
        $row = $st->fetch() ?: null;
        if ($row) $slug = (string)($row['role'] ?? 'member');
        if ($slug === '') $slug = 'member';
    }

    $st = $pdo->prepare('SELECT * FROM ws_roles WHERE slug = ?');
    $st->execute([$slug]);
    $role = $st->fetch();
    if (!$role) {
        $st->execute(['member']);
        $role = $st->fetch() ?: ['slug' => 'member', 'name' => 'Member', 'rank' => 100, 'permissions' => '[]'];
    }

    $perms   = json_decode((string)($role['permissions'] ?? '[]'), true);
    $nameCol = ws_display_name_col($pdo);
    $cache = [
        'id'          => $meId,
        'email'       => (string)($row['email'] ?? ''),
        'name'        => (string)(($nameCol && isset($row[$nameCol])) ? $row[$nameCol] : ($row['email'] ?? '')),
        'avatar_url'  => isset($row['avatar_url']) && $row['avatar_url'] !== '' ? (string)$row['avatar_url'] : null,
        'role'        => (string)$role['slug'],
        'role_name'   => (string)$role['name'],
        'rank'        => (int)$role['rank'],
        'permissions' => is_array($perms) ? array_values($perms) : [],
    ];
    return $cache;
}


function ws_can(PDO $pdo, int $meId, string $perm): bool {
    $me = ws_me($pdo, $meId);
    return in_array('*', $me['permissions'], true) || in_array($perm, $me['permissions'], true);
}

function ws_require(PDO $pdo, int $meId, string $perm): void {
    if (!ws_can($pdo, $meId, $perm)) {
        ws_perm_fail(403, "Your role does not allow this ($perm)");
    }
}

/** Team ids the caller belongs to. */
function ws_my_teams(PDO $pdo, int $meId): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = [];
    if ($meId > 0) {
        try {
            $st = $pdo->prepare('SELECT team_id FROM ws_team_members WHERE user_id = ?');
            $st->execute([$meId]);
            $cache = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
        } catch (Throwable $e) { /* no teams table yet */ }
    }
    return $cache;
}

/* ================= Privacy ================= */

/** Whole ACL table, grouped as [scope][scope_key][principal_type] => ids. */
function ws_acl_map(PDO $pdo): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    ws_ensure_acl($pdo);
    $cache = [];
    foreach ($pdo->query('SELECT * FROM ws_acl')->fetchAll() as $r) {
        $cache[(string)$r['scope']][(string)$r['scope_key']][(string)$r['principal_type']][] = (int)$r['principal_id'];
    }
    return $cache;
}

/** Users and teams explicitly granted access to one object. */
function ws_acl_for(PDO $pdo, string $scope, $key): array {
    $map = ws_acl_map($pdo);
    return [
        'user_ids' => $map[$scope][(string)$key]['user'] ?? [],
        'team_ids' => $map[$scope][(string)$key]['team'] ?? [],
    ];
}

/**
 * Can the caller see this object?
 * Public objects are open to everyone; private ones need an ACL row, ownership,
 * or the privacy.bypass permission.
 */
function ws_acl_allows(PDO $pdo, int $meId, string $scope, $key, bool $isPrivate, $createdBy = null): bool {
    if (!$isPrivate) return true;
    if ($meId > 0 && $createdBy !== null && (int)$createdBy === $meId) return true;
    if (ws_can($pdo, $meId, 'privacy.bypass')) return true;
    if ($meId <= 0) return false;

    $acl = ws_acl_for($pdo, $scope, $key);
    if (in_array($meId, $acl['user_ids'], true)) return true;
    return (bool)array_intersect($acl['team_ids'], ws_my_teams($pdo, $meId));
}

/** Replace the ACL rows of one object. Passing null for a list leaves it alone. */
function ws_acl_save(PDO $pdo, string $scope, $key, ?array $userIds, ?array $teamIds): void {
    if (!in_array($scope, WS_ACL_SCOPES, true)) return;
    if ($userIds === null && $teamIds === null) return;
    ws_ensure_acl($pdo);
    $key = (string)$key;

    $ins = $pdo->prepare(
        'INSERT IGNORE INTO ws_acl (scope, scope_key, principal_type, principal_id) VALUES (?, ?, ?, ?)'
    );
    $del = $pdo->prepare('DELETE FROM ws_acl WHERE scope = ? AND scope_key = ? AND principal_type = ?');

    foreach ([['user', $userIds], ['team', $teamIds]] as $pair) {
        list($type, $ids) = $pair;
        if ($ids === null) continue;
        $del->execute([$scope, $key, $type]);
        foreach (array_unique(array_map('intval', $ids)) as $pid) {
            if ($pid > 0) $ins->execute([$scope, $key, $type, $pid]);
        }
    }

    // ws_channel_members is kept in step so older code paths still work.
    if ($scope === 'channel' && $userIds !== null) {
        try {
            $pdo->prepare('DELETE FROM ws_channel_members WHERE channel_id = ?')->execute([(int)$key]);
            $cm = $pdo->prepare('INSERT IGNORE INTO ws_channel_members (channel_id, user_id) VALUES (?, ?)');
            foreach (array_unique(array_map('intval', $userIds)) as $uid) {
                if ($uid > 0) $cm->execute([(int)$key, $uid]);
            }
        } catch (Throwable $e) { /* table dropped — the ACL is the source of truth */ }
    }
}

function ws_acl_clear(PDO $pdo, string $scope, $key): void {
    try {
        $pdo->prepare('DELETE FROM ws_acl WHERE scope = ? AND scope_key = ?')->execute([$scope, (string)$key]);
    } catch (Throwable $e) { /* nothing to clear */ }
}

/** Channel ids the caller may read. */
function ws_visible_channel_ids(PDO $pdo, int $meId): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = [];
    foreach ($pdo->query('SELECT id, is_private, created_by FROM ws_channels')->fetchAll() as $c) {
        if (ws_acl_allows($pdo, $meId, 'channel', (int)$c['id'], (int)$c['is_private'] === 1, $c['created_by'])) {
            $cache[] = (int)$c['id'];
        }
    }
    return $cache;
}

/**
 * Space ids the caller may read. A private space hides its whole subtree, so a
 * child is only visible when every ancestor above it is visible too.
 */
function ws_visible_space_ids(PDO $pdo, int $meId): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    ws_ensure_acl($pdo);

    try {
        $rows = $pdo->query('SELECT id, parent_id, is_private, created_by FROM ws_spaces')->fetchAll();
    } catch (Throwable $e) {
        $rows = $pdo->query('SELECT id, parent_id, created_by FROM ws_spaces')->fetchAll();
    }

    $byId = [];
    foreach ($rows as $r) $byId[(int)$r['id']] = $r;

    $cache = [];
    foreach ($rows as $r) {
        $ok   = true;
        $node = $r;
        $seen = [];
        while ($node) {
            $nid = (int)$node['id'];
            if (isset($seen[$nid])) break;              // cycle guard
            $seen[$nid] = true;
            $private = isset($node['is_private']) && (int)$node['is_private'] === 1;
            if (!ws_acl_allows($pdo, $meId, 'space', $nid, $private, $node['created_by'] ?? null)) {
                $ok = false;
                break;
            }
            $pid  = $node['parent_id'] === null ? 0 : (int)$node['parent_id'];
            $node = $pid && isset($byId[$pid]) ? $byId[$pid] : null;
        }
        if ($ok) $cache[] = (int)$r['id'];
    }
    return $cache;
}

/** SQL fragment matching a list of ids, or a never-true clause when it is empty. */
function ws_id_in(array $ids, string $col): string {
    $ids = array_values(array_unique(array_map('intval', $ids)));
    return $ids ? "$col IN (" . implode(',', $ids) . ")" : '1 = 0';
}

/** Guard: may the caller put somebody into this role? */
function ws_require_can_assign(PDO $pdo, int $meId, string $slug): void {
    ws_ensure_roles($pdo);
    $me = ws_me($pdo, $meId);
    $st = $pdo->prepare('SELECT * FROM ws_roles WHERE slug = ?');
    $st->execute([$slug]);
    $role = $st->fetch();
    if (!$role) ws_perm_fail(422, "unknown role: $slug");
    if (in_array('*', $me['permissions'], true)) return;      // OP may appoint anyone

    $perms = json_decode((string)$role['permissions'], true);
    if (is_array($perms) && in_array('*', $perms, true)) {
        ws_perm_fail(403, 'Only an OP can appoint another OP');
    }
    // Equal rank is allowed, so an admin can appoint a second admin.
    if ((int)$role['rank'] < $me['rank']) {
        ws_perm_fail(403, 'You cannot grant a role above your own');
    }
}

/** Guard: never leave the workspace without an OP. */
function ws_guard_last_op(PDO $pdo, int $userId): void {
    $st = $pdo->prepare('SELECT role FROM users WHERE id = ?');
    $st->execute([$userId]);
    if ((string)$st->fetchColumn() !== 'op') return;
    if ((int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'op'")->fetchColumn() <= 1) {
        ws_perm_fail(409, 'This is the last OP — appoint another one first');
    }
}

/** A url-safe, unique slug for a new role. */
function ws_role_slug(PDO $pdo, string $seed): string {
    $base = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', $seed), '-'));
    if ($base === '') $base = 'role';
    $base = substr($base, 0, 36);
    $slug = $base;
    $st   = $pdo->prepare('SELECT COUNT(*) FROM ws_roles WHERE slug = ?');
    for ($n = 2; $n < 100; $n++) {
        $st->execute([$slug]);
        if ((int)$st->fetchColumn() === 0) return $slug;
        $slug = "$base-$n";
    }
    return $base . '-' . substr(uniqid(), -4);
}

/** Keep only the permission keys this build knows about. */
function ws_clean_permissions(array $perms): array {
    if (in_array('*', $perms, true)) return ['*'];
    return array_values(array_intersect(WS_PERMISSIONS, array_map('strval', $perms)));
}
