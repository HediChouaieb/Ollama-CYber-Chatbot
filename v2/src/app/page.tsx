'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function Home() {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm Llama, your AI assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', content: userMessage }],
                }),
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';

            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            while (true) {
                const { done, value } = await reader!.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.message?.content) {
                            assistantContent += data.message.content;
                            setMessages(prev => {
                                const newMessages = [...prev];
                                newMessages[newMessages.length - 1].content = assistantContent;
                                return newMessages;
                            });
                        }
                    } catch (e) {
                        // Might be a partial JSON chunk, ignore or handle
                    }
                }
            }
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to Ollama.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-24 bg-slate-950 text-slate-50">
            <div className="z-10 w-full max-w-4xl h-[80vh] flex flex-col bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-bottom border-slate-800 flex justify-between items-center bg-slate-900/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Bot size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Llama Chat</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                                <span className="text-xs text-slate-400 font-medium">Ollama Active</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chat Area */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
                >
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                "flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                            )}
                        >
                            <div className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 shadow-md",
                                msg.role === 'user' ? "bg-slate-700 text-slate-200" : "bg-indigo-600 text-white"
                            )}>
                                {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                            </div>
                            <div className={cn(
                                "max-w-[80%] px-5 py-3.5 rounded-2xl text-[0.95rem] leading-relaxed shadow-sm",
                                msg.role === 'user'
                                    ? "bg-indigo-600 text-white rounded-tr-none"
                                    : "bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-tl-none backdrop-blur-sm"
                            )}>
                                {msg.content || (isLoading && i === messages.length - 1 ? <Loader2 size={18} className="animate-spin text-slate-400" /> : '')}
                                {isLoading && i === messages.length - 1 && msg.content && <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-6 bg-slate-900/80 border-t border-slate-800">
                    <form onSubmit={handleSubmit} className="relative group">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            placeholder="Message Llama..."
                            className="w-full bg-slate-950/50 border border-slate-700/50 rounded-2xl px-5 py-4 pr-14 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all resize-none group-hover:border-slate-600/50"
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                    <p className="text-[10px] text-center text-slate-500 mt-3 font-medium uppercase tracking-wider">
                        Powered by Ollama • Llama 3
                    </p>
                </div>
            </div>
        </main>
    );
}
