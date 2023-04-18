import * as _ from "lodash";

import { Sequelize, SequelizeOptions } from "sequelize-typescript";

import { ApplicationError } from "../errors/application-error.class";
import { ServerError } from "../errors/server-error.config";

/**
 * A class which masks a sequelize database connection instance.
 */
export class SequelizeConnection {
  /**
   * Return the singleton instance.
   *
   * @returns Sequelize
   */
  public static getInstance(): Sequelize {
    if (!this.instance) {
      this.initialize();
    }

    return this.instance;
  }

  /**
   * Create the singleton sequelize instance and initialize the sequelize connection.
   *
   * @returns Sequelize
   */
  public static initialize(options?: SequelizeOptions): Sequelize {
    if (this.instance) {
      throw new ApplicationError(
        ServerError.SEQUELIZE.INTERNAL_SERVER_ERROR.ALREADY_INITIALIZED
      );
    }

    for (const requiredEnvVar of [
      "DB_USER",
      "DB_PASSWORD",
      "DB_HOST",
      "DB_SCHEMA",
    ]) {
      if (!process.env[requiredEnvVar]) {
        throw new ApplicationError(
          _.merge(
            ServerError.ENVIRONMENT.INTERNAL_SERVER_ERROR.VARIABLE_MISSING,
            {
              params: { variable: requiredEnvVar },
            }
          )
        );
      }
    }

    this.instance = new Sequelize(
      `mysql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${
        process.env.DB_HOST
      }:${process.env.DB_PORT || 3306}/${process.env.DB_SCHEMA}`,
      {
        models: [__dirname + "./models"],
        logging: process.env.DB_LOGGING === "true" ? console.log : false,
        pool: {
          max: Number(process.env.DB_POOL_MAX || 5),
        },
        hooks: {
          beforeDefine: (_attributes, options) => {
            options.tableName =
              options.tableName ?? _.snakeCase(options.modelName);
          },
        },
        define: {
          timestamps: false,
          underscored: true,
        },
        ...options,
      }
    );

    return this.instance;
  }

  // The singleton instance
  private static instance: Sequelize;
}
