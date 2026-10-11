'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Copy, Check, Plus, MessageSquare, Trash2, Menu, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    createdAt: string;
}

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
    const [copied, setCopied] = useState(false);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group my-4 rounded-xl overflow-hidden border border-slate-700/50 bg-[#1e1e1e] shadow-2xl">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{language || 'code'}</span>
                <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-xs font-medium"
                >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <SyntaxHighlighter
                language={language}
                style={vscDarkPlus}
                customStyle={{
                    margin: 0,
                    padding: '1.5rem',
                    fontSize: '0.875rem',
                    background: 'transparent',
                }}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    );
};

export default function Home() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: "Hello! I'm Llama, your AI assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load sessions on mount
    useEffect(() => {
        fetch('/api/sessions')
            .then(res => res.json())
            .then(data => {
                setSessions(data);
                if (data.length > 0) {
                    switchToSession(data[0]);
                }
            });
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const saveCurrentSession = useCallback(async (msgs: Message[]) => {
        if (!currentSessionId) return;

        const title = msgs.find(m => m.role === 'user')?.content.substring(0, 30) || 'New Chat';
        const sessionData: ChatSession = {
            id: currentSessionId,
            title,
            messages: msgs,
            createdAt: new Date().toISOString()
        };

        await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
        });

        // Update local list
        setSessions(prev => {
            const index = prev.findIndex(s => s.id === currentSessionId);
            if (index !== -1) {
                const updated = [...prev];
                updated[index] = sessionData;
                return updated;
            }
            return [sessionData, ...prev];
        });
    }, [currentSessionId]);

    const startNewSession = () => {
        const id = Math.random().toString(36).substring(7);
        setCurrentSessionId(id);
        setMessages([{ role: 'assistant', content: "Hello! I'm Llama, your AI assistant. How can I help you today?" }]);
        setIsSidebarOpen(false);
    };

    const switchToSession = (session: ChatSession) => {
        setCurrentSessionId(session.id);
        setMessages(session.messages);
        setIsSidebarOpen(false);
    };

    const deleteSessionById = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await fetch('/api/sessions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) {
            startNewSession();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        let sessionId = currentSessionId;
        // Initialize ID if first message
        if (!sessionId) {
            sessionId = Math.random().toString(36).substring(7);
            setCurrentSessionId(sessionId);
        }

        const userMsg = input.trim();
        setInput('');
        const updatedMsgs: Message[] = [...messages, { role: 'user', content: userMsg }];
        setMessages(updatedMsgs);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updatedMsgs }),
            });

            if (!response.ok) throw new Error('Failed to fetch');

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';

            const finalMsgs: Message[] = [...updatedMsgs, { role: 'assistant', content: '' }];
            setMessages(finalMsgs);

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
                    } catch (e) { }
                }
            }

            const finalSessionMsgs: Message[] = [...updatedMsgs, { role: 'assistant', content: assistantContent }];
            const title = finalSessionMsgs.find(m => m.role === 'user')?.content.substring(0, 30) || 'New Chat';
            const sessionData: ChatSession = {
                id: sessionId!,
                title,
                messages: finalSessionMsgs,
                createdAt: new Date().toISOString()
            };

            await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData)
            });

            // Update local list
            setSessions(prev => {
                const index = prev.findIndex(s => s.id === sessionId);
                if (index !== -1) {
                    const updated = [...prev];
                    updated[index] = sessionData;
                    return updated;
                }
                return [sessionData, ...prev];
            });

        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to Ollama.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="flex h-screen bg-slate-950 text-slate-50 overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed lg:static inset-y-0 left-0 w-80 bg-slate-900 border-r border-slate-800/60 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col shadow-2xl shadow-black",
                isSidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="p-6">
                    <button
                        onClick={startNewSession}
                        className="w-full h-12 flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-semibold transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                    >
                        <Plus size={20} />
                        New session
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                    <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-4">Recent chats</div>
                    {sessions.map((s) => (
                        <div
                            key={s.id}
                            onClick={() => switchToSession(s)}
                            className={cn(
                                "group relative flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer transition-all border border-transparent",
                                currentSessionId === s.id
                                    ? "bg-indigo-600/10 border-indigo-500/30 text-indigo-100"
                                    : "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                            )}
                        >
                            <MessageSquare size={18} className={currentSessionId === s.id ? "text-indigo-400" : ""} />
                            <span className="flex-1 truncate text-sm font-medium">{s.title}</span>
                            <button
                                onClick={(e) => deleteSessionById(s.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-red-400 transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-6 border-t border-slate-800/60 bg-slate-900/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-800 flex items-center justify-center text-slate-300 font-bold border border-slate-700">
                            U
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-200 truncate">Settings</p>
                            <p className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-widest">Llama User</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative">
                {/* Header */}
                <header className="h-20 border-b border-slate-800/60 bg-slate-900/40 backdrop-blur-xl flex items-center justify-between px-8 absolute top-0 left-0 right-0 z-10">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="lg:hidden p-2.5 hover:bg-slate-800 rounded-xl transition-colors text-slate-400"
                        >
                            <Menu size={24} />
                        </button>
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                <Bot size={24} className="text-white" />
                            </div>
                            <h2 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Llama AI</h2>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 px-4 py-1.5 bg-slate-800/40 rounded-full border border-slate-700/50">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Ready</span>
                    </div>
                </header>

                {/* Messages Container */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto px-6 lg:px-24 pt-32 pb-40 space-y-12 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
                >
                    <div className="max-w-4xl mx-auto space-y-12">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={cn(
                                    "flex gap-6 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out",
                                    msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xl",
                                    msg.role === 'user' ? "bg-slate-800 text-indigo-400 border border-slate-700" : "bg-indigo-600 text-white"
                                )}>
                                    {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                                </div>
                                <div className={cn(
                                    "max-w-[85%] group relative",
                                    msg.role === 'user' ? "text-right" : "text-left"
                                )}>
                                    <div className={cn(
                                        "inline-block rounded-3xl text-[1rem] leading-relaxed transition-all duration-300",
                                        msg.role === 'user'
                                            ? "bg-indigo-600 text-white px-7 py-4.5 rounded-tr-none shadow-xl shadow-indigo-600/10 hover:shadow-indigo-600/20"
                                            : "bg-transparent text-slate-200 w-full"
                                    )}>
                                        {msg.role === 'assistant' ? (
                                            <div className="prose prose-invert prose-indigo max-w-none prose-pre:bg-transparent prose-pre:p-0 prose-code:text-indigo-300 prose-p:leading-relaxed prose-strong:text-white">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ node, inline, className, children, ...props }: any) {
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            return !inline && match ? (
                                                                <CodeBlock
                                                                    language={match[1]}
                                                                    value={String(children).replace(/\n$/, '')}
                                                                />
                                                            ) : (
                                                                <code className={cn("bg-slate-800/60 px-2 py-0.5 rounded-lg text-sm font-semibold border border-slate-700/50 text-indigo-300", className)} {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        }
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            msg.content
                                        )}
                                        {isLoading && i === messages.length - 1 && msg.content && (
                                            <span className="inline-block w-2 h-5 ml-2 bg-indigo-500 animate-pulse align-middle rounded-full" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Input Area */}
                <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-12 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent">
                    <div className="max-w-4xl mx-auto relative group">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            placeholder="Message Llama AI..."
                            className="w-full bg-slate-900/60 border border-slate-700/50 rounded-[32px] px-8 py-5.5 pr-16 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all resize-none shadow-2xl backdrop-blur-xl"
                            rows={1}
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed hover:bg-indigo-500 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-600/30 group-focus-within:ring-2 ring-indigo-400/20"
                        >
                            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={20} />}
                        </button>
                    </div>
                    <div className="mt-4 flex justify-center gap-6">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">Local Data Persistent</p>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">Llama 3 Powered</p>
                    </div>
                </div>
            </div>
        </main>
    );
}
