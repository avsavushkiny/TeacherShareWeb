const express = require("express");
const os = require("os");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 8085);
const PUBLIC_DIR = path.join(__dirname, "public");

app.disable("x-powered-by");
app.use(express.static(PUBLIC_DIR));
app.use(express.json({ limit: "20mb" }));

let currentImage = null;
let lastUpdated = 0;
let imageVersion = 0;

app.get("/", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.get("/api/status", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
        hasImage: Boolean(currentImage),
        updated: lastUpdated,
        version: imageVersion
    });
});

app.get("/api/image", (_req, res) => {
    res.set("Cache-Control", "no-store");

    if (!currentImage) {
        return res.status(204).end();
    }

    return res.json({
        image: currentImage,
        updated: lastUpdated,
        version: imageVersion
    });
});

app.post("/api/image", (req, res) => {
    const image = req.body?.image;

    if (typeof image !== "string" ||
        !image.startsWith("data:image/png;base64,")) {
        return res.status(400).json({
            error: "Ожидалось PNG-изображение в формате Base64."
        });
    }

    const base64 = image.slice(image.indexOf(",") + 1);

    // Защита от чрезмерно больших запросов.
    if (base64.length > 18 * 1024 * 1024) {
        return res.status(413).json({
            error: "Изображение слишком большое."
        });
    }

    currentImage = image;
    lastUpdated = Date.now();
    imageVersion += 1;

    return res.json({
        success: true,
        version: imageVersion,
        updated: lastUpdated
    });
});

app.post("/api/stop", (_req, res) => {
    currentImage = null;
    lastUpdated = Date.now();
    imageVersion += 1;

    return res.json({ success: true, version: imageVersion });
});

const server = app.listen(PORT, "0.0.0.0", () => {
    console.log("\nTeacherShare запущен.");
    console.log(`Порт: ${PORT}\n`);

    const interfaces = os.networkInterfaces();
    for (const [name, addresses] of Object.entries(interfaces)) {
        for (const address of addresses || []) {
            if (address.family === "IPv4" && !address.internal) {
                console.log(`${name}: http://${address.address}:${PORT}`);
            }
        }
    }

    console.log("\nНа ноутбуке откройте:");
    console.log(`http://localhost:${PORT}/sender.html`);
    console.log("\nНа ПК с проектором откройте:");
    console.log(`http://IP-АДРЕС-НОУТБУКА:${PORT}/receiver.html\n`);
});

function shutdown() {
    console.log("\nОстановка TeacherShare...");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
