import { Model, ModelCtor } from "sequelize-typescript";

import { AssociationBuilder } from "./association-builder";
import { ClientError } from "../errors/client-error.config";
import { ContextRequest } from "../context/context-request.class";
import { Direction } from "./types/direction";
import { OrderItem } from "sequelize";
import { TimestampsManager } from "./timestamps-manager";

const DESCENDING_DIRECTION_CHAR = "-";

export abstract class OrderGenerator<
  T extends Model
> extends AssociationBuilder<T> {
  protected abstract model: ModelCtor<T>;
  protected associationError =
    ClientError.CRUD.BAD_REQUEST.INVALID_SORT_BY_OPERATOR;

  constructor(private timestampsManager?: TimestampsManager<T>) {
    super();
  }

  /**
   * Generate a sequelize ORDER BY condition from a request's query parameters.
   *
   * @param request ContextRequest
   * @returns { order: Order } | {}
   */
  public generateCondition(request: ContextRequest): { order: OrderItem[] } {
    const sortBy = request.getSortBy();

    // always provide a default order with a unique key, to be able to do proper pagination
    const defaultOrder: [string, string] = [
      this.model.primaryKeyAttribute,
      "ASC",
    ];

    if (!sortBy) {
      return { order: [defaultOrder] };
    }

    const orderQueries = sortBy.split(/\s*,\s*/);

    const orderByConditions = orderQueries.map((query) => {
      const direction = query.startsWith(DESCENDING_DIRECTION_CHAR)
        ? Direction.DESC
        : Direction.ASC;
      const queryPath = query.replace(/^-/, "");

      if (
        ["updated_since", "updated_at"].includes(queryPath) &&
        !!this.timestampsManager
      ) {
        return [this.timestampsManager.generateUpdatedAtLiteral(), direction];
      }

      const { associations, field } =
        this.extractAndValidatePathData(queryPath);

      return [...associations, field, direction];
    }) as OrderItem[];
    orderByConditions.push(defaultOrder);

    return { order: orderByConditions };
  }
}
