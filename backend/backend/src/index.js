import { httpServerHandler } from "cloudflare:node";
import express from "express";

const app = express();

app.use(express.json());

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

app.listen(3000);

export default httpServerHandler({ port: 3000 });
