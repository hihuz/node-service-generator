import {
  Address,
  Contact,
  DemandSource,
  Product,
  createSequelizeInstance,
} from "./fixtures/models";

import { ApplicationError } from "../../../../src/common/errors/application-error.class";
import { ContextRequest } from "../../../../src/common/context/context-request.class";
import { OrderGenerator } from "../../../../src/common/generator/order-generator";
import { Sequelize } from "sequelize";
import { TimestampsManager } from "../../../../src/common/generator/timestamps-manager";
import { expect } from "chai";

describe("OrderGenerator", () => {
  let generator: OrderGenerator<Product>;

  before(() => {
    createSequelizeInstance();
    generator = new (class extends OrderGenerator<Product> {
      model = Product;
      pathMap = {
        "contacts.email": "contacts.address.email",
        status: Sequelize.literal("test query"),
      };
    })();
  });

  describe("#generateCondition", () => {
    it("should sort by primaryKeyAttribute if the query does not have a 'sort_by' parameter", () => {
      // arrange
      const request = new ContextRequest({});

      // act & assert
      expect(generator.generateCondition(request)).to.deep.eq({
        order: [["id", "ASC"]],
      });
    });

    it("should throw if the provided 'sort_by' parameter is invalid", () => {
      // arrange
      const request = new ContextRequest({ sort_by: "contacts.invalidField" });

      try {
        // act
        generator.generateCondition(request);
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(generator["associationError"].message);
        expect(err.code).to.eq(generator["associationError"].code);
      }
    });

    it("should return proper clause for ascending and descending 'sort_by' parameters", () => {
      // arrange
      const ascendingRequest = new ContextRequest({
        sort_by: "contacts.first_name",
      });
      const descendingRequest = new ContextRequest({
        sort_by: "-market_place.id",
      });

      // act & assert
      expect(generator.generateCondition(ascendingRequest)).to.deep.eq({
        order: [
          [Product.associations.contacts, "first_name", "ASC"],
          ["id", "ASC"],
        ],
      });
      expect(generator.generateCondition(descendingRequest)).to.deep.eq({
        order: [
          [Product.associations.market_place, "id", "DESC"],
          ["id", "ASC"],
        ],
      });
    });

    it("should return proper clause for multiple 'sort_by' syntax", () => {
      // arrange
      const request = new ContextRequest({
        sort_by: "contacts.first_name,-market_place.id , contacts.last_name",
      });

      // act & assert
      expect(generator.generateCondition(request)).to.deep.eq({
        order: [
          [Product.associations.contacts, "first_name", "ASC"],
          [Product.associations.market_place, "id", "DESC"],
          [Product.associations.contacts, "last_name", "ASC"],
          ["id", "ASC"],
        ],
      });
    });

    it("should use pathMap to infer proper association chain and field name when appropriate", () => {
      // arrange
      const request = new ContextRequest({ sort_by: "contacts.email" });

      // act & assert
      expect(generator.generateCondition(request)).to.deep.eq({
        order: [
          [
            Product.associations.contacts,
            Contact.associations.address,
            "email",
            "ASC",
          ],
          ["id", "ASC"],
        ],
      });
    });

    it("should properly handle sequelize literal values in pathMap", () => {
      // arrange
      const request = new ContextRequest({ sort_by: "status" });

      // act & assert
      expect(generator.generateCondition(request)).to.deep.eq({
        order: [
          [Sequelize.literal("test query"), "ASC"],
          ["id", "ASC"],
        ],
      });
    });

    it("should generate a proper literal query for ordering on 'updated_at'", () => {
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

      generator = new (class extends OrderGenerator<Product> {
        model = Product;
        pathMap = {
          "contacts.email": "contacts.address.email",
          status: Sequelize.literal("test query"),
        };
      })(timestampsManager);

      const updatedAtSubQuery =
        "CAST(MAX(GREATEST(COALESCE(`Product`.updated_at,DATE('1970-1-1')),COALESCE(`contacts`.updated_at,DATE('1970-1-1')),COALESCE(`contacts->address`.updated_at,DATE('1970-1-1')),COALESCE(`demand_source`.last_change_date,DATE('1970-1-1')))) OVER (PARTITION BY Product.id) AS DATETIME)";

      const updatedSinceRequest = new ContextRequest({
        sort_by: "-updated_since",
      });

      // act & assert
      expect(generator.generateCondition(updatedSinceRequest)).to.deep.eq({
        order: [
          [Sequelize.literal(updatedAtSubQuery), "DESC"],
          ["id", "ASC"],
        ],
      });

      const updatedAtRequest = new ContextRequest({ sort_by: "updated_at" });

      // act & assert
      expect(generator.generateCondition(updatedAtRequest)).to.deep.eq({
        order: [
          [Sequelize.literal(updatedAtSubQuery), "ASC"],
          ["id", "ASC"],
        ],
      });
    });
  });
});
