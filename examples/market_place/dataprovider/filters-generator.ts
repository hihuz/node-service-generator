import { FiltersGenerator } from "../../../src/common/generator/filters-generator";
import MarketPlace from "../../models/market_place";

export class MarketPlaceFiltersGenerator extends FiltersGenerator<MarketPlace> {
  protected model = MarketPlace;
}
