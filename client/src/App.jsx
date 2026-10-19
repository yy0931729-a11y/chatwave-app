import React, { useState, useEffect } from 'react';
import { socket } from './socket';

function Login({ onAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const register = async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/register`, {
      method: 'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) onAuth(data);
    else alert(data.error || 'error');
  };
  const login = async () => {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/auth/login`, {
      method: 'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) onAuth(data);
    else alert(data.error || 'error');
  };
  return (
    <div className="login">
      <h2>ChatWave — تسجيل</h2>
      <input placeholder="اسم المستخدم" value={username} onChange={e=>setUsername(e.target.value)}/>
      <input placeholder="كلمة السر" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
      <div>
        <button onClick={login}>دخول</button>
        <button onClick={register}>تسجيل</button>
      </div>
    </div>
  );
}

function ChatApp({ token, user }) {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(()=> {
    socket.auth = { token };
    socket.connect();
    return () => { socket.disconnect(); };
  }, [token]);

  useEffect(()=> {
    const load = async () => {
      const res = await fetch(`${API}/api/conversations`, { headers: { Authorization: 'Bearer ' + token }});
      const data = await res.json();
      setConversations(data);
    };
    load();
    socket.on('receive_message', (msg) => {
      if (msg.conversation === (active && active._id)) {
        setMessages(prev => [...prev, msg]);
      }
      // refresh conversations list
    });
  }, [token, active]);

  const openConv = async (conv) => {
    setActive(conv);
    socket.emit('join', conv._id);
    const res = await fetch(`${API}/api/messages/${conv._id}`, { headers: { Authorization: 'Bearer ' + token }});
    const data = await res.json();
    setMessages(data);
  };

  const send = async () => {
    if (!text || !active) return;
    const res = await fetch(`${API}/api/messages`, {
      method:'POST', headers:{ 'Content-Type':'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ conversationId: active._id, content: text })
    });
    const msg = await res.json();
    setMessages(prev=>[...prev, msg]);
    setText('');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h3>مرحباً، {user.username}</h3>
        <ul>
          {conversations.map(c => (
            <li key={c._id} onClick={()=>openConv(c)}>
              {c.participants.filter(p => p._id !== user.id)[0]?.username || 'محادثة'}
            </li>
          ))}
        </ul>
      </aside>
      <main className="chat">
        {active ? (
          <>
            <div className="messages">
              {messages.map(m => <div className="msg" key={m._id}><b>{m.sender.username}:</b> {m.content}</div>)}
            </div>
            <div className="composer">
              <input value={text} onChange={e=>setText(e.target.value)} placeholder="اكتب رسالة..."/>
              <button onClick={send}>إرسال</button>
            </div>
          </>
        ) : <div className="empty">اختر محادثة</div>}
      </main>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    const t = localStorage.getItem('cw_token');
    const u = localStorage.getItem('cw_user');
    return t && u ? { token: t, user: JSON.parse(u) } : null;
  });
  useEffect(()=> {
    if (auth) {
      localStorage.setItem('cw_token', auth.token);
      localStorage.setItem('cw_user', JSON.stringify(auth.user));
    } else {
      localStorage.removeItem('cw_token'); localStorage.removeItem('cw_user');
    }
  }, [auth]);

  return auth ? <ChatApp token={auth.token} user={auth.user} /> : <Login onAuth={(d)=> setAuth({ token: d.token, user: d.user })} />;
}
