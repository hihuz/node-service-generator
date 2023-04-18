import Currency from "../../models/currency";
import { CurrencyFiltersGenerator } from "./filters-generator";
import { CurrencyValidator } from "./validator";
import { CurrencyRepository } from "./repository";
import { CurrencySerializer } from "./serializer";
import { CurrencyOrderGenerator } from "./order-generator";
import { CurrencyPermissionsManager } from "./permissions-manager";
import { SequelizeDataProvider } from "../../../src/common/generator/dataprovider";

export class CurrencyDataProvider extends SequelizeDataProvider<Currency> {
  constructor() {
    const permissionsManager = new CurrencyPermissionsManager();
    const filtersGenerator = new CurrencyFiltersGenerator();
    const orderGenerator = new CurrencyOrderGenerator();

    super(
      new CurrencyRepository(
        permissionsManager,
        filtersGenerator,
        orderGenerator
      ),
      new CurrencySerializer(),
      new CurrencyValidator(),
      permissionsManager
    );
  }
}
