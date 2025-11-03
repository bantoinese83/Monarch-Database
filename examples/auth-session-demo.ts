/**
 * Monarch Database Authentication & Session Management Demo
 *
 * This example demonstrates a complete authentication system with
 * user registration, login/logout, session management, password hashing,
 * rate limiting, and security monitoring using Monarch's features.
 */

import { Monarch } from 'monarch-database-quantum';

interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: 'user' | 'admin' | 'moderator';
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  loginAttempts: number;
  lockedUntil?: Date;
}

interface Session {
  id: string;
  userId: string;
  token: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  isActive: boolean;
  deviceInfo: {
    type: 'desktop' | 'mobile' | 'tablet';
    os: string;
    browser: string;
  };
}

interface LoginAttempt {
  id: string;
  email: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp: Date;
  failureReason?: string;
}

interface PasswordReset {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

class AuthSystem {
  private db: Monarch;
  private users: any;
  private sessions: any;
  private loginAttempts: any;
  private passwordResets: any;

  constructor() {
    this.db = new Monarch();
    this.users = this.db.addCollection('users');
    this.sessions = this.db.addCollection('sessions');
    this.loginAttempts = this.db.addCollection('loginAttempts');
    this.passwordResets = this.db.addCollection('passwordResets');

    // Create indexes for performance
    this.users.createIndex('email');
    this.users.createIndex('username');
    this.sessions.createIndex('userId');
    this.sessions.createIndex('token');
    this.sessions.createIndex('expiresAt');
    this.loginAttempts.createIndex('email');
    this.loginAttempts.createIndex('timestamp');
    this.passwordResets.createIndex('token');
    this.passwordResets.createIndex('userId');
  }

  // Password utilities (simplified for demo)
  private hashPassword(password: string): string {
    // In production, use proper hashing like bcrypt
    return Buffer.from(password).toString('base64') + '_hashed';
  }

  private verifyPassword(password: string, hash: string): boolean {
    return this.hashPassword(password) === hash;
  }

  private generateToken(): string {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateResetToken(): string {
    return `reset_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  // User registration
  async register(email: string, username: string, password: string): Promise<User> {
    // Validate input
    if (!email || !username || !password) {
      throw new Error('Email, username, and password are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    // Check for existing users
    const existingEmail = await this.users.findOne({ email: email.toLowerCase() });
    if (existingEmail) throw new Error('Email already registered');

    const existingUsername = await this.users.findOne({ username });
    if (existingUsername) throw new Error('Username already taken');

    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: email.toLowerCase(),
      username,
      passwordHash: this.hashPassword(password),
      role: 'user',
      isActive: true,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      loginAttempts: 0
    };

    await this.users.insert(user);
    console.log(`👤 User registered: ${username} (${email})`);
    return user;
  }

  // Authentication
  async login(email: string, password: string, ipAddress: string, userAgent: string): Promise<Session> {
    const emailLower = email.toLowerCase();

    // Record login attempt
    await this.loginAttempts.insert({
      id: `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      email: emailLower,
      ipAddress,
      userAgent,
      success: false,
      timestamp: new Date()
    });

    const user = await this.users.findOne({ email: emailLower });
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check account status
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Check for account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new Error('Account is temporarily locked due to too many failed attempts');
    }

    // Verify password
    if (!this.verifyPassword(password, user.passwordHash)) {
      // Increment login attempts
      await this.users.update({ id: user.id }, {
        loginAttempts: user.loginAttempts + 1,
        updatedAt: new Date()
      });

      // Lock account after 5 failed attempts
      if (user.loginAttempts >= 4) {
        await this.users.update({ id: user.id }, {
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
          loginAttempts: 0
        });
      }

      throw new Error('Invalid email or password');
    }

    // Successful login - reset attempts and update login time
    await this.users.update({ id: user.id }, {
      loginAttempts: 0,
      lastLoginAt: new Date(),
      lockedUntil: undefined,
      updatedAt: new Date()
    });

    // Update login attempt to success
    await this.loginAttempts.update(
      { email: emailLower, success: false },
      { success: true },
      { limit: 1, sort: { timestamp: -1 } }
    );

