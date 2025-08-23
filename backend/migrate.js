const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "scanner.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log("🚀 Vérification de la base de données...");

  db.all("PRAGMA table_info(scans);", (err, rows) => {
    if (err) {
      console.error("❌ Erreur schéma:", err.message);
      db.close();
      return;
    }

    const columns = rows.map((c) => c.name);

    const migrations = [];

    if (!columns.includes("callback_url")) {
      migrations.push("ALTER TABLE scans ADD COLUMN callback_url TEXT;");
    }

    if (!columns.includes("files_scanned")) {
      migrations.push("ALTER TABLE scans ADD COLUMN files_scanned TEXT;");
    }

    if (!columns.includes("updated_at")) {
      migrations.push("ALTER TABLE scans ADD COLUMN updated_at TEXT;");
    }
    if (!columns.includes("duration")) {
      migrations.push("ALTER TABLE scans ADD COLUMN duration INTEGER DEFAULT 0;");
    }

    if (migrations.length === 0) {
      console.log("✅ Aucune migration nécessaire.");
      db.close();
      return;
    }

    migrations.forEach((sql, i) => {
      console.log(`⚡ Migration ${i + 1}: ${sql}`);
      db.run(sql, (err) => {
        if (err) console.error("❌ Erreur migration:", err.message);
      });
    });

    console.log("✅ Migrations terminées !");
    db.close();
  });
});
