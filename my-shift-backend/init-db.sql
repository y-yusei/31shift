-- データベース初期化用SQLファイル
-- このファイルをCloudflare D1データベースに適用してください

-- ユーザーテーブル
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('manager', 'employee'))
);

-- シフト提出期間テーブル
CREATE TABLE IF NOT EXISTS shift_periods (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    submission_start_date TEXT NOT NULL,
    display_deadline TEXT NOT NULL,
    actual_deadline TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- シフト提出テーブル
CREATE TABLE IF NOT EXISTS shift_submissions (
    id INTEGER PRIMARY KEY,
    period_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    submission_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    break_time TEXT,
    notes TEXT,
    status TEXT DEFAULT 'submitted' CHECK(status IN ('submitted', 'approved', 'rejected')),
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    reviewed_by INTEGER,
    review_notes TEXT,
    FOREIGN KEY (period_id) REFERENCES shift_periods(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id),
    UNIQUE(period_id, user_id, submission_date)
);

-- 既存のテーブル（シフト管理用）
CREATE TABLE IF NOT EXISTS shifts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    shift_date TEXT NOT NULL,
    time TEXT,
    break_time TEXT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS manual_breaks (
    shift_date TEXT PRIMARY KEY,
    break_text TEXT
);

CREATE TABLE IF NOT EXISTS manual_shortages (
    shift_date TEXT PRIMARY KEY,
    shortage_text TEXT
);

-- 初期データの挿入
INSERT OR IGNORE INTO users (id, username, password, name, role) VALUES 
(1, 'manager', 'pass123', '管理者', 'manager'),
(2, 'employee1', 'pass123', '従業員1', 'employee'),
(3, 'employee2', 'pass123', '従業員2', 'employee');

-- サンプルのシフト提出期間（2024年1月前半）
INSERT OR IGNORE INTO shift_periods (id, name, start_date, end_date, submission_start_date, display_deadline, actual_deadline, is_active, created_by) VALUES 
(1, '2024年1月前半', '2024-01-01', '2024-01-15', '2023-12-20', '2024-01-15', '2024-01-17', 1, 1);
