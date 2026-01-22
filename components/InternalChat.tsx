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

    // Private Chat State
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null); // null = General

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load Initial Messages & Users
    useEffect(() => {
        if (isOpen) {
            // Load Messages
            db.getMessages().then(msgs => {
                setMessages(msgs);
                setUnreadCount(0); // Mark as read when opened
            });

            // Load Users for private chat
            db.getAppUsers().then(users => {
                // Filter out self and Alcalde
                const others = users.filter(u => u.username !== currentUser.username && u.role !== 'ALCALDE');
                setAvailableUsers(others);
            });
        }
    }, [isOpen, currentUser.username]);

    // Realtime Subscription
    useEffect(() => {
        const unsub = db.subscribeToChanges(
            () => { }, () => { }, () => { }, () => { },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new as ChatMessage;
                    setMessages(prev => [...prev, newMsg]);

                    // Notifications logic
                    const isForMe = newMsg.recipient_username === currentUser.username;
                    const isGeneral = newMsg.recipient_username === null;

                    if (!isOpen && newMsg.sender_username !== currentUser.username) {
                        if (isForMe || isGeneral) {
                            setUnreadCount(prev => prev + 1);
                            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
                            audio.play().catch(e => { });

                            if (Notification.permission === 'granted') {
                                new Notification(`Mensaje de ${newMsg.sender_name}`, {
                                    body: newMsg.content,
                                    icon: '/sigma-logo-final.png'
                                });
                            }
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
    }, [messages, isOpen, selectedRecipient]); // Scroll when switching chats too


    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim()) return;

        setIsSending(true);
        try {
            await db.sendMessage({
                sender_username: currentUser.username,
                sender_name: currentUser.name,
                content: newMessage,
                recipient_username: selectedRecipient, // Use selected recipient (or null for General)
            });
            setNewMessage('');
            // Optimistic update handled by realtime or we could manually append here for instant feedback
        } catch (e) {
            console.error("Failed to send", e);
            alert("Error al enviar mensaje. Posiblemente la tabla de chat no existe en la base de datos.");
        } finally {
            setIsSending(false);
        }
    };

    // Filter messages for current view
    const activeMessages = messages.filter(msg => {
        if (selectedRecipient) {
            // Private Conversation: (Me -> Them) OR (Them -> Me)
            return (msg.sender_username === currentUser.username && msg.recipient_username === selectedRecipient) ||
                (msg.sender_username === selectedRecipient && msg.recipient_username === currentUser.username);
        } else {
            // General Chat: recipient is null
            return msg.recipient_username === null;
        }
    });

    if (currentUser.role === 'ALCALDE') return null;

    return (
        <>
            {/* Floating Button */}
            <div className="fixed bottom-6 right-6 z-[100] print:hidden">
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
            <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl z-[100] transition-all duration-300 transform origin-bottom-right border border-slate-200 overflow-hidden flex flex-col ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-10 pointer-events-none'}`} style={{ height: '500px' }}>

                {/* Header with Recipient Selector */}
                <div className="bg-emerald-800 p-3 text-white shadow-md z-10">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-full">
                                <MessageCircle size={18} />
                            </div>
                            <h3 className="font-bold text-sm">Chat del Equipo</h3>
                        </div>
                    </div>

                    {/* User Selector */}
                    <select
                        value={selectedRecipient || ''}
                        onChange={(e) => setSelectedRecipient(e.target.value || null)}
                        className="w-full bg-emerald-900/50 border border-emerald-600 text-white text-sm rounded-lg p-2 focus:ring-1 focus:ring-emerald-400 outline-none"
                    >
                        <option value="">📢 Canal General</option>
                        <optgroup label="Mensaje Privado a:">
                            {availableUsers.map(u => (
                                <option key={u.username} value={u.username}>
                                    👤 {u.name} ({u.role})
                                </option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                {/* Messages Area */}
                <div className="flex-1 bg-[#e5ddd5] p-4 overflow-y-auto custom-scrollbar relative">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4a5568 2px, transparent 2px)', backgroundSize: '20px 20px' }}></div>

                    {activeMessages.length === 0 && (
                        <div className="text-center text-slate-400 text-xs mt-10">
                            <p>No hay mensajes en esta conversación.</p>
                            <p>¡Sé el primero en escribir!</p>
                        </div>
                    )}

                    {activeMessages.map((msg) => {
                        const isMe = msg.sender_username === currentUser.username;
                        // Differentiate Private vs Public visually
                        const isPrivate = msg.recipient_username !== null;

                        return (
                            <div key={msg.id} className={`flex mb-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg p-2 shadow-sm relative text-sm ${isMe
                                    ? (isPrivate ? 'bg-[#e3f2fd] text-slate-800' : 'bg-[#dcf8c6] text-slate-800') // Blue tint for private sent, Green for general
                                    : 'bg-white text-slate-800'
                                    } ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}`}>

                                    {!isMe && (
                                        <div className="flex items-baseline justify-between gap-2 mb-1">
                                            <p className="text-[10px] font-bold text-orange-600">{msg.sender_name}</p>
                                            {/* Show role if useful */}
                                        </div>
                                    )}

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
                    <button type="button" className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200" title="Adjuntar Archivo (Demo)">
                        <Paperclip size={20} />
                    </button>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={selectedRecipient ? `Mensaje privado...` : `Escribe a todos...`}
                        className="flex-1 bg-white border-none rounded-full px-4 py-2 text-sm focus:ring-0 shadow-sm"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim() || isSending}
                        className={`${isSending ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'} text-white p-2.5 rounded-full shadow-md transform active:scale-95 transition-all flex items-center justify-center`}
                    >
                        <Send size={18} />
                    </button>
                </form>

            </div>
        </>
    );
};
