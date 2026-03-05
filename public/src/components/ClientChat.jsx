import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, X, User, Minus } from 'lucide-react'
import { useAuth } from '../utils/AuthContext'
import { joinChat, sendChatMessage, onMessage, offMessage } from '../utils/socket'
import api from '../utils/api'
export default function ClientChat({ businessId, customerId, customerName, isAdminChat = false, inline = false }) {
    const { user } = useAuth()
    const [isOpen, setIsOpen] = useState(false)
    const [isMinimized, setIsMinimized] = useState(false)
    const [messages, setMessages] = useState([])
    const [inputValue, setInputValue] = useState('')
    const [loading, setLoading] = useState(false)
    const messagesEndRef = useRef(null)

    const chatId = `${businessId}_${customerId}`

    useEffect(() => {
        if (isOpen || inline) {
            fetchMessages()
            joinChat(chatId)

            const handleMessage = (data) => {
                if (data.chatId === chatId) {
                    setMessages(prev => [...prev, data])
                }
            }

            onMessage(handleMessage)
            return () => offMessage(handleMessage)
        }
    }, [isOpen, inline, chatId])

    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const fetchMessages = async () => {
        setLoading(true)
        try {
            const response = await api.get(`/messages?customerId=${customerId}`)
            // In the real app, we might need a specific endpoint for chat history
            setMessages(response.data.reverse())
        } catch (error) {
            console.error('Failed to fetch chat history:', error)
        } finally {
            setLoading(false)
        }
    }

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const handleSend = async (e) => {
        e.preventDefault()
        if (!inputValue.trim()) return

        const newMessage = {
            message: inputValue,
            fromClient: !isAdminChat,
            createdAt: new Date().toISOString()
        }

        // Send via Socket for real-time
        sendChatMessage(chatId, newMessage)

        // Save to DB via API
        try {
            await api.post('/messages', {
                message: inputValue,
                customerId,
                fromClient: !isAdminChat
            })
            setInputValue('')
        } catch (error) {
            console.error('Failed to save message:', error)
        }
    }

    if (!isOpen && !inline) {
        return (
            <div className="chat-floating-bubble" onClick={() => setIsOpen(true)}>
                <MessageSquare size={28} />
            </div>
        )
    }

    return (
        <div className={`${inline ? 'chat-inline-wrapper' : 'chat-floating-wrapper'} ${isMinimized && !inline ? 'minimized' : ''}`}>
            <div className="chat-header">
                <div className="chat-header-info">
                    {!inline && (
                        <div className="chat-avatar">
                            <User size={18} />
                        </div>
                    )}
                    <div className="chat-title">
                        {isAdminChat ? `Chat with ${customerName || 'Client'}` : 'Business Support'}
                    </div>
                </div>
                {!inline && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setIsMinimized(!isMinimized)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                            <Minus size={18} />
                        </button>
                        <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                            <X size={18} />
                        </button>
                    </div>
                )}
            </div>

            {(!isMinimized || inline) && (
                <>
                    <div className="chat-messages">
                        {messages.length === 0 && !loading && (
                            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                No messages yet. Say hello!
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`message-bubble ${((msg.fromClient && !isAdminChat) || (!msg.fromClient && isAdminChat)) ? 'message-outgoing' : 'message-incoming'}`}
                            >
                                {msg.message}
                                <div className="message-timestamp">
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    <form className="chat-input-area" onSubmit={handleSend}>
                        <input
                            type="text"
                            className="chat-input"
                            placeholder="Type a message..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                        />
                        <button type="submit" className="chat-send-btn">
                            <Send size={18} />
                        </button>
                    </form>
                </>
            )}
        </div>
    )
}
