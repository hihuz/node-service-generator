import Currency from "../../models/currency";
import { FiltersGenerator } from "../../../common/generator/filters-generator";
import { searchFields } from "./config";

export class CurrencyFiltersGenerator extends FiltersGenerator<Currency> {
  protected model = Currency;
  protected searchFields = searchFields;
}
