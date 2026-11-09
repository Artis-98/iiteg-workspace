CREATE TABLE IF NOT EXISTS users (
 id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(120) NOT NULL,
 role VARCHAR(40) NOT NULL DEFAULT 'member', avatar_url VARCHAR(255) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_login_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS ws_channels (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  is_private  TINYINT(1) NOT NULL DEFAULT 0,
  created_by  INT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ws_channel_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ws_channel_members (
  channel_id INT NOT NULL,
  user_id    INT NOT NULL,
  PRIMARY KEY (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES ws_channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ws_messages (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  channel_id   INT NULL,            -- set for channel messages
  sender_id    INT NOT NULL,
  recipient_id INT NULL,            -- set for direct messages
  body         TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ws_msg_channel (channel_id, id),
  INDEX idx_ws_msg_dm (sender_id, recipient_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ws_spaces (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  parent_id  INT NULL,              -- NULL = top-level space, else subspace
  color      VARCHAR(9) NULL,
  created_by INT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ws_space_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ws_tasks (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  space_id    INT NOT NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT NULL,
  status      VARCHAR(48) NOT NULL DEFAULT 'todo',
  priority    ENUM('none','low','normal','high','urgent') NOT NULL DEFAULT 'none',
  assignee_id INT NULL,
  due_date    DATE NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ws_task_space (space_id),
  INDEX idx_ws_task_status (status),
  FOREIGN KEY (space_id) REFERENCES ws_spaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ws_read_state (
  user_id    INT NOT NULL,
  scope      VARCHAR(24) NOT NULL,
  scope_id   INT NOT NULL DEFAULT 0,
  seen_at    DATETIME NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, scope, scope_id),
  INDEX idx_wrs_user_updated (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ws_time_entries (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  task_id          INT NOT NULL,
  user_id          INT NOT NULL,
  started_at       DATETIME NOT NULL,
  ended_at         DATETIME NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  notes            VARCHAR(500) NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wte_user_started (user_id, started_at),
  INDEX idx_wte_task_started (task_id, started_at),
  INDEX idx_wte_active (user_id, ended_at),
  FOREIGN KEY (task_id) REFERENCES ws_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS login_attempts (
 bucket CHAR(64) PRIMARY KEY, attempts INT NOT NULL DEFAULT 0,
 window_start DATETIME NOT NULL, INDEX idx_login_window(window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
