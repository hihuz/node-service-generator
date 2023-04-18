import * as _ from "lodash";

import {
  Address,
  Contact,
  DemandSource,
  Product,
  createSequelizeInstance,
} from "./fixtures/models";

import { ApplicationError } from "../../../../src/common/errors/application-error.class";
import { Sequelize } from "sequelize-typescript";
import { TimestampsManager } from "../../../../src/common/generator/timestamps-manager";
import { expect } from "chai";

describe("TimestampsManager", () => {
  before(() => {
    createSequelizeInstance();
  });

  describe("#generateUpdatedAtLiteral", () => {
    it("should throw a meaningful error if the updated_at hierarchy is invalid", () => {
      // arrange
      const timestampsManager = new (class extends TimestampsManager<Product> {
        model = Product;
        updatedAtHierarchy = [
          {
            model: Contact,
            include: [{ model: DemandSource }],
          },
        ];
      })();

      try {
        // act
        timestampsManager.generateUpdatedAtLiteral();
        throw new Error("An error should have been thrown!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          "No association could be found for the source model (Contact) to the target model (DemandSource). Check the updatedAtHierarchy on your TimestampsManager."
        );
        expect(err.code).to.eq(500);
      }
    });

    it("should generate a proper literal for entities with no updatedAtHierarchy", () => {
      // arrange
      const timestampsManager = new (class extends TimestampsManager<Product> {
        model = Product;
      })();

      // act
      const result = timestampsManager.generateUpdatedAtLiteral();

      // assert
      expect(
        _.isEqual(
          result,
          Sequelize.literal(
            "CAST(COALESCE(`Product`.updated_at,DATE('1970-1-1')) AS DATETIME)"
          )
        )
      ).to.be.true;
    });

    it("should generate a proper literal for entities with an updatedAtHierarchy", () => {
      // arrange
      const timestampsManager = new (class extends TimestampsManager<Product> {
        model = Product;
        updatedAtHierarchy = [
          {
            model: Contact,
            include: [{ model: Address }],
          },
          {
            model: DemandSource,
          },
        ];
      })();

      // act
      const result = timestampsManager.generateUpdatedAtLiteral();

      // assert
      expect(
        _.isEqual(
          result,
          Sequelize.literal(
            "CAST(MAX(GREATEST(COALESCE(`Product`.updated_at,DATE('1970-1-1')),COALESCE(`contacts`.updated_at,DATE('1970-1-1')),COALESCE(`contacts->address`.updated_at,DATE('1970-1-1')),COALESCE(`demand_source`.last_change_date,DATE('1970-1-1')))) OVER (PARTITION BY Product.id) AS DATETIME)"
          )
        )
      ).to.be.true;
    });
  });
});
