import { ContextRequest } from "../../../common/context/context-request.class";
import Country from "../../models/country";
import { Direction } from "../../../common/generator/types/direction";
import { OrderGenerator } from "../../../common/generator/order-generator";
import { OrderItem } from "sequelize";

export class CountryOrderGenerator extends OrderGenerator<Country> {
  protected model = Country;

  /**
   * @inheritDoc
   */
  public generateCondition(request: ContextRequest): { order: OrderItem[] } {
    const sortBy = request.getSortBy();

    const defaultOrder: OrderItem[] = [
      ["sort_order", Direction.DESC],
      ["name", Direction.ASC],
    ];

    if (!sortBy) {
      return { order: defaultOrder };
    }

    return super.generateCondition(request);
  }
}
