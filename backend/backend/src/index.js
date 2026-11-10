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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: "4mb" }));

// صفحه اصلی سرور
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Nazgol Shop backend is running"
  });
});

// تست سرور
app.get("/api/test", (req, res) => {
  res.json({
    ok: true,
    message: "API is working"
  });
});

// ثبت سفارش
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

const trackingToken = crypto.randomUUID();

const result = await env.DB.prepare(`
      INSERT INTO orders (
        customer_name,
        phone,
        address,
        items_json,
        total_amount,
        payment_method,
        status,
        tracking_token
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      customer.name,
      customer.phone,
      customer.address,
      JSON.stringify({ items, shipping, discount }),
      total,
            paymentMethod,
      "pending",
      trackingToken
      
    ).run();
 return res.status(201).json({
      ok: true,
      orderId: result.meta.last_row_id,
      trackingCode: trackingToken,
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

// دریافت سفارش‌ها با رمز مدیریت
app.get("/api/admin/orders", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (
      !env.ADMIN_PASSWORD ||
      auth !== `Bearer ${env.ADMIN_PASSWORD}`
    ) {
      return res.status(401).json({
        ok: false,
        message: "دسترسی غیرمجاز است."
      });
    }

    const result = await env.DB.prepare(`
      SELECT * FROM orders
      ORDER BY id DESC
      LIMIT 100
    `).all();

    return res.json({
      ok: true,
      orders: result.results
    });

  } catch (error) {
    console.error("Admin orders error:", error);

    return res.status(500).json({
      ok: false,
      message: "دریافت سفارش‌ها ناموفق بود."
    });
  }
});
// Update order status
app.patch("/api/admin/orders/:id/status", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (
      !env.ADMIN_PASSWORD ||
      auth !== `Bearer ${env.ADMIN_PASSWORD}`
    ) {
      return res.status(401).json({
        ok: false,
        message: "دسترسی غیرمجاز است."
      });
    }

    const orderId = Number(req.params.id);
    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "preparing",
      "shipped",
      "completed"
    ];

    if (
      !Number.isSafeInteger(orderId) ||
      orderId <= 0 ||
      !allowedStatuses.includes(status)
    ) {
      return res.status(400).json({
        ok: false,
        message: "اطلاعات نامعتبر است."
      });
    }

    const result = await env.DB.prepare(`
      UPDATE orders
      SET status = ?
      WHERE id = ?
    `).bind(status, orderId).run();

    if (result.meta.changes === 0) {
      return res.status(404).json({
        ok: false,
        message: "سفارش پیدا نشد."
      });
    }

    return res.json({
      ok: true,
      message: "وضعیت سفارش تغییر کرد."
    });

  } catch (error) {
    console.error("Update status error:", error);

    return res.status(500).json({
      ok: false,
      message: "تغییر وضعیت ناموفق بود."
    });
  }
});
app.delete("/api/admin/orders/:id", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (!env.ADMIN_PASSWORD || auth !== `Bearer ${env.ADMIN_PASSWORD}`) {
      return res.status(401).json({
        ok: false,
        message: "دسترسی غیرمجاز است."
      });
    }

    const orderId = Number(req.params.id);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        ok: false,
        message: "شماره سفارش نامعتبر است."
      });
    }

    const result = await env.DB.prepare(
      "DELETE FROM orders WHERE id = ?"
    ).bind(orderId).run();

    if (result.meta.changes === 0) {
      return res.status(404).json({
        ok: false,
        message: "سفارش پیدا نشد."
      });
    }

    return res.json({
      ok: true,
      message: "سفارش با موفقیت حذف شد."
    });

  } catch (error) {
    console.error("Delete order error:", error);

    return res.status(500).json({
      ok: false,
      message: "حذف سفارش ناموفق بود."
    });
  }
});
// پیگیری سفارش با کد اختصاصی
app.get("/api/orders/track/:token", async (req, res) => {
  try {
    const token = req.params.token;

    if (
      typeof token !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(token)
    ) {
      return res.status(400).json({
        ok: false,
        message: "کد پیگیری نامعتبر است."
      });
    }

    const order = await env.DB.prepare(`
      SELECT id, status, created_at
      FROM orders
      WHERE tracking_token = ?
    `).bind(token).first();

    if (!order) {
      return res.status(404).json({
        ok: false,
        message: "سفارشی با این کد پیگیری پیدا نشد."
      });
    }

    return res.json({
      ok: true,
      order: {
        id: order.id,
        status: order.status,
        createdAt: order.created_at
      }
    });

  } catch (error) {
    console.error("Track order error:", error);

    return res.status(500).json({
      ok: false,
      message: "خطا در پیگیری سفارش."
    });
  }
});
// آپلود عکس محصول در GitHub
app.post("/api/admin/upload-image", async (req, res) => {
  try {
    const auth = req.headers.authorization;

    if (!env.ADMIN_PASSWORD || auth !== `Bearer ${env.ADMIN_PASSWORD}`) {
      return res.status(401).json({
        ok: false,
        message: "دسترسی غیرمجاز است."
      });
    }

    if (!env.GITHUB_TOKEN) {
      return res.status(500).json({
        ok: false,
        message: "تنظیمات ذخیره‌سازی عکس کامل نیست."
      });
    }

    const { image } = req.body || {};

    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(image || "");

    if (!match) {
      return res.status(400).json({
        ok: false,
        message: "فرمت عکس معتبر نیست."
      });
    }

    const imageBytes = Uint8Array.from(
      atob(match[2]),
      c => c.charCodeAt(0)
    );

    if (imageBytes.length > 2 * 1024 * 1024) {
      return res.status(400).json({
        ok: false,
        message: "حجم عکس باید کمتر از ۲ مگابایت باشد."
      });
    }

    const extension = match[1] === "jpeg" ? "jpg" : match[1];
    const fileName = `product-${crypto.randomUUID()}.${extension}`;

    const githubResponse = await fetch(
      `https://api.github.com/repos/abshary100-code/my-shop/contents/images/${fileName}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Upload product image",
          content: match[2],
          branch: "main"
        })
      }
    );

    if (!githubResponse.ok) {
  const githubError = await githubResponse.text();

  console.error("GitHub upload error:", githubError);

  return res.status(502).json({
    ok: false,
    message: "خطای گیت‌هاب: " + githubError
  });
}
    

    return res.json({
      ok: true,
      imageUrl: `https://abshary100-code.github.io/my-shop/images/${fileName}`
    });

  } catch (error) {
    console.error("Image upload error:", error);

    return res.status(500).json({
      ok: false,
      message: "خطا در آپلود عکس."
    });
  }
});
app.listen(3000);

export default httpServerHandler({ port: 3000 });
