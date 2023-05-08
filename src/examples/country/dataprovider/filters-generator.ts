import Country from "../../models/country";
import { FiltersGenerator } from "../../../common/generator/filters-generator";

export class CountryFiltersGenerator extends FiltersGenerator<Country> {
  protected model = Country;
}
