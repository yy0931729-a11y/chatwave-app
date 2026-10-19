require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const MONGO = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chatwave';
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Mongo connected'))
  .catch(err => console.error(err));

// --- simple auth routes ---
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username/password required' });
  try {
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ error: 'username taken' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hash });
    const token = jwt.sign({ id: user._id }, JWT_SECRET);
    res.json({ token, user: { id: user._id, username: user.username } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'invalid credentials' });
  const token = jwt.sign({ id: user._id }, JWT_SECRET);
  res.json({ token, user: { id: user._id, username: user.username } });
});

// middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'no token' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.id;
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

// conversations
app.post('/api/conversations', auth, async (req, res) => {
  const { participantId } = req.body; // create or find conversation between req.userId and participantId
  if (!participantId) return res.status(400).json({ error: 'participantId required' });
  let conv = await Conversation.findOne({ participants: { $all: [req.userId, participantId] } });
  if (!conv) conv = await Conversation.create({ participants: [req.userId, participantId] });
  res.json(conv);
});

app.get('/api/conversations', auth, async (req, res) => {
  const convs = await Conversation.find({ participants: req.userId }).populate('participants', 'username');
  res.json(convs);
});

// messages
app.get('/api/messages/:conversationId', auth, async (req, res) => {
  const msgs = await Message.find({ conversation: req.params.conversationId }).sort('createdAt').populate('sender', 'username');
  res.json(msgs);
});

app.post('/api/messages', auth, async (req, res) => {
  const { conversationId, content } = req.body;
  if (!conversationId || !content) return res.status(400).json({ error: 'conversationId and content required' });
  const msg = await Message.create({ conversation: conversationId, sender: req.userId, content });
  // update conversation
  await Conversation.findByIdAndUpdate(conversationId, { lastMessage: content, updatedAt: new Date() });
  const populated = await msg.populate('sender', 'username').execPopulate();
  io.to(conversationId).emit('receive_message', populated);
  res.json(populated);
});

// Socket.IO realtime
io.on('connection', socket => {
  console.log('socket connected', socket.id);

  socket.on('join', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('leave', (conversationId) => {
    socket.leave(conversationId);
  });

  // optionally handle typing indicators etc.
  socket.on('typing', ({ conversationId, userId }) => {
    socket.to(conversationId).emit('typing', { userId });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log('Server listening on', PORT));
