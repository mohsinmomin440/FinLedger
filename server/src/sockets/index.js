import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { User, WorkspaceMember } from '../models/index.js';
import { verifyAccessToken } from '../utils/crypto.js';
import { setSocketServer } from '../services/notification.service.js';

export function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');

      if (!rawToken) {
        return next(new Error('Authentication token required'));
      }

      const payload = verifyAccessToken(rawToken);
      const user = await User.findById(payload.sub).select('_id name email activeWorkspace');
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = user;
      return next();
    } catch {
      return next(new Error('Invalid or expired socket token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user._id);
    socket.join(`user:${userId}`);

    socket.on('workspace:join', async (workspaceId, callback) => {
      try {
        if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
          if (typeof callback === 'function') callback({ ok: false, error: 'Invalid workspaceId' });
          return;
        }

        const member = await WorkspaceMember.findOne({
          workspace: workspaceId,
          user: socket.user._id,
        });

        if (!member) {
          if (typeof callback === 'function') {
            callback({ ok: false, error: 'Forbidden: not a member of workspace' });
          }
          return;
        }

        // Leave previous workspace rooms so events remain scoped cleanly
        for (const room of socket.rooms) {
          if (room.startsWith('workspace:')) {
            await socket.leave(room);
          }
        }

        await socket.join(`workspace:${String(workspaceId)}`);
        if (typeof callback === 'function') callback({ ok: true, workspaceId: String(workspaceId) });
      } catch (err) {
        logger.error({ err }, 'Socket workspace:join error');
        if (typeof callback === 'function') callback({ ok: false, error: 'Internal error' });
      }
    });

    const initialWsId = socket.handshake.auth?.workspaceId || socket.user.activeWorkspace;
    if (initialWsId && mongoose.Types.ObjectId.isValid(initialWsId)) {
      WorkspaceMember.findOne({
        workspace: initialWsId,
        user: socket.user._id,
      })
        .then((member) => {
          if (member) {
            socket.join(`workspace:${String(initialWsId)}`);
          }
        })
        .catch(() => {});
    }
  });

  setSocketServer(io);
  return io;
}
