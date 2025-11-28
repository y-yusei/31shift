# シフト提出機能 - データベースマイグレーション

## マイグレーションファイル

マイグレーションファイルは `my-shift-backend/migrations/0002_create_shift_wishes.sql` に作成されています。

## 手動でSQLを実行する場合

以下のSQLをD1データベースで実行してください：

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

## マイグレーションの実行方法

Cloudflare D1のマイグレーションを実行するには、以下のコマンドを実行してください：

```bash
cd my-shift-backend
npx wrangler d1 migrations apply 31shift_db
```

## テーブル構造の説明

- `id`: 主キー（自動増分）
- `user_id`: 提出したユーザーID（usersテーブルへの外部キー）
- `shift_date`: シフト希望日（YYYY-MM-DD形式）
- `time`: 希望時間（例：09:00 - 18:00）
- `period_type`: 提出期間タイプ（'first_half' または 'second_half'）
- `period_year`: 提出期間の年
- `period_month`: 提出期間の月
- `status`: ステータス（'pending', 'approved', 'rejected'）
- `submitted_at`: 提出日時
- `approved_at`: 承認日時（NULL可）
- `notes`: 備考（NULL可）

## 制約

- 同じユーザー、同じ日付、同じ期間タイプ、同じ年月の組み合わせは一意（UNIQUE制約）
- `period_type`は 'first_half' または 'second_half' のみ
- `status`は 'pending', 'approved', 'rejected' のみ

