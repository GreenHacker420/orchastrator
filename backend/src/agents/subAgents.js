import prisma from '../lib/prisma.js';
import { genAI } from '../lib/gemini.js';

const MODEL_NAME = "gemini-2.0-flash-exp";


async function runPrismaAgent(domain, naturalQuery, schemaContext) {
  console.log(`[${domain} Agent] Processing: "${naturalQuery}"`);

  const prompt = `
    You are a specialized Data Agent for the "${domain}" domain.
    
    Database Schema (Prisma Models):
    ${schemaContext}
    
    # MISSION
    Convert the user's natural language query into a *precise, valid Prisma Client query object* in JSON format.
    
    # RULES
    1. **Output Format**: STRICT JSON only. NO markdown blocks (e.g., \`\`\`json). NO commentary.
    2. **Structure**: { "model": "ModelName", "method": "findMany" | "findUnique" | "count", "args": { ... } }
    3. **Validation**: 
       - Use ONLY fields defined in the provided schema. 
       - Do NOT hallucinate relationships or fields.
       - "contains" filters are case-insensitive by default in many Prisma setups, but prefer \`mode: 'insensitive'\` if searching text.
    4. **Security**: Read-only access.
    
    # EXAMPLE
    User: "Find all orders for user 123"
    JSON: { "model": "Order", "method": "findMany", "args": { "where": { "userId": 123 }, "include": { "products": true } } }

    User Query: "${naturalQuery}"
  `;

  try {
    // Use correct SDK method for @google/genai
    const result = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });

    // Correct access for @google/genai SDK where text is a getter
    const responseText = result.text || result.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    console.log(`[${domain} Agent] Generated JSON: ${jsonString}`);

    const queryObj = JSON.parse(jsonString);

    // Validate structure
    if (!queryObj.model || !queryObj.method || !queryObj.args) {
      throw new Error("Invalid query object structure");
    }

    // Security check: Allow only read operations
    const ALLOWED_METHODS = ['findMany', 'findUnique', 'findFirst', 'count', 'aggregate', 'groupBy'];
    if (!ALLOWED_METHODS.includes(queryObj.method)) {
      throw new Error(`Method ${queryObj.method} is not allowed. Read-only access.`);
    }

    // Execute via Prisma
    // dynamic access: prisma['User']['findMany'](args)
    if (!prisma[queryObj.model]) {
      throw new Error(`Model ${queryObj.model} does not exist in Prisma Client.`);
    }

    const prismaModel = queryObj.model.charAt(0).toLowerCase() + queryObj.model.slice(1);

    if (!prisma[prismaModel]) {
      throw new Error(`Prisma model instance '${prismaModel}' not found.`);
    }

    const data = await prisma[prismaModel][queryObj.method](queryObj.args);

    return JSON.stringify(data);

  } catch (error) {
    console.error(`[${domain} Agent] Error:`, error);
    return JSON.stringify({
      error: "Failed to process query",
      details: error.message
    });
  }
}

// --- Specific Agents with Enhanced Schema Context ---

export async function askShopCore(query) {
  const schema = `
  Models:
  - User { id: Int, name: String, email: String, premiumStatus: Boolean, orders: Order[] }
  - Product { id: Int, name: String, category: String, price: Decimal, orders: Order[] }
  - Order { id: Int, userId: Int, productId: Int, orderDate: DateTime, status: String, user: User, product: Product }
  `;
  return runPrismaAgent('ShopCore', query, schema);
}

export async function askShipStream(query) {
  const schema = `
  Models:
  - Shipment { id: Int, orderId: Int, trackingNumber: String, estimatedArrival: DateTime, trackingEvents: TrackingEvent[] }
  - Warehouse { id: Int, location: String, managerName: String, trackingEvents: TrackingEvent[] }
  - TrackingEvent { id: Int, shipmentId: Int, warehouseId: Int, timestamp: DateTime, statusUpdate: String, shipment: Shipment, warehouse: Warehouse }
  `;
  return runPrismaAgent('ShipStream', query, schema);
}

export async function askPayGuard(query) {
  const schema = `
  Models:
  - Wallet { id: Int, userId: Int, balance: Decimal, currency: String, transactions: Transaction[], paymentMethods: PaymentMethod[] }
  - Transaction { id: Int, walletId: Int, orderId: Int, amount: Decimal, type: String, timestamp: DateTime, wallet: Wallet }
  - PaymentMethod { id: Int, walletId: Int, provider: String, expiryDate: DateTime, wallet: Wallet }
  `;
  return runPrismaAgent('PayGuard', query, schema);
}

export async function askCareDesk(query) {
  const schema = `
  Models:
  - Ticket { id: Int, userId: Int, referenceId: Int, issueType: String, status: String, messages: TicketMessage[], surveys: SatisfactionSurvey[] }
  - TicketMessage { id: Int, ticketId: Int, sender: String, content: String, timestamp: DateTime, ticket: Ticket }
  - SatisfactionSurvey { id: Int, ticketId: Int, rating: Int, comments: String, ticket: Ticket }
  `;
  return runPrismaAgent('CareDesk', query, schema);
}
