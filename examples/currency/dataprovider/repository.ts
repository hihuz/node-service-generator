import Currency from "../../models/currency";
import { CurrencyFiltersGenerator } from "./filters-generator";
import { CurrencyOrderGenerator } from "./order-generator";
import { CurrencyPermissionsManager } from "./permissions-manager";
import { SequelizeRepository } from "../../../src/common/generator/repository";
import { fetchCondition } from "./config";

export class CurrencyRepository extends SequelizeRepository<Currency> {
  protected model = Currency;
  protected fetchCondition = fetchCondition;

  constructor(
    permissionsManager: CurrencyPermissionsManager,
    filtersGenerator: CurrencyFiltersGenerator,
    orderGenerator: CurrencyOrderGenerator
  ) {
    super(permissionsManager, filtersGenerator, orderGenerator);
  }
}
