import MarketPlace from "../../models/market_place";
import { MarketPlaceFiltersGenerator } from "./filters-generator";
import { MarketPlaceOrderGenerator } from "./order-generator";
import { MarketPlacePermissionsManager } from "./permissions-manager";
import { SequelizeRepository } from "../../../src/common/generator/repository";
import { fetchCondition } from "./config";

export class MarketPlaceRepository extends SequelizeRepository<MarketPlace> {
  protected model = MarketPlace;
  protected fetchCondition = fetchCondition;

  constructor(
    permissionsManager: MarketPlacePermissionsManager,
    filtersGenerator: MarketPlaceFiltersGenerator,
    orderGenerator: MarketPlaceOrderGenerator
  ) {
    super(permissionsManager, filtersGenerator, orderGenerator);
  }
}
