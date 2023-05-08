import Country from "../../models/country";
import { Validator } from "../../../common/generator/validator";

export class CountryValidator extends Validator<Country> {
  protected model = Country;
}
