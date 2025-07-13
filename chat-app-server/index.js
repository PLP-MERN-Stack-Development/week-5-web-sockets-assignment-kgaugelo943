const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  }
});

let users = {}; // socket.id -> username
const usernames = {};

io.on('connection', (socket) => {
  console.log(' Connected:', socket.id);

  // Receive and store username
  socket.on('set_username', (username) => {
    users[socket.id] = username;
    io.emit('user_list', Object.values(users));
    console.log(`${username} joined.`);
  });
  io.emit('user_joined', users[socket.id]);

  // Broadcast chat message with user info
  socket.on('chat_message', (msg) => {
    const username = users[socket.id] || 'Anonymous';
    const messageData = {
      text: msg,
      user: username,
      time: new Date().toLocaleTimeString(),
    };
    io.emit('chat_message', messageData);
  });

  // Typing indicator
  socket.on('typing', () => {
    const username = users[socket.id];
    socket.broadcast.emit('user_typing', username);
  });

  socket.on('stop_typing', () => {
    const username = users[socket.id];
    socket.broadcast.emit('user_stopped_typing', username);
  });

   // Private message
   socket.on('private_message', ({ to, text }) => {
    const from = users[socket.id];
    const targetSocketId = usernames[to];

    const message = {
      from,
      to,
      text,
      time: new Date().toLocaleTimeString(),
    };

    // Send to both sender and receiver for private chat window
    socket.emit('private_message', message);
    if (targetSocketId) {
      io.to(targetSocketId).emit('private_message', message);
    }
  });

  let messageHistory = []; 
  
  io.on('connection', (socket) => {
    socket.on('get_recent_messages', (count = 20) => {
      const recent = messageHistory.slice(-count);
      socket.emit('recent_messages', recent);
    });
  
    socket.on('chat_message', (msg) => {
      const message = {
        user: users[socket.id],
        text: msg,
        time: new Date().toLocaleTimeString(),
      };
      messageHistory.push(message);
      io.emit('chat_message', message);
      callback('delivered');
    });
  });


  // Disconnect logic
  socket.on('disconnect', () => {
    console.log(' Disconnected:', socket.id);
    const username = users[socket.id];
    delete users[socket.id];
    io.emit('user_list', Object.values(users));
  });
});
io.emit('user_left', users[socket.id]);

socket.on('join_room', (room) => {
  socket.join(room);
});

socket.on('room_message', ({ room, text }) => {
  const message = {
    user: users[socket.id],
    text,
    time: new Date().toLocaleTimeString(),
  };
  io.to(room).emit('room_message', message);
});

socket.on('search_messages', (keyword) => {
  const results = messageHistory.filter((msg) =>
    msg.text.toLowerCase().includes(keyword.toLowerCase())
  );
  socket.emit('search_results', results);
});


server.listen(5000, () => {
  console.log(' Server running on http://localhost:5000');
});
