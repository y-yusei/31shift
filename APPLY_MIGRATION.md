# マイグレーション実行方法

マイグレーションコマンドが正常に動作しない場合、以下の方法でマイグレーションを実行できます。

## 方法1: wranglerコマンドで直接SQLを実行

```powershell
cd my-shift-backend
npx wrangler d1 execute 31shift_db --file=./migrations/0002_create_shift_wishes.sql
```

## 方法2: SQLを直接実行

以下のSQLをCloudflare D1のダッシュボードで直接実行してください：

```sql
-- シフト提出（希望シフト）テーブル
CREATE TABLE IF NOT EXISTS shift_wishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    shift_date TEXT NOT NULL,
    time TEXT,
    period_type TEXT NOT NULL CHECK(period_type IN ('first_half', 'second_half')),
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    submitted_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    approved_at TEXT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, shift_date, period_type, period_year, period_month)
);

-- インデックス作成（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_shift_wishes_user_period ON shift_wishes(user_id, period_type, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_shift_wishes_status ON shift_wishes(status);
CREATE INDEX IF NOT EXISTS idx_shift_wishes_date ON shift_wishes(shift_date);
```

## 方法3: wranglerコマンドでSQLを直接実行

```powershell
cd my-shift-backend
npx wrangler d1 execute 31shift_db --command="CREATE TABLE IF NOT EXISTS shift_wishes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, shift_date TEXT NOT NULL, time TEXT, period_type TEXT NOT NULL CHECK(period_type IN ('first_half', 'second_half')), period_year INTEGER NOT NULL, period_month INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')), submitted_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')), approved_at TEXT, notes TEXT, FOREIGN KEY (user_id) REFERENCES users(id), UNIQUE(user_id, shift_date, period_type, period_year, period_month));"
```

その後、インデックスを作成：

```powershell
npx wrangler d1 execute 31shift_db --command="CREATE INDEX IF NOT EXISTS idx_shift_wishes_user_period ON shift_wishes(user_id, period_type, period_year, period_month);"
npx wrangler d1 execute 31shift_db --command="CREATE INDEX IF NOT EXISTS idx_shift_wishes_status ON shift_wishes(status);"
npx wrangler d1 execute 31shift_db --command="CREATE INDEX IF NOT EXISTS idx_shift_wishes_date ON shift_wishes(shift_date);"
```

## 確認方法

テーブルが正しく作成されたか確認：

```powershell
npx wrangler d1 execute 31shift_db --command="SELECT name FROM sqlite_master WHERE type='table' AND name='shift_wishes';"
```

