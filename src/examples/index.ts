import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { AppRouter } from "../common/router/router";

import { SequelizeConnection } from "../common/generator/connection";
import Info from "../common/models/info.model";
import Status from "../common/models/status.model";
import SupplyNetwork from "../common/models/supply-network.model";
import { MarketPlaceController } from "./market_place/controller/controller";
import { CountryController } from "./country/controller/controller";
import { CurrencyController } from "./currency/controller/controller";
import { authenticate } from "./middleware/dummyAuth";
import { errorHandler } from "./middleware/dummyErrorHandler";

const port = process.env.API_PORT || 3001;

export const app = new Koa();

const router = new AppRouter();

// Create sequelize singleton instance and initialize database connection
SequelizeConnection.initialize({
  models: [Info, Status, SupplyNetwork],
  modelPaths: [__dirname + "/models"],
  define: {
    createdAt: false,
    timestamps: false,
  },
});

router.addControllerRoutes(new MarketPlaceController());
router.addControllerRoutes(new CountryController());
router.addControllerRoutes(new CurrencyController());

app
  .use(errorHandler())
  .use(bodyParser())
  .use(authenticate())
  .use(router.routes());

console.info(`Ready, listening on port ${port}`);

app.listen(port);
