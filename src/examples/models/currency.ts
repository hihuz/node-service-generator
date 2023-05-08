import { AllowNull, Column, DataType, Table } from "sequelize-typescript";

import EntityModel from "../../common/models/entity.model";

@Table
export class Currency extends EntityModel {
  @Column({
    type: DataType.SMALLINT,
    primaryKey: true,
    field: "numeric_code",
  })
  id!: number;

  @AllowNull(false)
  @Column({ type: DataType.STRING(3), field: "alphabetic_code" })
  code!: string;

  @AllowNull(false)
  @Column(DataType.STRING(128))
  name!: string;

  @Column(DataType.STRING(8))
  symbol?: string;

  @Column(DataType.DOUBLE)
  exchange_rate?: number;

  @Column(DataType.SMALLINT)
  sort_order_id!: number;
}

export default Currency;