    // Create session
    const session: Session = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      token: this.generateToken(),
      ipAddress,
      userAgent,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      isActive: true,
      deviceInfo: this.parseUserAgent(userAgent)
    };

    await this.sessions.insert(session);
    console.log(`🔐 User logged in: ${user.username} from ${ipAddress}`);
    return session;
  }

  // Session management
  async validateSession(token: string): Promise<User | null> {
    const session = await this.sessions.findOne({
      token,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (!session) return null;

    const user = await this.users.findOne({
      id: session.userId,
      isActive: true
    });

    return user || null;
  }

  async logout(token: string): Promise<void> {
    const session = await this.sessions.findOne({ token });
    if (session) {
      await this.sessions.update({ id: session.id }, { isActive: false });
      console.log(`🚪 User logged out: ${session.userId}`);
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    const expired = await this.sessions.remove({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isActive: false }
      ]
    });
    console.log(`🧹 Cleaned up ${expired} expired sessions`);
    return expired;
  }

  // Password reset
  async requestPasswordReset(email: string): Promise<string> {
    const user = await this.users.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists for security
      return 'If the email exists, a reset link has been sent';
    }

    const resetToken = this.generateResetToken();
    const reset: PasswordReset = {
      id: `reset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      token: resetToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      used: false,
      createdAt: new Date()
    };

    await this.passwordResets.insert(reset);
    console.log(`📧 Password reset requested for: ${email}`);
    return resetToken; // In production, send via email
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const reset = await this.passwordResets.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!reset) {
      throw new Error('Invalid or expired reset token');
    }

    // Update password
    await this.users.update({ id: reset.userId }, {
      passwordHash: this.hashPassword(newPassword),
      updatedAt: new Date()
    });

    // Mark reset token as used
    await this.passwordResets.update({ id: reset.id }, { used: true });

    console.log(`🔑 Password reset completed for user: ${reset.userId}`);
  }

  // Security monitoring
  async getSecurityStats(hours = 24): Promise<{
    totalLogins: number;
    failedLogins: number;
    activeSessions: number;
    lockedAccounts: number;
    recentAlerts: LoginAttempt[];
  }> {
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const loginAttempts = await this.loginAttempts.find({
      timestamp: { $gte: startTime }
    });

    const successfulLogins = loginAttempts.filter((a: LoginAttempt) => a.success);
    const failedLogins = loginAttempts.filter((a: LoginAttempt) => !a.success);

    const activeSessions = await this.sessions.count({
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    const lockedAccounts = await this.users.count({
      lockedUntil: { $gt: new Date() }
    });

    const recentAlerts = failedLogins
      .sort((a: LoginAttempt, b: LoginAttempt) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10);

    return {
      totalLogins: successfulLogins.length,
      failedLogins: failedLogins.length,
      activeSessions,
      lockedAccounts,
      recentAlerts
    };
  }

  private parseUserAgent(userAgent: string): Session['deviceInfo'] {
    // Simple user agent parsing (in production, use a proper library)
    const isMobile = /mobile|android|iphone|ipad/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);

    let type: 'desktop' | 'mobile' | 'tablet' = 'desktop';
    if (isTablet) type = 'tablet';
    else if (isMobile) type = 'mobile';

    let os = 'Unknown';
    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/mac/i.test(userAgent)) os = 'macOS';
    else if (/linux/i.test(userAgent)) os = 'Linux';
    else if (/android/i.test(userAgent)) os = 'Android';
    else if (/ios/i.test(userAgent)) os = 'iOS';

    let browser = 'Unknown';
    if (/chrome/i.test(userAgent)) browser = 'Chrome';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/safari/i.test(userAgent)) browser = 'Safari';
    else if (/edge/i.test(userAgent)) browser = 'Edge';

    return { type, os, browser };
  }

  // Real-time security monitoring
  setupSecurityMonitoring(): void {
    // Monitor failed login attempts
    this.loginAttempts.watch().on('insert', (change) => {
      const attempt = change.doc as LoginAttempt;
      if (!attempt.success) {
        console.log(`🚫 Failed login attempt for ${attempt.email} from ${attempt.ipAddress}`);
      }
    });

    // Monitor account lockouts
    this.users.watch().on('update', (change) => {
      const user = change.doc as User;
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        console.log(`🔒 Account locked: ${user.username} (${user.email})`);
      }
    });
  }
}

// Demo usage
async function runAuthDemo(): Promise<void> {
  console.log('🔐 Monarch Database - Authentication & Session Management Demo\n');

  const auth = new AuthSystem();
  auth.setupSecurityMonitoring();

  try {
    // User registration
    console.log('👤 Registering users...');
    const user1 = await auth.register('john.doe@example.com', 'johndoe', 'password123');
    const user2 = await auth.register('admin@example.com', 'admin', 'adminpass123');

    // Successful login
    console.log('\n🔐 Logging in users...');
    const session1 = await auth.login('john.doe@example.com', 'password123', '192.168.1.100', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    console.log(`✅ Login successful for ${user1.username}`);

    // Validate session
    const validatedUser = await auth.validateSession(session1.token);
    console.log(`🔍 Session validation: ${validatedUser?.username}`);

    // Failed login attempts (to test security)
    console.log('\n🚫 Testing failed login attempts...');
    for (let i = 0; i < 3; i++) {
      try {
        await auth.login('john.doe@example.com', 'wrongpassword', '192.168.1.100', 'Mozilla/5.0');
      } catch (error) {
        console.log(`Attempt ${i + 1} failed: ${(error as Error).message}`);
      }
    }

    // Password reset
    console.log('\n📧 Testing password reset...');
    const resetToken = await auth.requestPasswordReset('john.doe@example.com');
    console.log(`Reset token generated: ${resetToken.substring(0, 20)}...`);

    await auth.resetPassword(resetToken, 'newpassword123');
    console.log('✅ Password reset successful');

    // Login with new password
    const session2 = await auth.login('john.doe@example.com', 'newpassword123', '192.168.1.101', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    console.log(`✅ Login with new password successful`);

    // Security stats
    console.log('\n📊 Security Statistics:');
    const stats = await auth.getSecurityStats();
    console.log(`Total logins: ${stats.totalLogins}`);
    console.log(`Failed logins: ${stats.failedLogins}`);
    console.log(`Active sessions: ${stats.activeSessions}`);
    console.log(`Locked accounts: ${stats.lockedAccounts}`);

    // Cleanup expired sessions
    const cleaned = await auth.cleanupExpiredSessions();
    console.log(`\n🧹 Cleaned up ${cleaned} expired sessions`);

    // Logout
    await auth.logout(session1.token);
    await auth.logout(session2.token);
    console.log('🚪 All users logged out');

    // Health check
    console.log('\n🏥 Database Health Check:');
    const health = await auth.db.healthCheck();
    console.log(`Status: ${health.status} | Collections: ${health.collections} | Memory: ${(health.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n🎉 Authentication demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo
runAuthDemo().catch(console.error);
