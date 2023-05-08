import MarketPlace from "../../models/market_place";
import { OrderGenerator } from "../../../common/generator/order-generator";

export class MarketPlaceOrderGenerator extends OrderGenerator<MarketPlace> {
  protected model = MarketPlace;
}
