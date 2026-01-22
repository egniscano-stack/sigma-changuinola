import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Paperclip, Image as ImageIcon, FileText, MoreVertical, Download } from 'lucide-react';
import { User, ChatMessage } from '../types';
import { db } from '../services/db';

interface InternalChatProps {
    currentUser: User;
    isOpen: boolean;
    onClose: () => void;
    onUnreadChange: (count: number) => void;
}

export const InternalChat: React.FC<InternalChatProps> = ({ currentUser, isOpen, onClose, onUnreadChange }) => {
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

    // In-App Notification State
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
            // BUT for a better UX let's start at 0 or use the 'is_read' from DB if implemented. 
            // The DB has is_read. We can use it!

            const initialCounts: Record<string, number> = {};
            msgs.forEach(m => {
                if (m.sender_username !== currentUser.username && m.is_read === false) {
                    const key = m.sender_username; // For general messages, maybe distinguishing is hard if recipient is null? 
                    // Actually if recipient is null, it is General.
                    const finalKey = m.recipient_username ? m.sender_username : 'general';
                    initialCounts[finalKey] = (initialCounts[finalKey] || 0) + 1;
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

                        // Determine conversation context
                        // If it's private, key is sender. If general, key is 'general'.
                        const countKey = isForMe ? newMsg.sender_username : (isGeneral ? 'general' : null);

                        if (countKey) {
                            // Only increment if chat is closed OR (chat is open BUT we are looking at a different room)
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

                                // Notification Toast
                                setChatToast({
                                    sender: newMsg.sender_name,
                                    text: newMsg.content || '📎 Archivo adjunto'
                                });
                                setTimeout(() => setChatToast(null), 5000);
                            }
                        }
                    }
                }
            }
        );
        return () => unsub();
    }, [isOpen, currentUser.username, selectedRecipient]); // Added selectedRecipient dependence

    // ... (Auto scroll and others remain) ...
    // ... (Render changes to Dropdown below) ...

    // [KEEP REST OF LOGIC UNCHANGED UNTIL RETURN STATEMENT] 

    // We need to construct the Replacement carefully. 
    // I am replacing from line 17 to line 223 (header). 
    // No, I should effectively replace the state definitions and the useEffects, and the Render method.
    // The previous `view_file` shows the structure.

    // I will use a larger replacement to ensure logic consistency.
    // I need to include `handleFileSelect`, `handleSend` etc. 
    // Or I can target specific blocks. 
    // Block 1: State + Effects.
    // Block 2: The select in Render.

    // Let's replace the whole upper part of the component logic first.

    // ... (omitted) ...

    // Wait, I can't split easily because of the closed scope variables. I will replace lines 17 through 103 (Hooks) then modify Render separate?
    // Or do it all at once? The file is small enough. 

    // I'll replacing lines 17 -> 223 with the new logic AND the new render for the header.



    {/* Messages Area */ }
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
                                    <img src={msg.attachment_url} alt="adjunto" className="rounded-lg max-h-40 object-cover border border-slate-200" />
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

    {/* Input Area */ }
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

            </div >
        </>
    );
};
