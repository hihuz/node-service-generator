import { AllowNull, Column, Table } from "sequelize-typescript";

import EntityModel from "./entity.model";

@Table
export class SupplyNetwork extends EntityModel {
  @Column({ primaryKey: true, autoIncrement: true })
  id!: number;

  @AllowNull(false)
  @Column
  name!: string;
}

export default SupplyNetwork;
