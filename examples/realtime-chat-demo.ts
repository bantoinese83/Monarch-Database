/**
 * Monarch Database Real-time Chat Application Demo
 *
 * This example demonstrates how to build a real-time chat application
 * with Monarch Database, showcasing change streams, user management,
 * and message persistence.
 */

import { Monarch } from 'monarch-database-quantum';

interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  online: boolean;
  lastSeen: Date;
}

interface ChatRoom {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  createdAt: Date;
  isPrivate: boolean;
}

interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  messageType: 'text' | 'image' | 'file' | 'system';
  edited?: boolean;
  editedAt?: Date;
}

class ChatApplication {
  private db: Monarch;
  private users: any;
  private rooms: any;
  private messages: any;

  constructor() {
    this.db = new Monarch();
    this.users = this.db.addCollection('users');
    this.rooms = this.db.addCollection('rooms');
    this.messages = this.db.addCollection('messages');

    // Create indexes for performance
    this.users.createIndex('username');
    this.users.createIndex('email');
    this.messages.createIndex('roomId');
    this.messages.createIndex('timestamp');
  }

  // User management
  async createUser(userData: Omit<User, 'id' | 'online' | 'lastSeen'>): Promise<User> {
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...userData,
      online: true,
      lastSeen: new Date()
    };

