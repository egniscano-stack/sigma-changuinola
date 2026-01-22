import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Paperclip, Image as ImageIcon, Smile, MoreVertical } from 'lucide-react';
import { User, ChatMessage } from '../types';
import { db } from '../services/db';

interface InternalChatProps {
    currentUser: User;
}

export const InternalChat: React.FC<InternalChatProps> = ({ currentUser }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load Initial Messages
    useEffect(() => {
        if (isOpen) {
            db.getMessages().then(msgs => {
                setMessages(msgs);
                setUnreadCount(0); // Mark as read when opened
            });
        }
    }, [isOpen]);

    // Realtime Subscription (Already handled globally in App.tsx potentially, but lets do a local one if we want independent behavior, 
    // OR rely on a prop passed from App. Is cleaner to self-manage here for this specific feature)
    // Actually, App.tsx has the global subscriber. We can duplicate or move it. 
    // Let's do a direct subscription here for simplicity of component isolation.
    useEffect(() => {
        const unsub = db.subscribeToChanges(
            () => { }, () => { }, () => { }, () => { },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new as ChatMessage;
                    setMessages(prev => [...prev, newMsg]);

                    // Notifications
                    if (!isOpen && newMsg.sender_username !== currentUser.username) {
                        setUnreadCount(prev => prev + 1);
                        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); // Distinct chat sound
                        audio.play().catch(e => { });

                        if (Notification.permission === 'granted') {
                            new Notification(`Nuevo mensaje de ${newMsg.sender_name}`, {
                                body: newMsg.content,
                                icon: '/sigma-logo-final.png'
                            });
                        }
                    }
                }
            }
        );
        return () => unsub();
    }, [isOpen, currentUser.username]);


    // Auto-scroll
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);


    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim()) return;

        setIsSending(true);
        try {
            await db.sendMessage({
                sender_username: currentUser.username,
                sender_name: currentUser.name,
                content: newMessage,
                recipient_username: null, // Public channel for now
            });
            setNewMessage('');
            // Optimistic update done via realtime or we can append manually? Realtime is fast enough usually.
        } catch (e) {
            console.error("Failed to send", e);
        } finally {
            setIsSending(false);
        }
    };

    if (currentUser.role === 'ALCALDE') return null; // Explicit double-check security

    return (
        <>
            {/* Floating Button */}
            <div className="fixed bottom-6 right-6 z-50 print:hidden">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`${isOpen ? 'bg-red-500 rotate-90' : 'bg-emerald-600 hover:bg-emerald-700'} text-white p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center`}
                >
                    {isOpen ? <X size={28} /> : <MessageCircle size={32} />}
                    {!isOpen && unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 border-2 border-white text-white text-xs font-bold h-6 w-6 rounded-full flex items-center justify-center animate-bounce">
                            {unreadCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Chat Window */}
            <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl z-50 transition-all duration-300 transform origin-bottom-right border border-slate-200 overflow-hidden flex flex-col ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-10 pointer-events-none'}`} style={{ height: '500px' }}>

                {/* Header */}
                <div className="bg-emerald-800 p-4 text-white flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-full">
                            <MessageCircle size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Chat Interno</h3>
                            <p className="text-[10px] text-emerald-200 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                En línea
                            </p>
                        </div>
                    </div>
                    <button className="text-white/70 hover:text-white">
                        <MoreVertical size={20} />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 bg-[#e5ddd5] p-4 overflow-y-auto custom-scrollbar relative">
                    {/* Background Pattern Mock */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4a5568 2px, transparent 2px)', backgroundSize: '20px 20px' }}></div>

                    {messages.map((msg) => {
                        const isMe = msg.sender_username === currentUser.username;
                        return (
                            <div key={msg.id} className={`flex mb-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] rounded-lg p-2 shadow-sm relative text-sm ${isMe ? 'bg-[#dcf8c6] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                                    {!isMe && <p className="text-[10px] font-bold text-orange-600 mb-1">{msg.sender_name}</p>}
                                    <p className="whitespace-pre-wrap leading-snug">{msg.content}</p>
                                    <p className="text-[9px] text-right mt-1 opacity-50 flex items-center justify-end gap-1">
                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {isMe && <span className="text-blue-500">✓✓</span>}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={handleSend} className="bg-slate-50 p-3 flex items-center gap-2 border-t border-slate-200">
                    <button type="button" className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200">
                        <Paperclip size={20} />
                    </button>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Escribe un mensaje"
                        className="flex-1 bg-white border-none rounded-full px-4 py-2 text-sm focus:ring-0 shadow-sm"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || isSending}
                        className="bg-emerald-600 text-white p-2 rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 transition-all"
                    >
                        <Send size={18} className={isSending ? 'animate-pulse' : ''} />
                    </button>
                </form>

            </div>
        </>
    );
};
