# シフト提出機能 - マイグレーション実行ガイド

## 問題の原因

`npx wrangler d1 migrations apply` コマンドが正常に動作しない場合、以下の方法でマイグレーションを実行できます。

## 推奨方法: Cloudflare D1ダッシュボードで直接実行

1. Cloudflareダッシュボードにログイン
2. Workers & Pages > D1 > 31shift_db を選択
3. 「Query」タブを開く
4. 以下のSQLをコピー＆ペーストして実行：

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

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_shift_wishes_user_period ON shift_wishes(user_id, period_type, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_shift_wishes_status ON shift_wishes(status);
CREATE INDEX IF NOT EXISTS idx_shift_wishes_date ON shift_wishes(shift_date);
```

5. 「Run」ボタンをクリックして実行

## 確認方法

同じクエリエディタで以下を実行して、テーブルが作成されたか確認：

```sql
SELECT name FROM sqlite_master WHERE type='table' AND name='shift_wishes';
```

`shift_wishes` が表示されれば成功です。

## 代替方法: コマンドラインで個別に実行

PowerShellで以下のコマンドを順番に実行：

```powershell
cd my-shift-backend

# テーブル作成
npx wrangler d1 execute 31shift_db --command="CREATE TABLE IF NOT EXISTS shift_wishes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, shift_date TEXT NOT NULL, time TEXT, period_type TEXT NOT NULL CHECK(period_type IN ('first_half', 'second_half')), period_year INTEGER NOT NULL, period_month INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')), submitted_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')), approved_at TEXT, notes TEXT, FOREIGN KEY (user_id) REFERENCES users(id), UNIQUE(user_id, shift_date, period_type, period_year, period_month));"

# インデックス作成
npx wrangler d1 execute 31shift_db --command="CREATE INDEX IF NOT EXISTS idx_shift_wishes_user_period ON shift_wishes(user_id, period_type, period_year, period_month);"
npx wrangler d1 execute 31shift_db --command="CREATE INDEX IF NOT EXISTS idx_shift_wishes_status ON shift_wishes(status);"
npx wrangler d1 execute 31shift_db --command="CREATE INDEX IF NOT EXISTS idx_shift_wishes_date ON shift_wishes(shift_date);"
```

## マイグレーション後の確認

マイグレーションが完了したら、以下を確認してください：

1. バックエンドをデプロイ（変更があれば）:
   ```powershell
   cd my-shift-backend
   npx wrangler deploy
   ```

2. フロントエンドで動作確認:
   - 従業員ログイン（user/pass123）で「シフト提出」タブを確認
   - 管理者ログイン（manager/pass123）で提出シフト確認画面を確認

