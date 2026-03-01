import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from 'react-i18next';

const Chatbot = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "**Hi!** 👋 I'm **CiviBot**. How can I help you today?", isBot: true }
  ]);
  const [input, setInput] = useState('');
  const [socket, setSocket] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const currentStreamId = useRef(null);

  useEffect(() => {
    // Connect to the backend socket server
    const newSocket = io('http://localhost:5005');
    setSocket(newSocket);

    // Listen for full chatbot responses (fallback)
    newSocket.on('chatbot_response', (data) => {
      setIsLoading(false);
      setMessages(prev => [...prev, { text: data.text, isBot: true }]);
    });

    // Listen for chatbot streaming chunks
    newSocket.on('chatbot_chunk', (data) => {
      setIsLoading(false);
      const { text, interactionId } = data;

      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];

        // If the last message is from the bot and belongs to this stream, append to it
        if (lastMsg && lastMsg.isBot && currentStreamId.current === interactionId) {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMsg,
            text: lastMsg.text + text
          };
          return updatedMessages;
        } else {
          // Start a new message for this stream
          currentStreamId.current = interactionId;
          return [...prev, { text: text, isBot: true, interactionId: interactionId }];
        }
      });
    });

    // Listen for completion
    newSocket.on('chatbot_response_complete', (data) => {
      currentStreamId.current = null;
      setIsLoading(false);
    });

    return () => newSocket.close();
  }, []);

  // Update greeting when language changes, only if it's the initial state
  useEffect(() => {
    if (messages.length === 1 && messages[0].isBot) {
      setMessages([{ text: t('chatbot_greeting'), isBot: true }]);
    }
  }, [t]);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    // Add user message to UI
    const userMessage = { text: input, isBot: false };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Send query to backend via socket
    if (socket) {
      const userInfo = localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')) : null;
      socket.emit('chatbot_query', {
        query: input,
        userId: userInfo ? userInfo._id : 'anonymous',
        context: `The user is currently on the ${window.location.pathname} page. User role: ${userInfo ? userInfo.role : 'unknown'}.`
      });
    }

    setInput('');
  };

  return (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          width: '350px',
          height: '500px',
          backgroundColor: 'white',
          borderRadius: '15px',
          boxShadow: '0 5px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          marginBottom: '15px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}>
          {/* Header */}
          <div style={{
            padding: '15px',
            backgroundColor: '#2563eb',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '30px', height: '30px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>C</div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>{t('chatbot_title')}</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}
            >
              ×
            </button>
          </div>

          {/* Messages Container */}
          <div style={{
            flex: 1,
            padding: '15px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#f8fafc'
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.isBot ? 'flex-start' : 'flex-end',
                backgroundColor: msg.isBot ? 'white' : '#2563eb',
                color: msg.isBot ? '#1e293b' : 'white',
                padding: '10px 14px',
                borderRadius: msg.isBot ? '0 15px 15px 15px' : '15px 15px 0 15px',
                maxWidth: '85%',
                fontSize: '0.9rem',
                lineHeight: '1.4',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                border: msg.isBot ? '1px solid #e2e8f0' : 'none',
                whiteSpace: 'normal',
                overflowWrap: 'break-word'
              }}>
                {msg.isBot ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ node, ...props }) => <p style={{ margin: '0 0 8px 0' }} {...props} />,
                      ul: ({ node, ...props }) => <ul style={{ margin: '0 0 8px 0', paddingLeft: '20px' }} {...props} />,
                      ol: ({ node, ...props }) => <ol style={{ margin: '0 0 8px 0', paddingLeft: '20px' }} {...props} />,
                      li: ({ node, ...props }) => <li style={{ margin: '4px 0' }} {...props} />,
                      code: ({ node, inline, ...props }) => (
                        inline
                          ? <code style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace' }} {...props} />
                          : <pre style={{ backgroundColor: 'rgba(0,0,0,0.1)', padding: '8px', borderRadius: '4px', overflowX: 'auto' }}><code style={{ fontFamily: 'monospace' }} {...props} /></pre>
                      ),
                      a: ({ node, ...props }) => <a style={{ color: '#2563eb', textDecoration: 'underline' }} {...props} />
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
            ))}

            {isLoading && (
              <div style={{
                alignSelf: 'flex-start',
                backgroundColor: 'white',
                padding: '10px 14px',
                borderRadius: '0 15px 15px 15px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                gap: '4px',
                alignItems: 'center'
              }}>
                <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: '#94a3b8', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out' }}></div>
                <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: '#94a3b8', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out 0.2s' }}></div>
                <div className="typing-dot" style={{ width: '6px', height: '6px', backgroundColor: '#94a3b8', borderRadius: '50%', animation: 'typing 1.4s infinite ease-in-out 0.4s' }}></div>
                <style>{`
                  @keyframes typing {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-4px); }
                  }
                `}</style>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: '15px', backgroundColor: 'white', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t('chatbot_placeholder')}
              style={{
                flex: 1,
                padding: '10px 16px',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                outline: 'none',
                fontSize: '0.9rem',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#2563eb'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                backgroundColor: input.trim() ? '#2563eb' : '#cbd5e1',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.2s'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: '#2563eb',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 15px rgba(37, 99, 235, 0.4)',
          cursor: 'pointer',
          fontSize: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1) rotate(5deg)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.5)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
          e.currentTarget.style.boxShadow = '0 4px 15px rgba(37, 99, 235, 0.4)';
        }}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        )}
      </button>
    </div>
  );
};

export default Chatbot;
