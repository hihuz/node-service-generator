import {
  AllowNull,
  Column,
  DataType,
  Model,
  Table,
} from "sequelize-typescript";

export enum EntityStatus {
  REGULAR = 1,
  ARCHIVED = 2,
  DELETED = 3,
}

@Table
export class Status extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  id!: EntityStatus;

  @AllowNull(false)
  @Column(DataType.STRING(20))
  name!: string;
}

export default Status;
