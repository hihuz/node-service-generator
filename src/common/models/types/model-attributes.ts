import { Model } from "sequelize-typescript";

type ModelType = Omit<Model, "id">;

export type ModelAttributes<T> = Omit<T, keyof ModelType>;
