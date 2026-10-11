import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'chats.json');

export interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
}

function ensureDataFile() {
    const dir = path.dirname(DATA_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify([]));
    }
}

export async function getSessions(): Promise<ChatSession[]> {
    try {
        ensureDataFile();
        const data = fs.readFileSync(DATA_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading sessions:', error);
        return [];
    }
}

export async function saveSession(session: ChatSession) {
    try {
        const sessions = await getSessions();
        const index = sessions.findIndex(s => s.id === session.id);

        if (index !== -1) {
            sessions[index] = session;
        } else {
            sessions.unshift(session);
        }

        fs.writeFileSync(DATA_PATH, JSON.stringify(sessions, null, 2));
        console.log(`Session ${session.id} saved successfully.`);
    } catch (error) {
        console.error('Error saving session:', error);
        throw error;
    }
}

export async function deleteSession(id: string) {
    try {
        const sessions = await getSessions();
        const filtered = sessions.filter(s => s.id !== id);
        fs.writeFileSync(DATA_PATH, JSON.stringify(filtered, null, 2));
        console.log(`Session ${id} deleted successfully.`);
    } catch (error) {
        console.error('Error deleting session:', error);
        throw error;
    }
}
