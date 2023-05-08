import Country from "../../models/country";
import { CountryFiltersGenerator } from "./filters-generator";
import { CountryValidator } from "./validator";
import { CountryRepository } from "./repository";
import { CountrySerializer } from "./serializer";
import { CountryOrderGenerator } from "./order-generator";
import { CountryPermissionsManager } from "./permissions-manager";
import { SequelizeDataProvider } from "../../../common/generator/dataprovider";

export class CountryDataProvider extends SequelizeDataProvider<Country> {
  constructor() {
    const permissionsManager = new CountryPermissionsManager();
    const filtersGenerator = new CountryFiltersGenerator();
    const orderGenerator = new CountryOrderGenerator();

    super(
      new CountryRepository(
        permissionsManager,
        filtersGenerator,
        orderGenerator
      ),
      new CountrySerializer(),
      new CountryValidator(),
      permissionsManager
    );
  }
}
