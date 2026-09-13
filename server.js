const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });
const rooms = {};
console.log('天空突击联机服务器启动，端口：' + PORT);
wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.isHost = false;
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch(e) { return; }
    if (msg.type === 'create_room') {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      ws.roomCode = code;
      ws.isHost = true;
      rooms[code] = { host: ws, guest: null, mode: msg.mode || 'normal' };
      ws.send(JSON.stringify({ type: 'room_created', code }));
      console.log('房间创建：' + code);
    }
    if (msg.type === 'join_request') {
      const code = msg.code;
      const room = rooms[code];
      if (room && !room.guest) {
        ws.roomCode = code;
        ws.isHost = false;
        room.guest = ws;
        ws.send(JSON.stringify({ type: 'join_accepted', mode: room.mode }));
        if (room.host.readyState === WebSocket.OPEN) {
          room.host.send(JSON.stringify({ type: 'player_joined' }));
        }
        console.log('玩家加入房间：' + code);
      } else {
        ws.send(JSON.stringify({ type: 'join_failed', reason: '房间不存在或已满' }));
      }
    }
    if (msg.type === 'player_pos' && ws.roomCode) {
      const room = rooms[ws.roomCode];
      if (!room) return;
      const target = ws.isHost ? room.guest : room.host;
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify({ type: ws.isHost ? 'player1_pos' : 'player2_pos', x: msg.x, y: msg.y, tilt: msg.tilt }));
      }
    }
    if (msg.type === 'player_fire' && ws.roomCode) {
      const room = rooms[ws.roomCode];
      if (!room) return;
      const target = ws.isHost ? room.guest : room.host;
      if (target && target.readyState === WebSocket.OPEN) {
        target.send(JSON.stringify({ type: ws.isHost ? 'player1_fire' : 'player2_fire' }));
      }
    }
    if (msg.type === 'game_state' && ws.roomCode && ws.isHost) {
      const room = rooms[ws.roomCode];
      if (room && room.guest && room.guest.readyState === WebSocket.OPEN) {
        room.guest.send(JSON.stringify({ type: 'game_state', score: msg.score, wave: msg.wave, kills: msg.kills }));
      }
    }
  });
  ws.on('close', () => {
    if (ws.roomCode && rooms[ws.roomCode]) {
      const room = rooms[ws.roomCode];
      const other = ws.isHost ? room.guest : room.host;
      if (other && other.readyState === WebSocket.OPEN) {
        other.send(JSON.stringify({ type: 'player_left' }));
      }
      delete rooms[ws.roomCode];
      console.log('房间关闭：' + ws.roomCode);
    }
  });
});
