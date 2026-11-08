import { env } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import express from "express";

const app = express();

const SHOP_ORIGIN = "https://abshary100-code.github.io";

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin === SHOP_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", SHOP_ORIGIN);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "50kb" }));

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Nazgol Shop backend is running"
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    ok: true,
    message: "API is working"
  });
});

// ثبت سفارش در دیتابیس
app.post("/api/orders", async (req, res) => {
  try {
    const {
      customer,
      items,
      total,
      paymentMethod,
      shipping = 0,
      discount = 0
    } = req.body;

    if (
      !customer ||
      !customer.name ||
      !customer.phone ||
      !customer.address ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !Number.isSafeInteger(total) ||
      total < 0
    ) {
      return res.status(400).json({
        ok: false,
        message: "اطلاعات سفارش ناقص یا نامعتبر است."
      });
    }

    if (!["card_to_card", "cash_on_delivery"].includes(paymentMethod)) {
      return res.status(400).json({
        ok: false,
        message: "روش پرداخت نامعتبر است."
      });
    }

    const validItems = items.every(item =>
      item &&
      typeof item.name === "string" &&
      Number.isSafeInteger(item.price) &&
      Number.isSafeInteger(item.qty) &&
      item.qty > 0
    );

    if (!validItems) {
      return res.status(400).json({
        ok: false,
        message: "اقلام سفارش نامعتبر هستند."
      });
    }

    const result = await env.DB.prepare(`
      INSERT INTO orders (
        customer_name,
        phone,
        address,
        items_json,
        total_amount,
        payment_method,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      customer.name,
      customer.phone,
      customer.address,
      JSON.stringify({ items, shipping, discount }),
      total,
      paymentMethod,
      "pending"
    ).run();

    return res.status(201).json({
      ok: true,
      orderId: result.meta.last_row_id,
      message: "سفارش با موفقیت ثبت شد."
    });

  } catch (error) {
    console.error("Order error:", error);

    return res.status(500).json({
      ok: false,
      message: "ثبت سفارش با خطا مواجه شد."
    });
  }
});

app.listen(3000);

export default httpServerHandler({ port: 3000 });
