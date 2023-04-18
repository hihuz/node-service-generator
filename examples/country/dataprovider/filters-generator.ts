import Country from "../../models/country";
import { FiltersGenerator } from "../../../src/common/generator/filters-generator";

export class CountryFiltersGenerator extends FiltersGenerator<Country> {
  protected model = Country;
}
