import Currency from "../../models/currency";
import { Validator } from "../../../src/common/generator/validator";

export class CurrencyValidator extends Validator<Currency> {
  protected model = Currency;
}
