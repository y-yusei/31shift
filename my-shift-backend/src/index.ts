export interface Env {
    DB: D1Database;
}

// すべての応答にCORSヘッダーを追加するヘルパー関数
function withCors(response: Response): Response {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // プリフライトリクエスト(OPTIONS)には、常に成功応答を返す
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
            });
        }

        const url = new URL(request.url);

        try {
            // --- APIルーティング ---
            if (url.pathname === '/api/data') {
                const month = url.searchParams.get('month');
                if (!month) return withCors(new Response('Month query parameter is required', { status: 400 }));

                const shiftsStmt = env.DB.prepare(`
                    SELECT 
                        s.id, s.user_id as userId, u.name as fullName, u.role, 
                        s.shift_date as shiftDate, s.time, s.break_time as breakTime, s.notes 
                    FROM 
                        shifts s LEFT JOIN users u ON s.user_id = u.id 
                    WHERE 
                        strftime('%Y-%m', s.shift_date) = ?
                `).bind(month);
                
                const usersStmt = env.DB.prepare('SELECT * FROM users ORDER BY id');
                const manualBreaksStmt = env.DB.prepare("SELECT * FROM manual_breaks WHERE strftime('%Y-%m', shift_date) = ?").bind(month);
                const manualShortagesStmt = env.DB.prepare("SELECT * FROM manual_shortages WHERE strftime('%Y-%m', shift_date) = ?").bind(month);

                const [shiftsResult, usersResult, manualBreaksResult, manualShortagesResult] = await Promise.all([
                    shiftsStmt.all(), usersStmt.all(), manualBreaksStmt.all(), manualShortagesStmt.all()
                ]);

                const data = {
                    users: usersResult.results,
                    shifts: (shiftsResult.results || []).reduce<Record<string, any[]>>((acc, shift) => { const date = shift.shiftDate as string; if (!acc[date]) acc[date] = []; acc[date].push(shift); return acc; }, {}),
                    manualBreaks: (manualBreaksResult.results || []).reduce((acc, item: any) => { acc[item.shift_date as string] = item.break_text; return acc; }, {}),
                    manualShortages: (manualShortagesResult.results || []).reduce((acc, item: any) => { acc[item.shift_date as string] = item.shortage_text; return acc; }, {}),
                };
                return withCors(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));

            // ✅ シフト更新用のパス
            } else if (url.pathname === '/api/update-shift' && request.method === 'POST') {
                const { userId, date, time } = await request.json<any>();
                if (!userId || !date) return withCors(new Response('userId and date are required', { status: 400 }));
    
                await env.DB.prepare('DELETE FROM shifts WHERE user_id = ? AND shift_date = ?').bind(userId, date).run();
                
                if (time) {
                    await env.DB.prepare('INSERT INTO shifts (user_id, shift_date, time) VALUES (?, ?, ?)')
                        .bind(userId, date, time)
                        .run();
                }
                return withCors(new Response(JSON.stringify({ success: true }), { status: 200 }));

            // ✅ 休憩・不足時間更新用のパス
            } else if (url.pathname === '/api/update-manual-data' && request.method === 'POST') {
                const { date, breaks, shortages } = await request.json<any>();
                if (!date) return withCors(new Response('Date is required', { status: 400 }));
                
                if(breaks !== undefined) {
                    await env.DB.prepare('INSERT OR REPLACE INTO manual_breaks (shift_date, break_text) VALUES (?, ?)').bind(date, breaks).run();
                }
                if(shortages !== undefined) {
                    await env.DB.prepare('INSERT OR REPLACE INTO manual_shortages (shift_date, shortage_text) VALUES (?, ?)').bind(date, shortages).run();
                }

                return withCors(new Response(JSON.stringify({ success: true }), { status: 200 }));
            
            } else if (url.pathname === '/api/login' && request.method === 'POST') {
                const { username, password } = await request.json<any>();
                if (!username || !password) {
                    return withCors(new Response('Username and password are required', { status: 400 }));
                }
    
                const stmt = env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username);
                const { results } = await stmt.all();
                
                const user: any = results[0];
    
                if (user && user.password === password) {
                    const { password, ...userToSend } = user;
                    return withCors(new Response(JSON.stringify({ success: true, user: userToSend }), { headers: { 'Content-Type': 'application/json' }}));
                } else {
                    return withCors(new Response(JSON.stringify({ success: false, message: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' }}));
                }

            // シフト提出期間一覧取得
            } else if (url.pathname === '/api/shift-periods' && request.method === 'GET') {
                const stmt = env.DB.prepare('SELECT * FROM shift_periods ORDER BY created_at DESC');
                const { results } = await stmt.all();
                return withCors(new Response(JSON.stringify({ periods: results }), { headers: { 'Content-Type': 'application/json' }}));

            // アクティブなシフト提出期間取得
            } else if (url.pathname === '/api/active-shift-period' && request.method === 'GET') {
                const stmt = env.DB.prepare('SELECT * FROM shift_periods WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1');
                const { results } = await stmt.all();
                return withCors(new Response(JSON.stringify({ period: results[0] || null }), { headers: { 'Content-Type': 'application/json' }}));

            // シフト提出期間作成（管理者のみ）
            } else if (url.pathname === '/api/shift-periods' && request.method === 'POST') {
                const { name, startDate, endDate, displayDeadline, actualDeadline, createdBy } = await request.json<any>();
                if (!name || !startDate || !endDate || !displayDeadline || !actualDeadline || !createdBy) {
                    return withCors(new Response('All fields are required', { status: 400 }));
                }

                // 既存のアクティブな期間を無効化
                await env.DB.prepare('UPDATE shift_periods SET is_active = 0').run();

                const stmt = env.DB.prepare(`
                    INSERT INTO shift_periods (name, start_date, end_date, display_deadline, actual_deadline, created_by)
                    VALUES (?, ?, ?, ?, ?, ?)
                `).bind(name, startDate, endDate, displayDeadline, actualDeadline, createdBy);
                
                const result = await stmt.run();
                return withCors(new Response(JSON.stringify({ success: true, id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json' }}));

            // シフト提出
            } else if (url.pathname === '/api/shift-submissions' && request.method === 'POST') {
                const { periodId, userId, submissions } = await request.json<any>();
                if (!periodId || !userId || !submissions || !Array.isArray(submissions)) {
                    return withCors(new Response('Invalid submission data', { status: 400 }));
                }

                // 期間の存在確認と締切チェック
                const periodStmt = env.DB.prepare('SELECT * FROM shift_periods WHERE id = ?').bind(periodId);
                const { results: periodResults } = await periodStmt.all();
                const period = periodResults[0] as any;

                if (!period) {
                    return withCors(new Response('Shift period not found', { status: 404 }));
                }

                // 実際の締切日をチェック
                const today = new Date().toISOString().split('T')[0];
                if (today > period.actual_deadline) {
                    return withCors(new Response('Submission deadline has passed', { status: 400 }));
                }

                // 既存の提出を削除
                await env.DB.prepare('DELETE FROM shift_submissions WHERE period_id = ? AND user_id = ?').bind(periodId, userId).run();

                // 新しい提出を挿入
                for (const submission of submissions) {
                    if (submission.submissionDate && submission.startTime && submission.endTime) {
                        await env.DB.prepare(`
                            INSERT INTO shift_submissions (period_id, user_id, submission_date, start_time, end_time, break_time, notes)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `).bind(
                            periodId, 
                            userId, 
                            submission.submissionDate, 
                            submission.startTime, 
                            submission.endTime, 
                            submission.breakTime || '', 
                            submission.notes || ''
                        ).run();
                    }
                }

                return withCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }}));

            // シフト提出一覧取得
            } else if (url.pathname === '/api/shift-submissions' && request.method === 'GET') {
                const periodId = url.searchParams.get('periodId');
                const userId = url.searchParams.get('userId');
                
                let query = `
                    SELECT ss.*, u.name as user_name, sp.name as period_name
                    FROM shift_submissions ss
                    JOIN users u ON ss.user_id = u.id
                    JOIN shift_periods sp ON ss.period_id = sp.id
                `;
                let params: any[] = [];
                
                if (periodId) {
                    query += ' WHERE ss.period_id = ?';
                    params.push(periodId);
                }
                if (userId) {
                    query += periodId ? ' AND ss.user_id = ?' : ' WHERE ss.user_id = ?';
                    params.push(userId);
                }
                
                query += ' ORDER BY ss.submission_date, u.name';
                
                const stmt = env.DB.prepare(query).bind(...params);
                const { results } = await stmt.all();
                return withCors(new Response(JSON.stringify({ submissions: results }), { headers: { 'Content-Type': 'application/json' }}));

            // シフト提出の承認/却下
            } else if (url.pathname === '/api/shift-submissions/review' && request.method === 'POST') {
                const { submissionId, status, reviewNotes, reviewedBy } = await request.json<any>();
                if (!submissionId || !status || !reviewedBy) {
                    return withCors(new Response('Missing required fields', { status: 400 }));
                }

                const stmt = env.DB.prepare(`
                    UPDATE shift_submissions 
                    SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `).bind(status, reviewNotes || '', reviewedBy, submissionId);
                
                await stmt.run();
                return withCors(new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' }}));

            } else if (url.pathname === '/') {
                return withCors(new Response('Shift Management API is running!'));
            }

            // どのパスにも一致しない場合
            return withCors(new Response('Not Found', { status: 404 }));

        } catch (e: any) {
            console.error("Unhandled Error:", e);
            return withCors(new Response(`Internal Server Error: ${e.message}`, { status: 500 }));
        }
    },
};