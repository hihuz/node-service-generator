import Country from "../../models/country";
import { CountryDataProvider } from "../dataprovider/dataprovider";
import { CrudController } from "../../../common/controller/crud.controller";

export class CountryController extends CrudController<Country> {
  protected routeSegment = "country";

  /**
   * @inheritDoc
   */
  protected createDataProvider(): CountryDataProvider {
    return new CountryDataProvider();
  }
}