    await this.users.insert(user);
    console.log(`👤 User created: ${user.username}`);
    return user;
  }

  async updateUserStatus(userId: string, online: boolean): Promise<void> {
    await this.users.update({ id: userId }, {
      online,
      lastSeen: new Date()
    });
    console.log(`🔄 User ${userId} status: ${online ? 'online' : 'offline'}`);
  }

  // Room management
  async createRoom(roomData: Omit<ChatRoom, 'id' | 'createdAt'>): Promise<ChatRoom> {
    const room: ChatRoom = {
      id: `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...roomData,
      createdAt: new Date()
    };

    await this.rooms.insert(room);
    console.log(`🏠 Room created: ${room.name}`);
    return room;
  }

  async joinRoom(userId: string, roomId: string): Promise<void> {
    const room = await this.rooms.findOne({ id: roomId });
    if (!room) throw new Error('Room not found');

    if (!room.members.includes(userId)) {
      room.members.push(userId);
      await this.rooms.update({ id: roomId }, { members: room.members });
      console.log(`➕ User ${userId} joined room ${room.name}`);
    }
  }

  // Message handling
  async sendMessage(messageData: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...messageData,
      timestamp: new Date()
    };

    await this.messages.insert(message);
    console.log(`💬 Message sent in ${message.roomId} by ${message.username}`);
    return message;
  }

  // Real-time features using change streams
  setupRealTimeUpdates(): void {
    // Watch for new messages
    this.messages.watch().on('insert', (change) => {
      const message = change.doc as Message;
      console.log(`📨 New message in room ${message.roomId}: ${message.content.substring(0, 50)}...`);
    });

    // Watch for user status changes
    this.users.watch().on('update', (change) => {
      const user = change.doc as User;
      console.log(`🔄 User ${user.username} is now ${user.online ? 'online' : 'offline'}`);
    });

    // Watch for room membership changes
    this.rooms.watch().on('update', (change) => {
      const room = change.doc as ChatRoom;
      console.log(`🏠 Room ${room.name} now has ${room.members.length} members`);
    });
  }

  // Analytics and queries
  async getRoomStats(roomId: string): Promise<{
    totalMessages: number;
    activeUsers: number;
    recentMessages: Message[];
  }> {
    const messages = await this.messages.find(
      { roomId },
      {},
      { sort: { timestamp: -1 }, limit: 10 }
    );

    const room = await this.rooms.findOne({ id: roomId });
    const activeUsers = room ? room.members.length : 0;

    return {
      totalMessages: await this.messages.count({ roomId }),
      activeUsers,
      recentMessages: messages
    };
  }

  async searchMessages(roomId: string, query: string, limit = 20): Promise<Message[]> {
    return await this.messages.find(
      {
        roomId,
        content: { $regex: query, $options: 'i' }
      },
      {},
      { sort: { timestamp: -1 }, limit }
    );
  }

  // Cleanup old messages (for demo purposes)
  async cleanupOldMessages(daysOld = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const removed = await this.messages.remove({
      timestamp: { $lt: cutoffDate }
    });

    console.log(`🧹 Cleaned up ${removed} messages older than ${daysOld} days`);
    return removed;
  }
}

// Demo usage
async function runChatDemo(): Promise<void> {
  console.log('🚀 Monarch Database - Real-time Chat Application Demo\n');

  const chatApp = new ChatApplication();

  // Setup real-time updates
  chatApp.setupRealTimeUpdates();

  try {
    // Create users
    console.log('👥 Creating users...');
    const alice = await chatApp.createUser({
      username: 'alice_dev',
      email: 'alice@example.com',
      avatar: '👩‍💻'
    });

    const bob = await chatApp.createUser({
      username: 'bob_coder',
      email: 'bob@example.com',
      avatar: '👨‍💻'
    });

    const charlie = await chatApp.createUser({
      username: 'charlie_ops',
      email: 'charlie@example.com',
      avatar: '👨‍🔧'
    });

    // Create rooms
    console.log('\n🏠 Creating chat rooms...');
    const generalRoom = await chatApp.createRoom({
      name: 'General',
      description: 'General discussion for everyone',
      createdBy: alice.id,
      members: [alice.id],
      isPrivate: false
    });

    const devRoom = await chatApp.createRoom({
      name: 'Dev Team',
      description: 'Development team discussions',
      createdBy: alice.id,
      members: [alice.id, bob.id],
      isPrivate: true
    });

    // Users join rooms
    await chatApp.joinRoom(bob.id, generalRoom.id);
    await chatApp.joinRoom(charlie.id, generalRoom.id);

    // Send messages
    console.log('\n💬 Sending messages...');
    await chatApp.sendMessage({
      roomId: generalRoom.id,
      userId: alice.id,
      username: alice.username,
      content: 'Hello everyone! Welcome to our chat app built with Monarch Database! 🚀',
      messageType: 'text'
    });

    await chatApp.sendMessage({
      roomId: generalRoom.id,
      userId: bob.id,
      username: bob.username,
      content: 'Hey Alice! This real-time messaging is super fast!',
      messageType: 'text'
    });

    await chatApp.sendMessage({
      roomId: devRoom.id,
      userId: alice.id,
      username: alice.username,
      content: 'Dev team: Let\'s discuss the new feature implementation',
      messageType: 'text'
    });

    // Simulate user going offline/online
    setTimeout(async () => {
      await chatApp.updateUserStatus(charlie.id, false); // offline
      setTimeout(async () => {
        await chatApp.updateUserStatus(charlie.id, true); // back online
      }, 1000);
    }, 500);

    // Analytics
    console.log('\n📊 Room Statistics:');
    const stats = await chatApp.getRoomStats(generalRoom.id);
    console.log(`General room: ${stats.totalMessages} messages, ${stats.activeUsers} active users`);

    // Search functionality
    console.log('\n🔍 Searching for messages containing "Monarch"...');
    const searchResults = await chatApp.searchMessages(generalRoom.id, 'Monarch');
    console.log(`Found ${searchResults.length} matching messages`);

    // Cleanup demo
    const cleaned = await chatApp.cleanupOldMessages(0); // Clean all for demo
    console.log(`\n🧹 Cleaned up ${cleaned} messages for demo`);

    // Health check
    console.log('\n🏥 Database Health Check:');
    const health = await chatApp.db.healthCheck();
    console.log(`Status: ${health.status} | Collections: ${health.collections} | Memory: ${(health.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n🎉 Chat application demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo
runChatDemo().catch(console.error);
