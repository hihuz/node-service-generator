import { OrderItem } from "sequelize";

import { ContextRequest } from "../../../common/context/context-request.class";
import Currency from "../../models/currency";
import { Direction } from "../../../common/generator/types/direction";
import { OrderGenerator } from "../../../common/generator/order-generator";

export class CurrencyOrderGenerator extends OrderGenerator<Currency> {
  protected model = Currency;

  /**
   * @inheritDoc
   */
  public generateCondition(request: ContextRequest) {
    const parentCondition = super.generateCondition(request);

    const order: OrderItem[] = [["sort_order_id", Direction.ASC]];

    return {
      order: [...order, ...parentCondition.order],
    };
  }
}
