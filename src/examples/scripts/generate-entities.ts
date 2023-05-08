import Country from "../models/country";
import Currency from "../models/currency";
import MarketPlace from "../models/market_place";
import Info from "../../common/models/info.model";
import Status from "../../common/models/status.model";
import { SequelizeConnection } from "../../common/generator/connection";

export const generateEntities = async (): Promise<void> => {
  SequelizeConnection.initialize({
    models: [Info, Status],
    modelPaths: [__dirname + "/../models"],
    define: {
      createdAt: false,
      timestamps: false,
    },
  });

  await Status.destroy({ where: {} });

  await Status.bulkCreate([
    { id: 1, name: "Regular" },
    { id: 2, name: "Archived" },
    { id: 3, name: "Deleted" },
  ]);

  await Currency.destroy({ where: {} });

  await Currency.bulkCreate([
    {
      id: 978,
      name: "Euro",
      code: "EUR",
      symbol: "€",
      exchange_rate: 1,
      sort_order_id: 1,
    },
    {
      id: 840,
      name: "US Dollar",
      code: "USD",
      symbol: "$",
      exchange_rate: 1.174188518315,
      sort_order_id: 2,
    },
    {
      id: 156,
      name: "Yuan Renminbi",
      code: "CNY",
      symbol: "¥",
      exchange_rate: 7.4285939810698,
      sort_order_id: null,
    },
    {
      id: 756,
      name: "Swiss Franc",
      code: "CHF",
      symbol: "CHF",
      exchange_rate: 1.0554161317358,
      sort_order_id: null,
    },
  ]);

  await MarketPlace.destroy({ where: {} });

  await MarketPlace.bulkCreate([
    {
      name: "Germany",
      id: 17,
      currency_numeric_code: 978,
    },
    {
      name: "France",
      id: 20,
    },
    {
      name: "Test",
      id: 37,
    },
  ]);

  await Country.destroy({ where: {} });

  await Country.bulkCreate([
    { name: "Germany", code: "DE", sort_order: 10 },
    { name: "United States", code: "US", sort_order: 10 },
    { name: "Europe", code: "EU", status_id: 2, sort_order: 0 },
  ]);
};

generateEntities();
