export interface Env {
	DB: D1Database;
}

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
			if (url.pathname === '/api/data' && request.method === 'GET') {
				const month = url.searchParams.get('month');
				if (!month) return withCors(new Response('Month query parameter is required', { status: 400 }));

				const shiftsStmt = env.DB.prepare(`SELECT s.id, s.user_id as userId, u.name as fullName, u.role, s.shift_date as shiftDate, s.time, s.break_time as breakTime, s.notes FROM shifts s JOIN users u ON s.user_id = u.id WHERE strftime('%Y-%m', s.shift_date) = ?`).bind(month);
				const usersStmt = env.DB.prepare('SELECT * FROM users ORDER BY id');
				const manualBreaksStmt = env.DB.prepare("SELECT * FROM manual_breaks WHERE strftime('%Y-%m', shift_date) = ?").bind(month);
				const manualShortagesStmt = env.DB.prepare("SELECT * FROM manual_shortages WHERE strftime('%Y-%m', shift_date) = ?").bind(month);

				const [shiftsResult, usersResult, manualBreaksResult, manualShortagesResult] = await Promise.all([
					shiftsStmt.all(), usersStmt.all(), manualBreaksStmt.all(), manualShortagesStmt.all()
				]);
				const data = {
					users: usersResult.results,
					shifts: (shiftsResult.results || []).reduce<Record<string, any[]>>((acc, shift) => { const date = shift.shiftDate as string; if (!acc[date]) acc[date] = []; acc[date].push(shift); return acc; }, {}),
					manualBreaks: (manualBreaksResult.results || []).reduce((acc, item) => { acc[item.shift_date as string] = item.break_text; return acc; }, {}),
					manualShortages: (manualShortagesResult.results || []).reduce((acc, item) => { acc[item.shift_date as string] = item.shortage_text; return acc; }, {}),
				};
				return withCors(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));

			} else if (url.pathname === '/api/login' && request.method === 'POST') {
                const { username, password } = await request.json<any>();
                if (!username || !password) {
                    return withCors(new Response(JSON.stringify({ success: false, message: 'ユーザーIDとパスワードは必須です。' }), { status: 400, headers: { 'Content-Type': 'application/json' }}));
                }
        
                const stmt = env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username);
                const { results } = await stmt.all();
                
                const user: any = results[0];
        
                if (user && user.password === password) {
                    const { password, ...userToSend } = user;
                    return withCors(new Response(JSON.stringify({ success: true, user: userToSend }), { headers: { 'Content-Type': 'application/json' }}));
                } else {
                    return withCors(new Response(JSON.stringify({ success: false, message: 'IDまたはパスワードが正しくありません。' }), { status: 401, headers: { 'Content-Type': 'application/json' }}));
                }

			} else if (url.pathname === '/api/bulk-update' && request.method === 'POST') {
                const { shifts, manualBreaks, manualShortages } = await request.json<any>();
                const stmts: D1PreparedStatement[] = [];

                if (Array.isArray(shifts) && shifts.length > 0) {
                    const datesToDelete = [...new Set(shifts.map(s => s.date))];
                    if(datesToDelete.length > 0) {
                        const deletePlaceholders = datesToDelete.map(() => '?').join(',');
                        const deleteQuery = `DELETE FROM shifts WHERE shift_date IN (${deletePlaceholders})`;
                        stmts.push(env.DB.prepare(deleteQuery).bind(...datesToDelete));
                    }
                }
                
                if (stmts.length > 0) {
                    await env.DB.batch(stmts);
                    stmts.length = 0; 
                }
                
                if (Array.isArray(shifts)) {
                    for (const shift of shifts) {
                        if (shift.time) {
                            stmts.push(
                                env.DB.prepare('INSERT INTO shifts (user_id, shift_date, time) VALUES (?, ?, ?)')
                                .bind(shift.userId, shift.date, shift.time)
                            );
                        }
                    }
                }

                if (manualBreaks) {
                    for (const [date, text] of Object.entries(manualBreaks)) {
                        stmts.push(env.DB.prepare('INSERT OR REPLACE INTO manual_breaks (shift_date, break_text) VALUES (?, ?)').bind(date, text));
                    }
                }

                if (manualShortages) {
                    for (const [date, text] of Object.entries(manualShortages)) {
                       stmts.push(env.DB.prepare('INSERT OR REPLACE INTO manual_shortages (shift_date, shortage_text) VALUES (?, ?)').bind(date, text));
                    }
                }

                if (stmts.length > 0) {
                    await env.DB.batch(stmts);
                }
                
                return withCors(new Response(JSON.stringify({ success: true, message: 'Bulk update successful' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
            }

			// どのパスにも一致しない場合
			return withCors(new Response('Not Found', { status: 404 }));

		} catch (e: any) {
			console.error("Unhandled Error:", e);
			return withCors(new Response(`Internal Server Error: ${e.message}`, { status: 500 }));
		}
	},
};
