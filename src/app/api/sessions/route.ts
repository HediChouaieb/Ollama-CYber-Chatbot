import { NextRequest, NextResponse } from 'next/server';
import { getSessions, saveSession, deleteSession } from '@/lib/storage';

export async function GET() {
    try {
        const sessions = await getSessions();
        return NextResponse.json(sessions);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await req.json();
        await saveSession(session);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { id } = await req.json();
        await deleteSession(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
    }
}
