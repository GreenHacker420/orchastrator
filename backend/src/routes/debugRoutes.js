import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

router.get("/data", async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: { orders: true }
        });
        const shipments = await prisma.shipment.findMany({
            include: { trackingEvents: true }
        });
        const tickets = await prisma.ticket.findMany({
            include: { messages: true }
        });

        res.json({
            users,
            shipments,
            tickets
        });
    } catch (error) {
        console.error("Error fetching debug data:", error);
        res.status(500).json({ error: "Failed to fetch debug data" });
    }
});

export default router;
