import MarketPlace from "../../models/market_place";
import { MarketPlaceFiltersGenerator } from "./filters-generator";
import { MarketPlaceValidator } from "./validator";
import { MarketPlaceRepository } from "./repository";
import { MarketPlaceSerializer } from "./serializer";
import { MarketPlaceOrderGenerator } from "./order-generator";
import { MarketPlacePermissionsManager } from "./permissions-manager";
import { SequelizeDataProvider } from "../../../src/common/generator/dataprovider";

export class MarketPlaceDataProvider extends SequelizeDataProvider<MarketPlace> {
  constructor() {
    const permissionsManager = new MarketPlacePermissionsManager();
    const filtersGenerator = new MarketPlaceFiltersGenerator();
    const orderGenerator = new MarketPlaceOrderGenerator();

    super(
      new MarketPlaceRepository(
        permissionsManager,
        filtersGenerator,
        orderGenerator
      ),
      new MarketPlaceSerializer(),
      new MarketPlaceValidator(),
      permissionsManager
    );
  }
}
