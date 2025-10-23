-- シフト提出期間テーブルにsubmission_start_dateカラムを追加
ALTER TABLE shift_periods ADD COLUMN submission_start_date TEXT;

-- 既存のデータにデフォルト値を設定（既存のstart_dateと同じ値）
UPDATE shift_periods SET submission_start_date = start_date WHERE submission_start_date IS NULL;

-- 既存のサンプルデータを更新
UPDATE shift_periods SET submission_start_date = '2023-12-20' WHERE id = 1;
