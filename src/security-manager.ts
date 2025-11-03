import { User, SecurityContext, AccessControl, Permission, Role } from './types';
import { logger } from './logger';

// Conditional crypto import for Node.js/browser compatibility
let randomBytes: any, createCipheriv: any, createDecipheriv: any, scrypt: any;
try {
  const crypto = require('crypto');
  const { promisify } = require('util');
  randomBytes = crypto.randomBytes;
  createCipheriv = crypto.createCipheriv;
  createDecipheriv = crypto.createDecipheriv;
  scrypt = promisify(crypto.scrypt);
} catch (e) {
  // Browser environment - crypto not available
  randomBytes = createCipheriv = createDecipheriv = scrypt = null;
}

export class SecurityManager implements AccessControl {
  private users = new Map<string, User>();
  private sessions = new Map<string, SecurityContext>();
  private encryptionKey: Buffer;

  private fallbackRandomBytes(length: number): Buffer {
    // Browser fallback - not cryptographically secure
    const array = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return Buffer.from(array);
  }

  private fallbackCreateCipheriv(): any {
    throw new Error('Encryption not available in browser environment');
  }

  private fallbackScrypt(): Promise<Buffer> {
    throw new Error('Password hashing not available in browser environment');
  }
  private rolePermissions: Record<Role, Permission[]> = {
    admin: ['read', 'write', 'admin', 'create', 'drop'],
    developer: ['read', 'write', 'create'],
    user: ['read', 'write'],
    viewer: ['read'],
    guest: ['read']
  };

  constructor(encryptionKey?: string) {
    // Use provided key or generate one (32 bytes for AES-256)
    if (encryptionKey) {
      // If it's a string, convert to buffer of proper length
      this.encryptionKey = Buffer.from(encryptionKey.padEnd(32, '0').slice(0, 32));
    } else {
      this.encryptionKey = randomBytes ? randomBytes(32) : this.fallbackRandomBytes(32);
    }
  }

