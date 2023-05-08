import { Client } from "pg";

import { SequelizeConnection } from "../../common/generator/connection";
import Info from "../../common/models/info.model";
import Status from "../../common/models/status.model";

async function main() {
  try {
    const client = new Client({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 5432,
    });

    await client.connect();

    try {
      await client.query(`DROP DATABASE ${process.env.DB_SCHEMA};`);
    } catch (err) {}

    await client.query(`CREATE DATABASE ${process.env.DB_SCHEMA};`);

    client.end();

    const sequelize = SequelizeConnection.initialize({
      models: [Info, Status],
      modelPaths: [__dirname + "/../models"],
      define: {
        createdAt: false,
        timestamps: false,
      },
    });

    await sequelize.sync({ force: process.env.FORCE === "true" });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
