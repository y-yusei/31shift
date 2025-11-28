# マイグレーション実行スクリプト
Write-Host "マイグレーションを実行しています..." -ForegroundColor Yellow

# テーブル作成
Write-Host "`n1. shift_wishesテーブルを作成中..." -ForegroundColor Cyan
$createTable = @"
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
"@

npx wrangler d1 execute 31shift_db --command="$createTable"

# インデックス作成
Write-Host "`n2. インデックスを作成中..." -ForegroundColor Cyan
npx wrangler d1 execute 31shift_db --command="CREATE INDEX IF NOT EXISTS idx_shift_wishes_user_period ON shift_wishes(user_id, period_type, period_year, period_month);"
npx wrangler d1 execute 31shift_db --command="CREATE INDEX IF NOT EXISTS idx_shift_wishes_status ON shift_wishes(status);"
npx wrangler d1 execute 31shift_db --command="CREATE INDEX IF NOT EXISTS idx_shift_wishes_date ON shift_wishes(shift_date);"

Write-Host "`nマイグレーションが完了しました！" -ForegroundColor Green

