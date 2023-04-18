import { Validator } from "../../../src/common/generator/validator";
import MarketPlace from "../../models/market_place";

export class MarketPlaceValidator extends Validator<MarketPlace> {
  protected model = MarketPlace;
}
