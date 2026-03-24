require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
(async () => {
  const client = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    user: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_DATABASE || "ogretmenpro",
  });
  await client.connect();
  const sqlPath = path.join(__dirname, "sql", "add-yillik-plan-curriculum-model.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await client.query(sql);
  console.log("OK:", sqlPath);
  await client.end();
})().catch((e) => { console.error(e); process.exit(1); });
