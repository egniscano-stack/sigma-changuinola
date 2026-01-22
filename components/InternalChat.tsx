import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Paperclip, Image as ImageIcon, FileText, MoreVertical, Download } from 'lucide-react';
import { User, ChatMessage } from '../types';
import { db } from '../services/db';

interface InternalChatProps {
    currentUser: User;
    isOpen: boolean;
    onClose: () => void;
    onUnreadChange: (count: number) => void;
    onShowToast: (toast: { title: string, message: string }) => void;
}

export const InternalChat: React.FC<InternalChatProps> = ({ currentUser, isOpen, onClose, onUnreadChange, onShowToast }) => {
    // const [isOpen, setIsOpen] = useState(false); // Controlled by Parent
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    // State for Unread Counts per Layout
    const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

    // Private Chat State
    const [availableUsers, setAvailableUsers] = useState<User[]>([]);
    const [selectedRecipient, setSelectedRecipient] = useState<string | null>(null); // null = General

    // ... (File attachment state lines 25-26 keep same)
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<{ name: string, data: string, type: 'image' | 'file' } | null>(null);

    // In-App Notification State (Keep local for now, but we will mostly use the global one)
    const [chatToast, setChatToast] = useState<{ sender: string, text: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Helper: Update Global Count
    const updateGlobalCount = (counts: Record<string, number>) => {
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        onUnreadChange(total);
    };

    // When switching recipient, clear their unread
    useEffect(() => {
        if (isOpen && selectedRecipient) {
            setUnreadCounts(prev => {
                const newCounts = { ...prev, [selectedRecipient]: 0 };
                updateGlobalCount(newCounts);
                return newCounts;
            });
            // TODO: Mark as read in DB if possible
        } else if (isOpen && selectedRecipient === null) {
            // General chat cleared
            setUnreadCounts(prev => {
                const newCounts = { ...prev, 'general': 0 };
                updateGlobalCount(newCounts);
                return newCounts;
            });
        }
    }, [selectedRecipient, isOpen]);

    // Load Initial Messages & Users
    useEffect(() => {
        // Load Messages
        db.getMessages().then(msgs => {
            setMessages(msgs);

            // Calculate initial unreads (simple logic: count messages not from me, assuming all loaded are 'unread' if we don't have local persistent state, 

            const initialCounts: Record<string, number> = {};
            msgs.forEach(m => {
                // If message is NOT from me 
                if (m.sender_username !== currentUser.username) {
                    // Logic: If I haven't read it? 
                    // Since we don't have per-user 'read' status in this simple implementation widely used, 
                    // we will assume initially 0 unread unless we persist it.
                    // But for the sake of the demo, let's assume 'is_read' is valid.
                    if (m.is_read === false) {
                        const countKey = m.recipient_username ? m.sender_username : 'general';
                        initialCounts[countKey] = (initialCounts[countKey] || 0) + 1;
                    }
                }
            });
            setUnreadCounts(initialCounts);
            updateGlobalCount(initialCounts);
        });

        // Load Users
        db.getAppUsers().then(users => {
            const others = users.filter(u => u.username !== currentUser.username && u.role !== 'ALCALDE');
            setAvailableUsers(others);
        });
    }, [currentUser.username]);

    // Realtime Subscription
    useEffect(() => {
        const unsub = db.subscribeToChanges(
            () => { }, () => { }, () => { }, () => { },
            (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new as ChatMessage;
                    setMessages(prev => [...prev, newMsg]);

                    if (newMsg.sender_username !== currentUser.username) {
                        const isForMe = newMsg.recipient_username === currentUser.username;
                        const isGeneral = newMsg.recipient_username === null;

                        const countKey = isForMe ? newMsg.sender_username : (isGeneral ? 'general' : null);

                        if (countKey) {
                            // Only increment if we are NOT viewing this conversation
                            const isViewingThisRoom = isOpen && (
                                (countKey === 'general' && selectedRecipient === null) ||
                                (countKey === newMsg.sender_username && selectedRecipient === newMsg.sender_username)
                            );

                            if (!isViewingThisRoom) {
                                setUnreadCounts(prev => {
                                    const next = { ...prev, [countKey]: (prev[countKey] || 0) + 1 };
                                    updateGlobalCount(next);
                                    return next;
                                });

                                // Play Sound
                                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
                                audio.play().catch(e => console.log(e));

                                // GLOBAL TOAST NOTIFICATION (Request Style)
                                onShowToast({
                                    title: 'Nuevo Mensaje de Chat',
                                    message: `${newMsg.sender_name || 'Usuario'} dice: ${newMsg.content || '📎 Archivo adjunto'}`
                                });

                                // OS Notification
                                if (Notification.permission === 'granted') {
                                    new Notification(`Nuevo mensaje de ${newMsg.sender_name}`, {
                                        body: newMsg.content || '📎 Archivo adjunto',
                                        icon: '/sigma-logo-final.png'
                                    });
                                }
                            }
                        }
                    }
                }
            }
        );
        return () => unsub();
    }, [isOpen, currentUser.username, selectedRecipient]);


    // Auto-scroll
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, selectedRecipient]);

    // Handle File Selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];

            // Size limit: 3MB
            if (file.size > 3 * 1024 * 1024) {
                alert("El archivo es demasiado grande (Máx 3MB)");
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    const isImage = file.type.startsWith('image/');
                    setSelectedFile({
                        name: file.name,
                        data: event.target.result as string,
                        type: isImage ? 'image' : 'file'
                    });
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const [isSending, setIsSending] = useState(false); // New state for sending status

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim() && !selectedFile) return;

        setIsSending(true);
        try {
            await db.sendMessage({
                sender_username: currentUser.username,
                sender_name: currentUser.name,
                content: newMessage,
                recipient_username: selectedRecipient,
                attachment_url: selectedFile?.data,
                attachment_type: selectedFile?.type
            });
            setNewMessage('');
            setSelectedFile(null);
        } catch (e) {
            console.error("Failed to send", e);
            alert("Error al enviar. Verifica tu conexión.");
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
            {/* TOAST POPUP */}
            {!isOpen && chatToast && (
                <div
                    className="fixed bottom-24 right-6 z-[100] bg-white p-3 rounded-lg shadow-xl border-l-4 border-emerald-500 mb-2 cursor-pointer animate-slide-in-right max-w-xs"
                >
                    <div className="flex items-center gap-2 mb-1">
                        <MessageCircle size={16} className="text-emerald-600" />
                        <span className="font-bold text-xs text-slate-700">{chatToast.sender} dice:</span>
                    </div>
                    <p className="text-xs text-slate-600 truncate">{chatToast.text}</p>
                </div>
            )}

            {/* Chat Window */}
            <div className={`fixed bottom-24 right-6 w-80 md:w-96 bg-white rounded-2xl shadow-2xl z-[100] transition-all duration-300 transform origin-bottom-right border border-slate-200 overflow-hidden flex flex-col ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-75 opacity-0 translate-y-10 pointer-events-none'}`} style={{ height: '520px' }}>

                {/* Header */}
                <div className="bg-emerald-800 p-3 text-white shadow-md z-10">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-full">
                                <MessageCircle size={18} />
                            </div>
                            <h3 className="font-bold text-sm">Chat del Equipo</h3>
                        </div>
                        <button onClick={onClose} className="md:hidden">
                            <X size={18} />
                        </button>
                    </div>

                    <select
                        value={selectedRecipient || ''}
                        onChange={(e) => setSelectedRecipient(e.target.value || null)}
                        className="w-full bg-emerald-900/50 border border-emerald-600 text-white text-sm rounded-lg p-2 focus:ring-1 focus:ring-emerald-400 outline-none"
                    >
                        <option value="">
                            📢 Canal General {unreadCounts['general'] ? `(${unreadCounts['general']})` : ''}
                        </option>
                        <optgroup label="Mensaje Privado a:">
                            {availableUsers.map(u => (
                                <option key={u.username} value={u.username}>
                                    👤 {u.name} {unreadCounts[u.username] ? `(${unreadCounts[u.username]})` : ''}
                                </option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                {/* Messages Area */}
                <div className="flex-1 bg-[#e5ddd5] p-4 overflow-y-auto custom-scrollbar relative">
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4a5568 2px, transparent 2px)', backgroundSize: '20px 20px' }}></div>

                    {activeMessages.length === 0 && (
                        <div className="text-center text-slate-400 text-xs mt-10">
                            <p>No hay mensajes aquí.</p>
                        </div>
                    )}

                    {activeMessages.map((msg) => {
                        const isMe = msg.sender_username === currentUser.username;
                        const isPrivate = msg.recipient_username !== null;

                        return (
                            <div key={msg.id} className={`flex mb-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] rounded-lg p-2 shadow-sm relative text-sm ${isMe
                                    ? (isPrivate ? 'bg-[#e3f2fd] text-slate-800' : 'bg-[#dcf8c6] text-slate-800')
                                    : 'bg-white text-slate-800'
                                    } ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}`}>

                                    {!isMe && (
                                        <div className="flex items-baseline justify-between gap-2 mb-1">
                                            <p className="text-[10px] font-bold text-orange-600">{msg.sender_name}</p>
                                        </div>
                                    )}

                                    {/* CONTENT */}
                                    {msg.content && <p className="whitespace-pre-wrap leading-snug">{msg.content}</p>}

                                    {/* ATTACHMENTS */}
                                    {msg.attachment_url && (
                                        <div className="mt-2 mb-1">
                                            {msg.attachment_type === 'image' ? (
                                                <div className="relative group inline-block">
                                                    <img src={msg.attachment_url} alt="adjunto" className="rounded-lg max-h-40 object-cover border border-slate-200" />
                                                    <a
                                                        href={msg.attachment_url}
                                                        download={`imagen_${msg.id.slice(0, 5)}.png`}
                                                        className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-sm"
                                                        title="Descargar Imagen"
                                                    >
                                                        <Download size={16} />
                                                    </a>
                                                </div>
                                            ) : (
                                                <a href={msg.attachment_url} download={`archivo_${msg.id.slice(0, 5)}`} className="flex items-center gap-2 bg-slate-100 p-2 rounded-md hover:bg-slate-200 transition-colors text-xs font-semibold text-slate-700">
                                                    <FileText size={16} className="text-red-500" />
                                                    Descargar Archivo
                                                    <Download size={14} className="ml-auto opacity-50" />
                                                </a>
                                            )}
                                        </div>
                                    )}

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
                <form onSubmit={handleSend} className="bg-slate-50 p-2 flex flex-col gap-2 border-t border-slate-200">
                    {/* File Preview */}
                    {selectedFile && (
                        <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                            <div className="flex items-center gap-2 overflow-hidden">
                                {selectedFile.type === 'image' ? <ImageIcon size={14} className="text-purple-500" /> : <FileText size={14} className="text-blue-500" />}
                                <span className="truncate max-w-[150px]">{selectedFile.name}</span>
                            </div>
                            <button type="button" onClick={() => setSelectedFile(null)} className="text-red-500 hover:bg-red-50 rounded-full p-1">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                            onChange={handleFileSelect}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors"
                            title="Adjuntar Imagen o Documento"
                        >
                            <Paperclip size={20} />
                        </button>

                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            className="flex-1 bg-white border-none rounded-full px-4 py-2 text-sm focus:ring-0 shadow-sm"
                        />
                        <button
                            type="submit"
                            disabled={(!newMessage.trim() && !selectedFile) || isSending}
                            className={`${isSending ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'} text-white p-2.5 rounded-full shadow-md transform active:scale-95 transition-all flex items-center justify-center`}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </form>

            </div>
        </>
    );
};
