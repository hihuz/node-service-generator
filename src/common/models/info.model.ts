import { Column, Model, Table } from "sequelize-typescript";

@Table
export class Info extends Model {
  @Column({ primaryKey: true, autoIncrement: true })
  id!: number;

  @Column
  created_by_id?: number;

  @Column
  modified_by_id?: number;

  @Column
  deleted_by_id?: number;

  @Column
  created_at!: Date;

  @Column
  modified_at?: Date;

  @Column
  deleted_at?: Date;
}

export default Info;
