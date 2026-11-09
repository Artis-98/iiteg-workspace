<?php
/** All descendant space ids, including the given one. */
function ws_space_tree(PDO $pdo, int $rootId): array {
    $rows = $pdo->query('SELECT id, parent_id FROM ws_spaces')->fetchAll();
    $ids  = [$rootId];
    $queue = [$rootId];
    while ($queue) {
        $cur = array_pop($queue);
        foreach ($rows as $r) {
            if ((int)$r['parent_id'] === $cur) {
                $ids[]   = (int)$r['id'];
                $queue[] = (int)$r['id'];
            }
        }
    }
    return array_values(array_unique($ids));
}

/** Column names of any table (lowercased). */
function ws_table_cols(PDO $pdo, string $table): array {
    static $cache = [];
    if (isset($cache[$table])) return $cache[$table];
    $cols = [];
    foreach ($pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll() as $r) {
        $cols[] = strtolower($r['Field'] ?? $r[0] ?? '');
    }
    $cache[$table] = $cols;
    return $cols;
}

/** Make sure ws_tasks has start_date / end_date columns (self-migrating). */
function ws_ensure_date_cols(PDO $pdo): bool {
    static $ok = null;
    if ($ok !== null) return $ok;
    $cols = ws_table_cols($pdo, 'ws_tasks');
    $ok = true;
    foreach (['start_date', 'end_date'] as $c) {
        if (in_array($c, $cols, true)) continue;
        try { $pdo->exec("ALTER TABLE ws_tasks ADD COLUMN `$c` DATE NULL"); }
        catch (Throwable $e) { $ok = false; }
    }
    return $ok;
}

