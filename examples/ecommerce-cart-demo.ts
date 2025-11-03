/**
 * Monarch Database E-commerce Shopping Cart Demo
 *
 * This example demonstrates an e-commerce application with shopping carts,
 * inventory management, order processing, and real-time updates using
 * transactions, complex queries, and change streams.
 */

import { Monarch } from 'monarch-database-quantum';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inventory: number;
  sku: string;
  images: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  id: string;
  email: string;
  name: string;
  addresses: Address[];
  paymentMethods: PaymentMethod[];
}

interface Address {
  id: string;
  type: 'billing' | 'shipping';
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'paypal' | 'apple_pay';
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number; // Price at time of adding to cart
  addedAt: Date;
}

interface ShoppingCart {
  id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Order {
  id: string;
  userId: string;
  cartId: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  items: CartItem[];
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: PaymentMethod;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

class EcommerceApp {
  private db: Monarch;
  private products: any;
  private users: any;
  private carts: any;
  private orders: any;

  constructor() {
    this.db = new Monarch();
    this.products = this.db.addCollection('products');
    this.users = this.db.addCollection('users');
    this.carts = this.db.addCollection('carts');
    this.orders = this.db.addCollection('orders');

    // Create indexes for performance
    this.products.createIndex('category');
    this.products.createIndex('sku');
    this.products.createIndex('tags');
    this.users.createIndex('email');
    this.carts.createIndex('userId');
    this.orders.createIndex('userId');
    this.orders.createIndex('status');
    this.orders.createIndex('createdAt');
  }

  // Product management
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const product: Product = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...productData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.products.insert(product);
    console.log(`📦 Product created: ${product.name} (${product.inventory} in stock)`);
    return product;
  }

  async updateInventory(productId: string, quantityChange: number): Promise<void> {
    const product = await this.products.findOne({ id: productId });
    if (!product) throw new Error('Product not found');

    const newInventory = product.inventory + quantityChange;
    if (newInventory < 0) throw new Error('Insufficient inventory');

    await this.products.update({ id: productId }, {
      inventory: newInventory,
      updatedAt: new Date()
    });

    console.log(`📊 Inventory updated: ${product.name} now has ${newInventory} units`);
  }

  // User management
  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...userData
    };

