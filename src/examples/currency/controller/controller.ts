import { CrudController } from "../../../common/controller/crud.controller";
import Currency from "../../models/currency";
import { CurrencyDataProvider } from "../dataprovider/dataprovider";

export class CurrencyController extends CrudController<Currency> {
  protected routeSegment = "currency";

  /**
   * @inheritDoc
   */
  protected createDataProvider(): CurrencyDataProvider {
    return new CurrencyDataProvider();
  }
}
