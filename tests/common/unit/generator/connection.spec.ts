import _ from "lodash";
import sinon from "sinon";

import { ApplicationError } from "../../../../src/common/errors/application-error.class";
import { Sequelize } from "sequelize-typescript";
import { SequelizeConnection } from "../../../../src/common/generator/connection";
import { expect } from "chai";

describe("SequelizeConnection", () => {
  let environment: any;

  beforeEach(() => {
    environment = { ...process.env };

    process.env.DB_HOST = "host";
    process.env.DB_USER = "user";
    process.env.DB_PASSWORD = "password";
    process.env.DB_SCHEMA = "database";
  });

  afterEach(() => {
    process.env = environment;
  });

  describe("#initialize", () => {
    beforeEach(() => {
      SequelizeConnection["instance"] = undefined;
    });

    afterEach(() => {
      SequelizeConnection["instance"] = undefined;
    });

    it("should setup and return a properly configured sequelize instance", () => {
      // arrange & act
      const sequelize = SequelizeConnection.initialize();

      // assert
      expect(
        _.pick(sequelize.config, [
          "database",
          "username",
          "password",
          "host",
          "port",
        ])
      ).to.deep.eq({
        database: "database",
        username: "user",
        password: "password",
        host: "host",
        port: "5432",
      });
    });

    for (const ENV_VAR of ["DB_USER", "DB_PASSWORD", "DB_HOST", "DB_SCHEMA"]) {
      it(`should throw if a ${ENV_VAR} environment variable is missing`, () => {
        // arrange
        process.env[ENV_VAR] = undefined;

        try {
          // act
          SequelizeConnection.initialize();
          throw new Error("Request should have failed!");
        } catch (err) {
          // assert
          expect(err).instanceof(ApplicationError);
          expect(err.message).to.eq(
            `Required environment variable missing: ${ENV_VAR}.`
          );
          expect(err.code).to.eq(500);
        }
      });
    }

    it("should log when DB_LOGGING is true", () => {
      // arrange
      process.env.DB_LOGGING = "true";

      // act
      const sequelize = SequelizeConnection.initialize();

      // assert
      expect(sequelize.options.logging).to.eq(console.log);
    });

    it("should throw when attempting to initialize a connection twice", () => {
      // arrange
      SequelizeConnection.initialize();

      try {
        // act
        SequelizeConnection.initialize();
        throw new Error("Initialization should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq("Sequelize was already initialized.");
        expect(err.code).to.eq(500);
      }
    });
  });

  describe("#getInstance", () => {
    let sequelize: Sequelize;
    let initializeSpy: sinon.SinonSpy;

    beforeEach(() => {
      SequelizeConnection["instance"] = undefined;
      initializeSpy = sinon.spy(SequelizeConnection, "initialize");
      sequelize = SequelizeConnection.getInstance();
    });

    afterEach(() => {
      SequelizeConnection["instance"] = undefined;
      initializeSpy.restore();
    });

    it("should call initialize only once to create the instance and always return the same instance", () => {
      // arrange & act & assert
      expect(sequelize).to.eq(SequelizeConnection.getInstance());
      expect(initializeSpy.callCount).to.eq(1);
    });
  });
});
