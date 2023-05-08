import Currency from "../../models/currency";
import { Validator } from "../../../common/generator/validator";

export class CurrencyValidator extends Validator<Currency> {
  protected model = Currency;
}