  async authenticate(username: string, password: string): Promise<SecurityContext | null> {
    const user = this.users.get(username);
    if (!user) return null;

    const isValid = await this.verifyPassword(password, user.encryptedPassword || '');
    if (!isValid) return null;

    // Create session
    const sessionId = (randomBytes ? randomBytes(32) : this.fallbackRandomBytes(32)).toString('hex');
    const context: SecurityContext = {
      user,
      sessionId,
      permissions: this.getUserPermissions(user),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    this.sessions.set(sessionId, context);

    logger.debug('User authenticated', { username, sessionId });
    return context;
  }

  authorize(context: SecurityContext | null | undefined, permission: Permission, resource?: string): boolean {
    // Handle null/undefined context
    if (!context) {
      return false;
    }

    // Check session expiry
    if (Date.now() > context.expiresAt) {
      this.sessions.delete(context.sessionId);
      return false;
    }

    // Check permission
    const hasPermission = context.permissions.includes(permission);

    if (hasPermission) {
      logger.debug('Authorization granted', { username: context.user.username, permission, resource });
    } else {
      logger.debug('Authorization denied', { username: context.user.username, permission, resource });
    }

    return hasPermission;
  }

  async encrypt(data: any): Promise<string> {
    // Handle null/undefined
    if (data === null || data === undefined) {
      data = null;
    }
    
    // Handle functions - serialize as placeholder
    if (typeof data === 'function') {
      data = { __function: true, name: data.name || 'anonymous' };
    }
    
    const jsonData = JSON.stringify(data);
    if (!createCipheriv) throw new Error('Encryption not available in browser environment');

    const iv = randomBytes ? randomBytes(16) : this.fallbackRandomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  async decrypt(encryptedData: string): Promise<any> {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (!createDecipheriv) throw new Error('Decryption not available in browser environment');

    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  async hashPassword(password: string): Promise<string> {
    if (!scrypt) throw new Error('Password hashing not available in browser environment');

    const salt = randomBytes ? randomBytes(32) : this.fallbackRandomBytes(32);
    const keyLength = 64; // 512 bits

    try {
      const derivedKey = await scrypt(password, salt, keyLength) as Buffer;
      return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
    } catch (error) {
      throw new Error('Password hashing failed');
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [saltHex, keyHex] = hash.split(':');
    if (!saltHex || !keyHex) return false;

    const salt = Buffer.from(saltHex, 'hex');
    const storedKey = Buffer.from(keyHex, 'hex');
    const keyLength = 64;

    try {
      if (!scrypt) return false; // Browser environment

      const derivedKey = await scrypt(password, salt, keyLength) as Buffer;
      return derivedKey.equals(storedKey);
    } catch (error) {
      return false;
    }
  }

  // User management methods
  async createUser(username: string, password: string, roles: Role[] = ['user']): Promise<User> {
    if (this.users.has(username)) {
      throw new Error('User already exists');
    }

    const hashedPassword = await this.hashPassword(password);
    const user: User = {
      id: (randomBytes ? randomBytes(16) : this.fallbackRandomBytes(16)).toString('hex'),
      username,
      roles,
      permissions: this.getUserPermissions({ roles } as User),
      encryptedPassword: hashedPassword
    };

    this.users.set(username, user);
    logger.debug('User created', { username, roles });
    return user;
  }

  updateUserRoles(username: string, roles: Role[]): void {
    const user = this.users.get(username);
    if (!user) throw new Error('User not found');

    user.roles = roles;
    user.permissions = this.getUserPermissions(user);
    this.users.set(username, user);

    logger.debug('User roles updated', { username, roles });
  }

  deleteUser(username: string): void {
    const user = this.users.get(username);
    if (!user) throw new Error('User not found');

    // Remove all sessions for this user
    for (const [sessionId, context] of this.sessions) {
      if (context.user.id === user.id) {
        this.sessions.delete(sessionId);
      }
    }

    this.users.delete(username);
    logger.debug('User deleted', { username });
  }

  // Session management
  getSession(sessionId: string): SecurityContext | null {
    const context = this.sessions.get(sessionId);
    if (!context) return null;

    // Check expiry
    if (Date.now() > context.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return context;
  }

  revokeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.debug('Session revoked', { sessionId });
  }

  revokeUserSessions(username: string): void {
    const user = this.users.get(username);
    if (!user) return;

    let revoked = 0;
    for (const [sessionId, context] of this.sessions) {
      if (context.user.id === user.id) {
        this.sessions.delete(sessionId);
        revoked++;
      }
    }

    logger.debug('User sessions revoked', { username, count: revoked });
  }

  // Permission helpers
  private getUserPermissions(user: User): Permission[] {
    const permissions = new Set<Permission>();

    for (const role of user.roles) {
      const rolePermissions = this.rolePermissions[role] || [];
      for (const permission of rolePermissions) {
        permissions.add(permission);
      }
    }

    return Array.from(permissions);
  }

  // Audit logging
  getActiveSessions(): SecurityContext[] {
    const now = Date.now();
    const activeSessions: SecurityContext[] = [];

    for (const context of this.sessions.values()) {
      if (now <= context.expiresAt) {
        activeSessions.push(context);
      }
    }

    return activeSessions;
  }

  getSecurityStats(): {
    totalUsers: number;
    activeSessions: number;
    usersByRole: Record<Role, number>
  } {
    const usersByRole: Record<Role, number> = {
      admin: 0,
      developer: 0,
      user: 0,
      viewer: 0,
      guest: 0
    };

    for (const user of this.users.values()) {
      for (const role of user.roles) {
        usersByRole[role]++;
      }
    }

    return {
      totalUsers: this.users.size,
      activeSessions: this.getActiveSessions().length,
      usersByRole
    };
  }

  // Resource-level access control
  checkResourceAccess(context: SecurityContext, resource: string, permission: Permission): boolean {
    // Basic resource access control - can be extended with ACLs
    if (context.user.roles.includes('admin')) {
      return true; // Admins have access to everything
    }

    // Example: Users can only access resources they own
    if (resource.startsWith(`${context.user.username}/`)) {
      return context.permissions.includes(permission);
    }

    // Public resources
    if (resource.startsWith('public/')) {
      return ['read'].includes(permission);
    }

    return false;
  }
}
