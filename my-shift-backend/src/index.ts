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
                // manual_shortagesテーブルは存在する場合のみ取得
                let manualShortagesStmt;
                try {
                    manualShortagesStmt = env.DB.prepare("SELECT * FROM manual_shortages WHERE strftime('%Y-%m', shift_date) = ?").bind(month);
                } catch (e) {
                    manualShortagesStmt = null;
                }

                const [shiftsResult, usersResult, manualShortagesResult] = await Promise.all([
                    shiftsStmt.all(), 
                    usersStmt.all(), 
                    manualShortagesStmt ? manualShortagesStmt.all() : Promise.resolve({ results: [] })
                ]);

                // shiftsテーブルからbreak_timeを日付ごとに集約
                const manualBreaks: Record<string, string> = {};
                (shiftsResult.results || []).forEach((shift: any) => {
                    const date = shift.shiftDate as string;
                    // 同じ日付で最初に見つかったbreak_timeを使用（全レコードで同じ値のはず）
                    // user_id=0のダミーレコードも含める
                    if (shift.breakTime && !manualBreaks[date]) {
                        manualBreaks[date] = shift.breakTime;
                    }
                });
                console.log('集約されたmanualBreaks:', manualBreaks);

                // user_id=0のダミーレコードを除外してシフトデータを構築
                const shiftsData = (shiftsResult.results || []).reduce<Record<string, any[]>>((acc, shift) => { 
                    // user_id=0のダミーレコードは除外（休憩時間保存用）
                    if (shift.userId === 0) return acc;
                    const date = shift.shiftDate as string; 
                    if (!acc[date]) acc[date] = []; 
                    acc[date].push(shift); 
                    return acc; 
                }, {});

                const data = {
                    users: usersResult.results,
                    shifts: shiftsData,
                    manualBreaks: manualBreaks,
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
                
                try {
                    // 休憩時間は該当日付の全シフトレコードのbreak_timeカラムを更新
                    if(breaks !== undefined) {
                        // まず該当日付にuser_id=0のダミーレコードが存在するか確認
                        const dummyRecord = await env.DB.prepare('SELECT * FROM shifts WHERE shift_date = ? AND user_id = 0').bind(date).first();
                        
                        if (dummyRecord) {
                            // ダミーレコードが存在する場合、break_timeを更新
                            await env.DB.prepare('UPDATE shifts SET break_time = ? WHERE shift_date = ? AND user_id = 0').bind(breaks || '', date).run();
                            console.log('ダミーレコードの休憩時間を更新');
                        } else {
                            // ダミーレコードが存在しない場合、新規作成
                            await env.DB.prepare('INSERT INTO shifts (user_id, shift_date, time, break_time) VALUES (0, ?, ?, ?)').bind(date, '', breaks || '').run();
                            console.log('ダミーレコードを新規作成して休憩時間を保存');
                        }
                        
                        // 該当日付の通常のシフトレコード（user_id != 0）のbreak_timeも更新
                        const updateResult = await env.DB.prepare('UPDATE shifts SET break_time = ? WHERE shift_date = ? AND user_id != 0').bind(breaks || '', date).run();
                        console.log('通常シフトレコードの休憩時間更新結果:', updateResult);
                    }
                    // 不足時間はmanual_shortagesテーブルに保存（shiftsテーブルに該当カラムがない場合）
                    if(shortages !== undefined) {
                        // まずテーブルの存在を確認してから保存
                        try {
                            const shortagesResult = await env.DB.prepare('INSERT OR REPLACE INTO manual_shortages (shift_date, shortage_text) VALUES (?, ?)').bind(date, shortages || '').run();
                            console.log('不足時間保存結果:', shortagesResult);
                        } catch (e: any) {
                            // manual_shortagesテーブルが存在しない場合は無視
                            console.warn('manual_shortagesテーブルが存在しません:', e.message);
                        }
                    }

                    return withCors(new Response(JSON.stringify({ success: true, date, breaks, shortages }), { 
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                } catch (dbError: any) {
                    console.error('データベースエラー:', dbError);
                    return withCors(new Response(JSON.stringify({ 
                        success: false, 
                        error: dbError.message,
                        details: dbError.toString()
                    }), { 
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                }
            
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