    await this.users.insert(user);
    console.log(`👤 User created: ${user.name} (${user.email})`);
    return user;
  }

  // Shopping cart operations
  async getOrCreateCart(userId: string): Promise<ShoppingCart> {
    let cart = await this.carts.findOne({ userId });

    if (!cart) {
      cart = {
        id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        items: [],
        subtotal: 0,
        tax: 0,
        shipping: 10, // Flat shipping rate
        total: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await this.carts.insert(cart);
      console.log(`🛒 New cart created for user ${userId}`);
    }

    return cart;
  }

  async addToCart(userId: string, productId: string, quantity: number): Promise<void> {
    // Use transaction for atomicity
    await this.db.transaction(async () => {
      const product = await this.products.findOne({ id: productId });
      if (!product) throw new Error('Product not found');
      if (product.inventory < quantity) throw new Error('Insufficient inventory');

      const cart = await this.getOrCreateCart(userId);

      // Check if item already in cart
      const existingItemIndex = cart.items.findIndex((item: CartItem) => item.productId === productId);

      if (existingItemIndex >= 0) {
        // Update existing item
        cart.items[existingItemIndex].quantity += quantity;
      } else {
        // Add new item
        cart.items.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          productId,
          quantity,
          price: product.price,
          addedAt: new Date()
        });
      }

      // Recalculate totals
      cart.subtotal = cart.items.reduce((sum: number, item: CartItem) =>
        sum + (item.price * item.quantity), 0);
      cart.tax = cart.subtotal * 0.08; // 8% tax
      cart.total = cart.subtotal + cart.tax + cart.shipping;
      cart.updatedAt = new Date();

      await this.carts.update({ id: cart.id }, cart);
      console.log(`➕ Added ${quantity}x ${product.name} to cart (Total: $${cart.total.toFixed(2)})`);
    });
  }

  async removeFromCart(userId: string, productId: string): Promise<void> {
    const cart = await this.carts.findOne({ userId });
    if (!cart) return;

    cart.items = cart.items.filter((item: CartItem) => item.productId !== productId);

    // Recalculate totals
    cart.subtotal = cart.items.reduce((sum: number, item: CartItem) =>
      sum + (item.price * item.quantity), 0);
    cart.tax = cart.subtotal * 0.08;
    cart.total = cart.subtotal + cart.tax + cart.shipping;
    cart.updatedAt = new Date();

    await this.carts.update({ id: cart.id }, cart);
    console.log(`➖ Removed ${productId} from cart`);
  }

  // Order processing
  async checkout(userId: string, shippingAddressId: string, paymentMethodId: string): Promise<Order> {
    return await this.db.transaction(async () => {
      const cart = await this.carts.findOne({ userId });
      if (!cart || cart.items.length === 0) throw new Error('Cart is empty');

      const user = await this.users.findOne({ id: userId });
      if (!user) throw new Error('User not found');

      // Validate inventory and reduce stock
      for (const item of cart.items) {
        const product = await this.products.findOne({ id: item.productId });
        if (!product) throw new Error(`Product ${item.productId} not found`);
        if (product.inventory < item.quantity) throw new Error(`Insufficient inventory for ${product.name}`);

        await this.updateInventory(item.productId, -item.quantity);
      }

      // Create order
      const shippingAddress = user.addresses.find((addr: Address) => addr.id === shippingAddressId);
      const paymentMethod = user.paymentMethods.find((pm: PaymentMethod) => pm.id === paymentMethodId);

      if (!shippingAddress) throw new Error('Shipping address not found');
      if (!paymentMethod) throw new Error('Payment method not found');

      const order: Order = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        cartId: cart.id,
        status: 'pending',
        items: cart.items,
        shippingAddress,
        billingAddress: shippingAddress, // Use shipping as billing for demo
        paymentMethod,
        subtotal: cart.subtotal,
        tax: cart.tax,
        shipping: cart.shipping,
        total: cart.total,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.orders.insert(order);

      // Clear the cart
      await this.carts.update({ id: cart.id }, {
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
        updatedAt: new Date()
      });

      console.log(`✅ Order placed: ${order.id} for $${order.total.toFixed(2)}`);
      return order;
    });
  }

  // Real-time inventory monitoring
  setupInventoryMonitoring(): void {
    this.products.watch().on('update', (change) => {
      const product = change.doc as Product;
      if (product.inventory < 10) {
        console.log(`⚠️  Low inventory alert: ${product.name} (${product.inventory} remaining)`);
      }
    });
  }

  // Analytics and reporting
  async getSalesAnalytics(): Promise<{
    totalOrders: number;
    totalRevenue: number;
    topProducts: Array<{ productId: string; name: string; sold: number }>;
    categoryPerformance: Record<string, number>;
  }> {
    const orders = await this.orders.find({ status: { $ne: 'cancelled' } });

    const productSales = new Map<string, number>();
    const categoryRevenue = new Map<string, number>();
    let totalRevenue = 0;

    for (const order of orders) {
      totalRevenue += order.total;

      for (const item of order.items) {
        const current = productSales.get(item.productId) || 0;
        productSales.set(item.productId, current + item.quantity);

        // Get product category for category analytics
        const product = await this.products.findOne({ id: item.productId });
        if (product) {
          const currentCat = categoryRevenue.get(product.category) || 0;
          categoryRevenue.set(product.category, currentCat + (item.price * item.quantity));
        }
      }
    }

    // Get top products with names
    const topProducts = Array.from(productSales.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(async ([productId, sold]) => {
        const product = await this.products.findOne({ id: productId });
        return {
          productId,
          name: product?.name || 'Unknown',
          sold
        };
      });

    return {
      totalOrders: orders.length,
      totalRevenue,
      topProducts: await Promise.all(topProducts),
      categoryPerformance: Object.fromEntries(categoryRevenue)
    };
  }

  // Search and filtering
  async searchProducts(query: {
    text?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    tags?: string[];
  }, limit = 20): Promise<Product[]> {
    const searchQuery: any = {};

    if (query.text) {
      searchQuery.$or = [
        { name: { $regex: query.text, $options: 'i' } },
        { description: { $regex: query.text, $options: 'i' } }
      ];
    }

    if (query.category) {
      searchQuery.category = query.category;
    }

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      searchQuery.price = {};
      if (query.minPrice !== undefined) searchQuery.price.$gte = query.minPrice;
      if (query.maxPrice !== undefined) searchQuery.price.$lte = query.maxPrice;
    }

    if (query.inStock) {
      searchQuery.inventory = { $gt: 0 };
    }

    if (query.tags && query.tags.length > 0) {
      searchQuery.tags = { $in: query.tags };
    }

    return await this.products.find(searchQuery, {}, { limit });
  }
}

