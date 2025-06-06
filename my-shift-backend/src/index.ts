import { Router } from 'itty-router';

export interface Env {
	DB: D1Database;
}

const router = Router();

router.options('*', () => {
	return new Response(null, {
		headers: {
			'Access-Control-Allow-Origin': '*', // すべてのオリジンからのアクセスを許可
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', // 許可するHTTPメソッド
			'Access-Control-Allow-Headers': 'Content-Type, Authorization', // 許可するリクエストヘッダー
		},
	});
});

// 特定の月の全データを取得するAPI
router.get('/api/data', async (request, env: Env) => {
	const { query } = request;
	const month = query.month as string; 

	if (!month) {
		return new Response('Month query parameter is required', { status: 400 });
	}

	try {
		const shiftsStmt = env.DB.prepare(
			`SELECT s.id, s.user_id as userId, u.name as fullName, u.role, s.shift_date as shiftDate, s.time, s.break_time as breakTime, s.notes
			 FROM shifts s JOIN users u ON s.user_id = u.id 
			 WHERE strftime('%Y-%m', s.shift_date) = ?`
		).bind(month);
		
		const usersStmt = env.DB.prepare('SELECT * FROM users ORDER BY id');
		const manualBreaksStmt = env.DB.prepare("SELECT * FROM manual_breaks WHERE strftime('%Y-%m', shift_date) = ?").bind(month);
		const manualShortagesStmt = env.DB.prepare("SELECT * FROM manual_shortages WHERE strftime('%Y-%m', shift_date) = ?").bind(month);

		const [shiftsResult, usersResult, manualBreaksResult, manualShortagesResult] = await Promise.all([
			shiftsStmt.all(),
			usersStmt.all(),
			manualBreaksStmt.all(),
			manualShortagesStmt.all()
		]);

		const data = {
			users: usersResult.results,
			shifts: (shiftsResult.results || []).reduce<Record<string, any[]>>((acc, shift) => {
				const date = shift.shiftDate as string;
				if (!acc[date]) acc[date] = [];
				acc[date].push(shift);
				return acc;
			}, {}),
			manualBreaks: (manualBreaksResult.results || []).reduce((acc, item) => {
				acc[item.shift_date as string] = item.break_text;
				return acc;
			}, {}),
			manualShortages: (manualShortagesResult.results || []).reduce((acc, item) => {
				acc[item.shift_date as string] = item.shortage_text;
				return acc;
			}, {}),
		};

		return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
	} catch (e: any) {
		console.error("D1 Error:", e.message);
		return new Response(e.message, { status: 500 });
	}
});

// シフトを更新/作成/削除するAPI
router.post('/api/shift', async (request, env: Env) => {
    try {
        const { userId, date, time, breakTime, notes } = await request.json<any>();
        if (!userId || !date) return new Response('userId and date are required', { status: 400 });

        await env.DB.prepare('DELETE FROM shifts WHERE user_id = ? AND shift_date = ?').bind(userId, date).run();
        if (time) {
            await env.DB.prepare(
                'INSERT INTO shifts (user_id, shift_date, time, break_time, notes) VALUES (?, ?, ?, ?, ?)'
            ).bind(userId, date, time || null, breakTime || null, notes || null).run();
        }
        return new Response('Shift updated successfully', { status: 200 });
    } catch (e: any) {
        return new Response(e.message, { status: 500 });
    }
});

// 手動入力データを更新するAPI
router.post('/api/manuals', async (request, env: Env) => {
	try {
        const { date, breaks, shortages } = await request.json<any>();
        if (!date) return new Response('Date is required', { status: 400 });
		
		if(breaks !== undefined) {
			await env.DB.prepare('INSERT OR REPLACE INTO manual_breaks (shift_date, break_text) VALUES (?, ?)')
				.bind(date, breaks).run();
		}
		if(shortages !== undefined) {
			await env.DB.prepare('INSERT OR REPLACE INTO manual_shortages (shift_date, shortage_text) VALUES (?, ?)')
				.bind(date, shortages).run();
		}
		return new Response('Manual data updated', { status: 200 });
	} catch (e: any) {
		return new Response(e.message, { status: 500 });
	}
});

// 404 Not Found
router.all('*', () => new Response('404, not found!', { status: 404 }));

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // router.handle() でリクエストを処理し、その応答を取得
        const response = await router.handle(request, env);

        // ★★★ すべての応答にCORSヘッダーを付与する ★★★
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
	},
};
