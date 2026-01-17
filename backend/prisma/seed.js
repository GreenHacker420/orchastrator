import 'dotenv/config';
import prisma from '../src/lib/prisma.js';

async function main() {
  console.log('Start seeding ...');

  // --- 1. ShopCore Data ---
  // Create User
  const user = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      premiumStatus: true,
    },
  });

  // Create Product
  const product = await prisma.product.create({
    data: {
      name: 'Gaming Monitor 27"',
      category: 'Electronics',
      price: 299.99,
    },
  });

  // Create Order
  // Note: timestamps in Prisma are auto-handled if default(now()), but we want specific dates for the story
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      productId: product.id,
      status: 'Shipped',
      orderDate: new Date(new Date().setDate(new Date().getDate() - 7)), // 7 days ago
    },
  });

  console.log(`[ShopCore] Created User: ${user.name}, Product: ${product.name}, Order ID: ${order.id}`);

  // --- 2. ShipStream Data ---
  // Create Warehouse
  const warehouse = await prisma.warehouse.create({
    data: {
      location: 'Central Distribution Center, NY',
      managerName: 'Bob Smith',
    },
  });

  // Create Shipment
  const shipment = await prisma.shipment.create({
    data: {
      orderId: order.id,
      trackingNumber: 'TRK123456789',
      estimatedArrival: new Date(new Date().setDate(new Date().getDate() + 2)), // 2 days from now
    },
  });

  // Create Tracking Events
  await prisma.trackingEvent.createMany({
    data: [
      {
        shipmentId: shipment.id,
        warehouseId: warehouse.id,
        statusUpdate: 'Package picked up by courier',
        timestamp: new Date(new Date().setDate(new Date().getDate() - 6)),
      },
      {
        shipmentId: shipment.id,
        warehouseId: warehouse.id,
        statusUpdate: 'Arrived at sorting facility',
        timestamp: new Date(new Date().setDate(new Date().getDate() - 4)),
      },
      {
        shipmentId: shipment.id,
        warehouseId: warehouse.id,
        statusUpdate: 'Departed sorting facility',
        timestamp: new Date(new Date().setDate(new Date().getDate() - 1)),
      },
    ],
  });

  console.log(`[ShipStream] Created Shipment: ${shipment.trackingNumber} with events.`);

  // --- 3. PayGuard Data ---
  // Create Wallet
  const wallet = await prisma.wallet.create({
    data: {
      userId: user.id,
      balance: 150.00,
      currency: 'USD',
    },
  });

  // Create Transaction
  await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      orderId: order.id,
      amount: 299.99,
      type: 'Debit',
    },
  });

  // Create Payment Method
  await prisma.paymentMethod.create({
    data: {
      walletId: wallet.id,
      provider: 'Visa',
      expiryDate: new Date('2025-12-31'),
    },
  });

  console.log(`[PayGuard] Created Wallet for User ${user.id} and Transaction for Order ${order.id}`);

  // --- 4. CareDesk Data ---
  // Create Ticket
  const ticket = await prisma.ticket.create({
    data: {
      userId: user.id,
      referenceId: order.id,
      issueType: 'Delivery Delay',
      status: 'Open'
    },
  });

  // Create Ticket Messages
  await prisma.ticketMessage.createMany({
    data: [
      {
        ticketId: ticket.id,
        sender: 'User',
        content: 'I ordered this monitor a week ago and it hasn\'t arrived yet. Where is it?',
        timestamp: new Date(new Date().setDate(new Date().getDate() - 1)), // Yesterday
      },
      {
        ticketId: ticket.id,
        sender: 'Agent',
        content: 'I apologize for the delay. Let me check the tracking status for you.',
        timestamp: new Date(new Date().setDate(new Date().getDate() - 1)), // Yesterday + a bit
      },
    ],
  });

  console.log(`[CareDesk] Created Ticket ${ticket.id} with messages.`);
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
