import Country from "../../models/country";
import { CountryFiltersGenerator } from "./filters-generator";
import { CountryOrderGenerator } from "./order-generator";
import { CountryPermissionsManager } from "./permissions-manager";
import { SequelizeRepository } from "../../../src/common/generator/repository";
import { fetchCondition } from "./config";

export class CountryRepository extends SequelizeRepository<Country> {
  protected model = Country;
  protected fetchCondition = fetchCondition;

  constructor(
    permissionsManager: CountryPermissionsManager,
    filtersGenerator: CountryFiltersGenerator,
    orderGenerator: CountryOrderGenerator
  ) {
    super(permissionsManager, filtersGenerator, orderGenerator);
  }
}
