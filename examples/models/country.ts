import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Table,
  UpdatedAt,
} from "sequelize-typescript";

import EntityModel from "../../src/common/models/entity.model";

@Table({ timestamps: true })
export class Country extends EntityModel {
  @Column({ primaryKey: true, autoIncrement: true })
  id!: number;

  @AllowNull(false)
  @Column(DataType.STRING(2))
  code!: string;

  @AllowNull(false)
  @Column(DataType.STRING(128))
  name!: string;

  @CreatedAt
  initial_date!: Date;

  @UpdatedAt
  last_change_date!: Date;

  @Column(DataType.TINYINT)
  sort_order!: number;
}

export default Country;