/** Make sure the teams tables exist (self-migrating). */
function ws_ensure_teams(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_teams (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            description VARCHAR(255) NULL,
            color VARCHAR(9) NULL,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_team_members (
            team_id INT NOT NULL,
            user_id INT NOT NULL,
            PRIMARY KEY (team_id, user_id),
            FOREIGN KEY (team_id) REFERENCES ws_teams(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

/** Make sure ws_tasks has parent_id (subtasks) — self-migrating. */
function ws_ensure_parent_col(PDO $pdo): bool {
    static $ok = null;
    if ($ok !== null) return $ok;
    if (in_array('parent_id', ws_table_cols($pdo, 'ws_tasks'), true)) { $ok = true; return $ok; }
    try {
        $pdo->exec('ALTER TABLE ws_tasks ADD COLUMN parent_id INT NULL, ADD INDEX idx_ws_task_parent (parent_id)');
        $ok = true;
    } catch (Throwable $e) { $ok = false; }
    return $ok;
}

/* ================= PROJECT NUMBERING =================
   A top-level task is a project and carries YY-NNN, e.g. 26-005. Everything
   beneath it is a component of that project and carries a two-digit item
   index in creation order, starting at 00 — tires 00, steering wheel 01,
   dash 02. A document number is then the project, the category digit and the
   item: production drawings for the steering wheel are 26-005-101, its
   presentation 26-005-201. The category digit is chosen per document, so it
   is never stored on the task. */

function ws_ensure_numbering(PDO $pdo): bool {
    static $ok = null;
    if ($ok !== null) return $ok;
    $cols = ws_table_cols($pdo, 'ws_tasks');
    try {
        if (!in_array('project_no', $cols, true)) {
            $pdo->exec('ALTER TABLE ws_tasks ADD COLUMN project_no VARCHAR(16) NULL,
                        ADD INDEX idx_ws_task_project_no (project_no)');
        }
        if (!in_array('item_no', $cols, true)) {
            $pdo->exec('ALTER TABLE ws_tasks ADD COLUMN item_no SMALLINT NULL');
        }
        $ok = true;
    } catch (Throwable $e) { $ok = false; }
    return $ok;
}

/** Numbering settings: the year in play, the next project number, category labels. */
function ws_numbering_settings(PDO $pdo): array {
    ws_ensure_settings($pdo);
    $st = $pdo->prepare("SELECT data FROM ws_settings WHERE scope = 'numbering'");
    $st->execute();
    $raw = $st->fetchColumn();
    $cfg = $raw ? (json_decode((string)$raw, true) ?: []) : [];
    $year = (int)($cfg['year'] ?? (int)date('y'));
    // A new calendar year restarts the run rather than continuing last year's.
    if ($year !== (int)date('y')) { $year = (int)date('y'); $cfg['next'] = 1; }
    // Merged onto $cfg rather than replacing it: returning only the known keys
    // silently dropped the backfilled flag, so the one-off pass re-ran on every
    // request and could never record that it was done.
    return array_merge($cfg, [
        'year'       => $year,
        'next'       => max(1, (int)($cfg['next'] ?? 1)),
        'categories' => is_array($cfg['categories'] ?? null) ? $cfg['categories'] : [
            '1' => 'Specification',
            '2' => 'Notes',
        ],
    ]);
}

function ws_numbering_save(PDO $pdo, array $cfg): void {
    ws_ensure_settings($pdo);
    $st = $pdo->prepare(
        "INSERT INTO ws_settings (scope, data) VALUES ('numbering', ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)"
    );
    $st->execute([json_encode($cfg)]);
}

/**
 * Claim the next free project number. The stored counter is authoritative so
 * it can be corrected by hand, but a value that collides with a number already
 * issued would produce two projects sharing an invoice reference, so it walks
 * forward to the first free slot instead of overwriting.
 */
function ws_next_project_no(PDO $pdo): string {
    $cfg  = ws_numbering_settings($pdo);
    $year = $cfg['year'];
    $n    = $cfg['next'];
    $check = $pdo->prepare('SELECT 1 FROM ws_tasks WHERE project_no = ? LIMIT 1');
    do {
        $candidate = sprintf('%02d-%03d', $year, $n);
        $check->execute([$candidate]);
        $taken = (bool)$check->fetchColumn();
        if ($taken) $n++;
    // Past 999 the number simply grows a digit. Ugly beats issuing 26-999
    // twice, which is what stopping at the cap would have done.
    } while ($taken && $n < 100000);
    $cfg['next'] = $n + 1;
    ws_numbering_save($pdo, $cfg);
    return $candidate;
}

/** The top-level ancestor of a task, which is the project it belongs to. */
function ws_task_root(PDO $pdo, int $taskId): ?array {
    $st = $pdo->prepare('SELECT id, parent_id, project_no FROM ws_tasks WHERE id = ?');
    $seen = [];
    $cur  = $taskId;
    while ($cur && !isset($seen[$cur])) {
        $seen[$cur] = true;
        $st->execute([$cur]);
        $row = $st->fetch();
        if (!$row) return null;
        if (empty($row['parent_id'])) return $row;
        $cur = (int)$row['parent_id'];
    }
    return null;
}

/** Next free item index under a project, counting every descendant. */
function ws_next_item_no(PDO $pdo, int $rootId): int {
    $ids = ws_task_tree($pdo, $rootId);
    $ids = array_values(array_filter($ids, static fn($i) => (int)$i !== $rootId));
    if (!$ids) return 0;
    $ph = implode(',', array_fill(0, count($ids), '?'));
    $st = $pdo->prepare("SELECT MAX(item_no) FROM ws_tasks WHERE id IN ($ph)");
    $st->execute($ids);
    $max = $st->fetchColumn();
    return $max === null ? 0 : ((int)$max + 1);
}

/**
 * Give numbers to everything that predates this feature, oldest first, so the
 * board is not split between numbered and unnumbered work. Runs once.
 */
function ws_backfill_numbering(PDO $pdo): void {
    $cfg = ws_numbering_settings($pdo);
    if (!empty($cfg['backfilled'])) return;

    $roots = $pdo->query(
        'SELECT id FROM ws_tasks WHERE parent_id IS NULL AND (project_no IS NULL OR project_no = "")
         ORDER BY COALESCE(created_at, NOW()) ASC, id ASC'
    )->fetchAll();
    foreach ($roots as $r) {
        $no = ws_next_project_no($pdo);
        $pdo->prepare('UPDATE ws_tasks SET project_no = ? WHERE id = ?')->execute([$no, (int)$r['id']]);
    }

    // Items are numbered per project, again oldest first.
    $allRoots = $pdo->query('SELECT id FROM ws_tasks WHERE parent_id IS NULL')->fetchAll();
    foreach ($allRoots as $r) {
        $rootId = (int)$r['id'];
        $ids = array_values(array_filter(ws_task_tree($pdo, $rootId), static fn($i) => (int)$i !== $rootId));
        if (!$ids) continue;
        $ph  = implode(',', array_fill(0, count($ids), '?'));
        $kids = $pdo->prepare(
            "SELECT id FROM ws_tasks WHERE id IN ($ph) AND item_no IS NULL
             ORDER BY COALESCE(created_at, NOW()) ASC, id ASC"
        );
        $kids->execute($ids);
        $next = ws_next_item_no($pdo, $rootId);
        foreach ($kids->fetchAll() as $k) {
            $pdo->prepare('UPDATE ws_tasks SET item_no = ? WHERE id = ?')->execute([$next, (int)$k['id']]);
            $next++;
        }
    }

    $cfg = ws_numbering_settings($pdo);
    $cfg['backfilled'] = true;
    ws_numbering_save($pdo, $cfg);
}

/* ================= BOARD COLUMNS =================
   The five statuses used to be fixed. A space can now define its own and
   rename them; a space that defines none inherits from the nearest ancestor
   that does, and failing that gets the built-in set. A space can also hide
   columns it inherited without redefining the whole run.

   A task's status is just the column key, so the column set and the tasks are
   only loosely coupled: renaming a column keeps its key and every task stays
   put, and a task whose key no longer has a column is still shown rather than
   silently dropped. */

const WS_DEFAULT_COLUMNS = [
    ['key' => 'todo',        'label' => 'To do',       'tone' => 'slate'],
    ['key' => 'in_progress', 'label' => 'In progress', 'tone' => 'sky'],
    ['key' => 'review',      'label' => 'Review',      'tone' => 'amber'],
    ['key' => 'done',        'label' => 'Complete',    'tone' => 'green'],
    ['key' => 'cancelled',   'label' => 'Cancelled',   'tone' => 'red'],
];

function ws_ensure_columns(PDO $pdo): bool {
    static $ok = null;
    if ($ok !== null) return $ok;
    try {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS ws_space_columns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                space_id INT NOT NULL,
                col_key VARCHAR(32) NOT NULL,
                label VARCHAR(48) NOT NULL,
                tone VARCHAR(16) NOT NULL DEFAULT "slate",
                sort_order INT NOT NULL DEFAULT 0,
                UNIQUE KEY uniq_space_col (space_id, col_key),
                INDEX idx_wsc_space (space_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS ws_space_hidden_cols (
                space_id INT NOT NULL,
                col_key VARCHAR(32) NOT NULL,
                PRIMARY KEY (space_id, col_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        );
        // ws_tasks.status was an ENUM of the five fixed values on older
        // deployments. A custom key written into an ENUM is rejected outright,
        // or silently blanked when the server is not in strict mode, so widen
        // it before anything can try.
        $col = $pdo->query("SHOW COLUMNS FROM ws_tasks LIKE 'status'")->fetch(PDO::FETCH_ASSOC);
        if ($col && stripos((string)$col['Type'], 'enum') === 0) {
            $pdo->exec("ALTER TABLE ws_tasks MODIFY status VARCHAR(32) NOT NULL DEFAULT 'todo'");
        }
        $ok = true;
    } catch (Throwable $e) { $ok = false; }
    return $ok;
}

/** A key the client can store on a task and we can put in a URL. */
function ws_col_key(string $s): string {
    $k = strtolower(trim($s));
    $k = preg_replace('/[^a-z0-9]+/', '_', $k);
    return trim((string)$k, '_');
}

/** Rows a space defines itself, in order. Empty when it defines none. */
function ws_own_columns(PDO $pdo, int $spaceId): array {
    $st = $pdo->prepare(
        'SELECT col_key, label, tone FROM ws_space_columns
          WHERE space_id = ? ORDER BY sort_order ASC, id ASC'
    );
    $st->execute([$spaceId]);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $out[] = ['key' => (string)$r['col_key'], 'label' => (string)$r['label'], 'tone' => (string)$r['tone']];
    }
    return $out;
}

/** Parent of each space, once per request. */
function ws_parent_map(PDO $pdo): array {
    static $map = null;
    if ($map !== null) return $map;
    $map = [];
    foreach ($pdo->query('SELECT id, parent_id FROM ws_spaces')->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $map[(int)$r['id']] = $r['parent_id'] === null ? null : (int)$r['parent_id'];
    }
    return $map;
}

function ws_hidden_columns(PDO $pdo, int $spaceId): array {
    $st = $pdo->prepare('SELECT col_key FROM ws_space_hidden_cols WHERE space_id = ?');
    $st->execute([$spaceId]);
    return array_map('strval', array_column($st->fetchAll(PDO::FETCH_ASSOC), 'col_key'));
}

/**
 * What a space's board actually shows: its own rows, or the nearest
 * ancestor's, or the built-in set. `source` tells the UI whether editing would
 * be changing this space or breaking away from a parent.
 */
function ws_effective_columns(PDO $pdo, int $spaceId): array {
    $own = ws_own_columns($pdo, $spaceId);
    if ($own) return ['columns' => $own, 'source' => 'own', 'from' => $spaceId];

    $parents = ws_parent_map($pdo);
    $seen = [];
    $cur = $parents[$spaceId] ?? null;
    while ($cur !== null && !isset($seen[$cur])) {
        $seen[$cur] = true;
        $rows = ws_own_columns($pdo, $cur);
        if ($rows) return ['columns' => $rows, 'source' => 'inherited', 'from' => $cur];
        $cur = $parents[$cur] ?? null;
    }
    return ['columns' => WS_DEFAULT_COLUMNS, 'source' => 'default', 'from' => null];
}

/**
 * Columns for a board that rolls subspaces up. A subspace with its own rows
 * would otherwise have its tasks land nowhere on the parent, so the parent
 * shows its own set first and then anything extra its descendants use, in the
 * order they were found. Nothing a child invented can hide a child's work.
 */
function ws_rollup_columns(PDO $pdo, int $rootId): array {
    $eff = ws_effective_columns($pdo, $rootId);
    $out = [];
    foreach ($eff['columns'] as $c) $out[$c['key']] = $c;
    foreach (ws_space_tree($pdo, $rootId) as $sid) {
        if ((int)$sid === $rootId) continue;
        foreach (ws_effective_columns($pdo, (int)$sid)['columns'] as $c) {
            if (!isset($out[$c['key']])) $out[$c['key']] = $c;
        }
    }
    return array_values($out);
}

/** Make sure the multi-assignee table exists (self-migrating). */
function ws_ensure_task_assignees(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_task_assignees (
            task_id INT NOT NULL,
            user_id INT NOT NULL,
            PRIMARY KEY (task_id, user_id),
            INDEX idx_wta_user (user_id),
            FOREIGN KEY (task_id) REFERENCES ws_tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    // Backfill from the legacy single assignee column, once.
    try {
        $pdo->exec(
            'INSERT IGNORE INTO ws_task_assignees (task_id, user_id)
             SELECT id, assignee_id FROM ws_tasks WHERE assignee_id IS NOT NULL'
        );
    } catch (Throwable $e) { /* ignore */ }
}

/** Make sure the per-task chat table exists (self-migrating). */
function ws_ensure_task_comments(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_task_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            user_id INT NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_wtc_task (task_id, id),
            FOREIGN KEY (task_id) REFERENCES ws_tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    if (!in_array('reply_to', ws_table_cols($pdo, 'ws_task_comments'), true)) {
        try {
            $pdo->exec('ALTER TABLE ws_task_comments ADD COLUMN reply_to INT NULL,
                        ADD INDEX idx_wtc_reply (reply_to)');
        } catch (Throwable $e) { /* older schema stays readable without it */ }
    }
}

/** Message edit marker + reaction table (self-migrating). */
function ws_ensure_message_extras(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    // ws_messages predates the self-migrating helpers, so unlike every table
    // created here it may still be utf8mb3. Now that the connection speaks
    // utf8mb4, a utf8mb3 body column would reject an emoji outright rather than
    // quietly replacing it with "?" — which is louder, but no more usable.
    try {
        foreach ($pdo->query('SHOW FULL COLUMNS FROM ws_messages')->fetchAll() as $c) {
            $coll = (string)($c['Collation'] ?? '');
            if ($coll !== '' && strpos($coll, 'utf8mb4') !== 0) {
                $pdo->exec('ALTER TABLE ws_messages CONVERT TO CHARACTER SET utf8mb4');
                break;
            }
        }
    } catch (Throwable $e) { /* leave the table as it is if it will not convert */ }
    $mcols = ws_table_cols($pdo, 'ws_messages');
    if (!in_array('edited_at', $mcols, true)) {
        try { $pdo->exec('ALTER TABLE ws_messages ADD COLUMN edited_at DATETIME NULL'); }
        catch (Throwable $e) { /* older schema stays readable without it */ }
    }
    // Replies are flat: a message points at the one it answers and quotes it,
    // rather than opening a thread of its own.
    if (!in_array('reply_to', $mcols, true)) {
        try { $pdo->exec('ALTER TABLE ws_messages ADD COLUMN reply_to INT NULL, ADD INDEX idx_wm_reply (reply_to)'); }
        catch (Throwable $e) { /* older schema stays readable without it */ }
    }
    // No foreign key: ws_messages predates this and may not be InnoDB on every
    // deployment. Reactions are cleaned up explicitly when a message is deleted.
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_message_reactions (
            message_id INT NOT NULL,
            user_id INT NOT NULL,
            emoji VARCHAR(16) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (message_id, user_id, emoji),
            INDEX idx_wmr_message (message_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

/** Fold the reaction rows for these messages onto the messages themselves. */
function ws_with_reactions(PDO $pdo, array $rows, int $meId): array {
    if (!$rows) return $rows;
    $ids = array_map(static fn($r) => (int)$r['id'], $rows);
    $ph  = implode(',', array_fill(0, count($ids), '?'));
    $st  = $pdo->prepare("SELECT message_id, emoji, user_id FROM ws_message_reactions WHERE message_id IN ($ph)");
    $st->execute($ids);
    $byMsg = [];
    foreach ($st->fetchAll() as $r) {
        $mid = (int)$r['message_id'];
        $e   = (string)$r['emoji'];
        if (!isset($byMsg[$mid][$e])) {
            $byMsg[$mid][$e] = ['emoji' => $e, 'count' => 0, 'mine' => false, 'user_ids' => []];
        }
        $byMsg[$mid][$e]['count']++;
        $byMsg[$mid][$e]['user_ids'][] = (int)$r['user_id'];
        if ((int)$r['user_id'] === $meId) $byMsg[$mid][$e]['mine'] = true;
    }
    foreach ($rows as &$row) {
        $mid = (int)$row['id'];
        $row['reactions'] = isset($byMsg[$mid]) ? array_values($byMsg[$mid]) : [];
    }
    unset($row);
    return $rows;
}

/** Make sure synchronized read-state and time tracking tables exist. */
function ws_ensure_productivity_tables(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_read_state (
            user_id INT NOT NULL, scope VARCHAR(24) NOT NULL, scope_id INT NOT NULL DEFAULT 0,
            seen_at DATETIME NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, scope, scope_id), INDEX idx_wrs_user_updated (user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_time_entries (
            id INT AUTO_INCREMENT PRIMARY KEY, task_id INT NOT NULL, user_id INT NOT NULL,
            started_at DATETIME NOT NULL, ended_at DATETIME NULL, duration_seconds INT NOT NULL DEFAULT 0,
            notes VARCHAR(500) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_wte_user_started (user_id, started_at), INDEX idx_wte_task_started (task_id, started_at),
            INDEX idx_wte_active (user_id, ended_at),
            FOREIGN KEY (task_id) REFERENCES ws_tasks(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

/** Make sure ws_spaces can carry a logo icon name (self-migrating). */
function ws_ensure_space_icon(PDO $pdo): bool {
    static $ok = null;
    if ($ok !== null) return $ok;
    if (in_array('icon', ws_table_cols($pdo, 'ws_spaces'), true)) { $ok = true; return $ok; }
    try {
        $pdo->exec('ALTER TABLE ws_spaces ADD COLUMN icon VARCHAR(48) NULL');
        $ok = true;
    } catch (Throwable $e) { $ok = false; }
    return $ok;
}

/** Make sure ws_channels can carry a logo icon and colour (self-migrating). */
function ws_ensure_channel_look(PDO $pdo): bool {
    static $ok = null;
    if ($ok !== null) return $ok;
    $cols = ws_table_cols($pdo, 'ws_channels');
    $ok = true;
    foreach (['icon' => 'VARCHAR(48)', 'color' => 'VARCHAR(9)'] as $col => $type) {
        if (in_array($col, $cols, true)) continue;
        try { $pdo->exec("ALTER TABLE ws_channels ADD COLUMN `$col` $type NULL"); }
        catch (Throwable $e) { $ok = false; }
    }
    return $ok;
}

/** Subsidiaries live in the client as a fixed list; this stores only the
 *  per-slug look overrides, so the code stays the source of truth for the rest. */
function ws_ensure_subsidiaries(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_subsidiaries (
            slug VARCHAR(64) NOT NULL PRIMARY KEY,
            is_private TINYINT(1) NOT NULL DEFAULT 0,
            icon VARCHAR(48) NULL,
            color VARCHAR(9) NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

/** Per-module settings as a JSON blob, so new keys need no migration. */
function ws_ensure_settings(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS ws_settings (
            scope VARCHAR(48) NOT NULL PRIMARY KEY,
            data TEXT NULL,
            updated_by INT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

/** Presence heartbeats (self-migrating). One row per user, last write wins. */
function ws_ensure_presence(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS ws_presence (
            user_id INT NOT NULL PRIMARY KEY,
            state VARCHAR(10) NOT NULL,
            last_seen DATETIME NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_wp_seen (last_seen)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );
}

/** A tab that stops beating is treated as gone after this many seconds.
 *  Three missed 30s heartbeats, so a slow network does not flap someone offline. */
const WS_PRESENCE_TTL = 95;

/** Make sure the shared documents table exists (self-migrating). */
function ws_ensure_docs(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS ws_docs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            space_id INT NULL,
            title VARCHAR(255) NOT NULL,
            body MEDIUMTEXT NULL,
            is_pinned TINYINT(1) NOT NULL DEFAULT 0,
            created_by INT NULL,
            updated_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_wd_space (space_id, updated_at),
            FOREIGN KEY (space_id) REFERENCES ws_spaces(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
}

/** Replace the assignee set of a task (also syncs legacy assignee_id). */
function ws_set_task_assignees(PDO $pdo, int $taskId, array $ids): void {
    ws_ensure_task_assignees($pdo);
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    $pdo->prepare('DELETE FROM ws_task_assignees WHERE task_id = ?')->execute([$taskId]);
    $ins = $pdo->prepare('INSERT IGNORE INTO ws_task_assignees (task_id, user_id) VALUES (?, ?)');
    foreach ($ids as $uid) $ins->execute([$taskId, $uid]);
    $pdo->prepare('UPDATE ws_tasks SET assignee_id = ? WHERE id = ?')->execute([$ids[0] ?? null, $taskId]);
}

/** Task id + every descendant subtask id. */
function ws_task_tree(PDO $pdo, int $rootId): array {
    if (!ws_ensure_parent_col($pdo)) return [$rootId];
    $rows  = $pdo->query('SELECT id, parent_id FROM ws_tasks')->fetchAll();
    $ids   = [$rootId];
    $queue = [$rootId];
    while ($queue) {
        $cur = array_pop($queue);
        foreach ($rows as $r) {
            if ($r['parent_id'] !== null && (int)$r['parent_id'] === $cur) {
                $ids[]   = (int)$r['id'];
                $queue[] = (int)$r['id'];
            }
        }
    }
    return array_values(array_unique($ids));
}



/** All column names of the users table (lowercased). */
function ws_user_cols(PDO $pdo): array {
    static $cols = null;
    if ($cols !== null) return $cols;
    $cols = [];
    foreach ($pdo->query('SHOW COLUMNS FROM users')->fetchAll() as $r) {
        $cols[] = strtolower($r['Field'] ?? $r[0] ?? '');
    }
    return $cols;
}

/** Detect which display-name column the users table actually has. */
function ws_user_name_col(PDO $pdo): ?string {
    static $col = false;
    if ($col !== false) return $col;
    $cols = ws_user_cols($pdo);
    foreach (['full_name', 'name', 'display_name', 'username'] as $c) {
        if (in_array($c, $cols, true)) { $col = $c; return $col; }
    }
    $col = null;
    return $col;
}

/** SQL expression aliased as `name`, safe on any users schema. */
function ws_user_name_expr(PDO $pdo, string $alias = ''): string {
    $p = $alias ? $alias . '.' : '';
    $c = ws_user_name_col($pdo);
    return $c ? "{$p}{$c} AS name" : "{$p}email AS name";
}

