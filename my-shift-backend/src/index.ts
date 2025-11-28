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
                        s.id, s.user_id as userId, 
                        COALESCE(u.name, '') as fullName, 
                        COALESCE(u.role, '') as role, 
                        s.shift_date as shiftDate, 
                        s.time, 
                        s.break_time as breakTime, 
                        s.notes 
                    FROM 
                        shifts s LEFT JOIN users u ON s.user_id = u.id 
                    WHERE 
                        strftime('%Y-%m', s.shift_date) = ?
                    ORDER BY s.shift_date, s.user_id
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
                    // break_timeがNULL、空文字列、undefinedの場合も処理する
                    const breakTime = shift.breakTime;
                    if (!manualBreaks[date] && breakTime !== null && breakTime !== undefined) {
                        // 空文字列も含めて保存
                        manualBreaks[date] = breakTime || '';
                    }
                });
                console.log('shiftsResult.results:', shiftsResult.results);
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

            // ✅ シフト希望提出用のパス
            } else if (url.pathname === '/api/submit-shift-wish' && request.method === 'POST') {
                const { userId, shiftDate, time, periodType, periodYear, periodMonth } = await request.json<any>();
                if (!userId || !shiftDate || !periodType || !periodYear || !periodMonth) {
                    return withCors(new Response('userId, shiftDate, periodType, periodYear, and periodMonth are required', { status: 400 }));
                }

                // 提出期間の検証
                const date = new Date(shiftDate + 'T00:00:00');
                const day = date.getDate();
                const isValidPeriod = 
                    (periodType === 'first_half' && day >= 1 && day <= 15) ||
                    (periodType === 'second_half' && day >= 16);
                
                if (!isValidPeriod) {
                    return withCors(new Response(JSON.stringify({ 
                        success: false, 
                        error: '提出期間が正しくありません。前半期間は1-15日、後半期間は16日以降です。' 
                    }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
                }

                try {
                    // 既存の提出を更新、なければ新規作成
                    await env.DB.prepare(`
                        INSERT OR REPLACE INTO shift_wishes 
                        (user_id, shift_date, time, period_type, period_year, period_month, status, submitted_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now', 'localtime'))
                    `).bind(userId, shiftDate, time || null, periodType, periodYear, periodMonth).run();
                    
                    return withCors(new Response(JSON.stringify({ success: true }), { 
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                } catch (error: any) {
                    console.error('シフト希望提出エラー:', error);
                    return withCors(new Response(JSON.stringify({ 
                        success: false, 
                        error: error.message 
                    }), { 
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                }

            // ✅ シフト希望取得用のパス
            } else if (url.pathname === '/api/shift-wishes' && request.method === 'GET') {
                const userId = url.searchParams.get('userId');
                const periodType = url.searchParams.get('periodType');
                const periodYear = url.searchParams.get('periodYear');
                const periodMonth = url.searchParams.get('periodMonth');
                const status = url.searchParams.get('status');

                let query = 'SELECT sw.*, u.name as userName FROM shift_wishes sw LEFT JOIN users u ON sw.user_id = u.id WHERE 1=1';
                const params: any[] = [];

                if (userId) {
                    query += ' AND sw.user_id = ?';
                    params.push(userId);
                }
                if (periodType) {
                    query += ' AND sw.period_type = ?';
                    params.push(periodType);
                }
                if (periodYear) {
                    query += ' AND sw.period_year = ?';
                    params.push(periodYear);
                }
                if (periodMonth) {
                    query += ' AND sw.period_month = ?';
                    params.push(periodMonth);
                }
                if (status) {
                    query += ' AND sw.status = ?';
                    params.push(status);
                }

                query += ' ORDER BY sw.shift_date, sw.user_id';

                try {
                    const stmt = env.DB.prepare(query);
                    if (params.length > 0) {
                        const result = await stmt.bind(...params).all();
                        return withCors(new Response(JSON.stringify({ success: true, wishes: result.results }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        }));
                    } else {
                        const result = await stmt.all();
                        return withCors(new Response(JSON.stringify({ success: true, wishes: result.results }), {
                            status: 200,
                            headers: { 'Content-Type': 'application/json' }
                        }));
                    }
                } catch (error: any) {
                    console.error('シフト希望取得エラー:', error);
                    return withCors(new Response(JSON.stringify({ 
                        success: false, 
                        error: error.message 
                    }), { 
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                }

            // ✅ シフト希望承認用のパス（shiftsテーブルに反映）
            } else if (url.pathname === '/api/approve-shift-wish' && request.method === 'POST') {
                const { wishId } = await request.json<any>();
                if (!wishId) {
                    return withCors(new Response('wishId is required', { status: 400 }));
                }

                try {
                    // シフト希望を取得
                    const wishResult = await env.DB.prepare('SELECT * FROM shift_wishes WHERE id = ?').bind(wishId).first();
                    if (!wishResult) {
                        return withCors(new Response(JSON.stringify({ 
                            success: false, 
                            error: 'シフト希望が見つかりません' 
                        }), { 
                            status: 404,
                            headers: { 'Content-Type': 'application/json' }
                        }));
                    }

                    const wish: any = wishResult;

                    // shiftsテーブルに反映
                    if (wish.time) {
                        await env.DB.prepare('DELETE FROM shifts WHERE user_id = ? AND shift_date = ?')
                            .bind(wish.user_id, wish.shift_date).run();
                        await env.DB.prepare('INSERT INTO shifts (user_id, shift_date, time) VALUES (?, ?, ?)')
                            .bind(wish.user_id, wish.shift_date, wish.time).run();
                    }

                    // シフト希望のステータスを更新
                    await env.DB.prepare('UPDATE shift_wishes SET status = ?, approved_at = datetime(\'now\', \'localtime\') WHERE id = ?')
                        .bind('approved', wishId).run();

                    return withCors(new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                } catch (error: any) {
                    console.error('シフト希望承認エラー:', error);
                    return withCors(new Response(JSON.stringify({ 
                        success: false, 
                        error: error.message 
                    }), { 
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                }

            // ✅ シフト希望却下用のパス
            } else if (url.pathname === '/api/reject-shift-wish' && request.method === 'POST') {
                const { wishId } = await request.json<any>();
                if (!wishId) {
                    return withCors(new Response('wishId is required', { status: 400 }));
                }

                try {
                    await env.DB.prepare('UPDATE shift_wishes SET status = ? WHERE id = ?')
                        .bind('rejected', wishId).run();

                    return withCors(new Response(JSON.stringify({ success: true }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                } catch (error: any) {
                    console.error('シフト希望却下エラー:', error);
                    return withCors(new Response(JSON.stringify({ 
                        success: false, 
                        error: error.message 
                    }), { 
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }));
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