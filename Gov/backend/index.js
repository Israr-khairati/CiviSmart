const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const pythonManager = require('./utils/pythonManager');

dotenv.config();

connectDB();

// Initialize Python worker immediately on startup
pythonManager.init();

const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
const PORT = process.env.PORT || 5005;

const { evaluatePriorityWithAI, handleChatQuery } = require('./utils/aiPriority');

// Socket.io connection logic
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined their notification room`);
  });

  // Chatbot logic with streaming
  socket.on('chatbot_query', async (data) => {
    const { query, userId, context } = data;
    console.log(`💬 Chatbot query from ${userId}: ${query}`);
    
    // Create a unique ID for this specific interaction to help the frontend track chunks
    const interactionId = Date.now().toString();

    try {
      await handleChatQuery(query, context, userId, (chunk) => {
        socket.emit('chatbot_chunk', {
          text: chunk,
          interactionId: interactionId,
          timestamp: new Date()
        });
      });
      
      // Signal completion
      socket.emit('chatbot_response_complete', {
        interactionId: interactionId
      });
    } catch (error) {
      console.error('Socket Chat Error:', error);
      socket.emit('chatbot_response', {
        text: "I'm sorry, I encountered an error while processing your request.",
        timestamp: new Date()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io accessible to our routes
app.set('socketio', io);

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/uploads', express.static(path.join(__dirname, '/uploads')));

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working properly!' });
});

app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// Chatbot training updated - Trigger Restart
