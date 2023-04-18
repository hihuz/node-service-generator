import { MarketPlace } from "../../models/market_place";
import { MarketPlaceDataProvider } from "../dataprovider/dataprovider";
import { CrudController } from "../../../src/common/controller/crud.controller";

export class MarketPlaceController extends CrudController<MarketPlace> {
  protected routeSegment = "market_place";

  /**
   * @inheritDoc
   */
  protected createDataProvider(): MarketPlaceDataProvider {
    return new MarketPlaceDataProvider();
  }
}
