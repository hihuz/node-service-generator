import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";

import EntityModel from "../../../../../src/common/models/entity.model";
import { Product } from "./models";

/**
 * These test models must be defined in another file to prevent circular dependencies with Product
 */

@Table
export class ProductMetadata extends Model {
  @Column({ primaryKey: true })
  pk: number;

  @Column({ field: "value" })
  data: string;

  @ForeignKey(() => Product)
  @Column
  product_id: number;

  @BelongsTo(() => Product)
  product: Product;
}

@Table
export class Order extends EntityModel {
  @Column({ primaryKey: true })
  id: number;

  @Column
  name: string;

  @AllowNull(false)
  @ForeignKey(() => Product)
  @Column
  product_id: number;

  @Column(DataType.VIRTUAL)
  computedProperty: string;

  @BelongsTo(() => Product)
  product: Product;
}
