import { OrderItem, Sequelize } from "sequelize";

import { ContextRequest } from "../../../src/common/context/context-request.class";
import Currency from "../../models/currency";
import { Direction } from "../../../src/common/generator/types/direction";
import { OrderGenerator } from "../../../src/common/generator/order-generator";

export class CurrencyOrderGenerator extends OrderGenerator<Currency> {
  protected model = Currency;

  /**
   * @inheritDoc
   */
  public generateCondition(request: ContextRequest) {
    const parentCondition = super.generateCondition(request);

    const ISNULL_QUERY = Sequelize.literal(`ISNULL(\`sort_order_id\`)`);

    const order: OrderItem[] = [ISNULL_QUERY, ["sort_order_id", Direction.ASC]];

    return {
      order: [...order, ...parentCondition.order],
    };
  }
}