// Demo usage
async function runEcommerceDemo(): Promise<void> {
  console.log('🛒 Monarch Database - E-commerce Shopping Cart Demo\n');

  const app = new EcommerceApp();
  app.setupInventoryMonitoring();

  try {
    // Create products
    console.log('📦 Creating products...');
    const laptop = await app.createProduct({
      name: 'MacBook Pro 16"',
      description: 'High-performance laptop for professionals',
      price: 2499,
      category: 'electronics',
      inventory: 50,
      sku: 'MBP16-2024',
      images: ['macbook.jpg'],
      tags: ['laptop', 'apple', 'premium']
    });

    const headphones = await app.createProduct({
      name: 'Sony WH-1000XM5',
      description: 'Premium noise-canceling wireless headphones',
      price: 349,
      category: 'electronics',
      inventory: 100,
      sku: 'WH1000XM5',
      images: ['sony-headphones.jpg'],
      tags: ['headphones', 'wireless', 'noise-canceling']
    });

    const book = await app.createProduct({
      name: 'Clean Code',
      description: 'A handbook of agile software craftsmanship',
      price: 45,
      category: 'books',
      inventory: 200,
      sku: 'CLEAN-CODE',
      images: ['clean-code.jpg'],
      tags: ['programming', 'software', 'agile']
    });

    // Create user
    console.log('\n👤 Creating user...');
    const user = await app.createUser({
      email: 'john.doe@example.com',
      name: 'John Doe',
      addresses: [{
        id: 'addr_1',
        type: 'shipping',
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA'
      }],
      paymentMethods: [{
        id: 'pm_1',
        type: 'credit_card',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2026
      }]
    });

    // Shopping cart operations
    console.log('\n🛒 Shopping cart operations...');
    await app.addToCart(user.id, laptop.id, 1);
    await app.addToCart(user.id, headphones.id, 2);
    await app.addToCart(user.id, book.id, 1);

    // Simulate low inventory alert
    setTimeout(async () => {
      await app.updateInventory(headphones.id, -95); // Leave only 5
    }, 500);

    // Search products
    console.log('\n🔍 Searching for electronics under $500...');
    const searchResults = await app.searchProducts({
      category: 'electronics',
      maxPrice: 500
    });
    console.log(`Found ${searchResults.length} products`);

    // Checkout process
    console.log('\n💳 Processing checkout...');
    const order = await app.checkout(user.id, 'addr_1', 'pm_1');
    console.log(`Order completed: ${order.id}`);

    // Analytics
    console.log('\n📊 Sales Analytics:');
    const analytics = await app.getSalesAnalytics();
    console.log(`Total Orders: ${analytics.totalOrders}`);
    console.log(`Total Revenue: $${analytics.totalRevenue.toFixed(2)}`);
    console.log('Top Products:', analytics.topProducts.slice(0, 3));

    // Health check
    console.log('\n🏥 Database Health Check:');
    const health = await app.db.healthCheck();
    console.log(`Status: ${health.status} | Collections: ${health.collections} | Memory: ${(health.memoryUsage / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n🎉 E-commerce demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo
runEcommerceDemo().catch(console.error);
