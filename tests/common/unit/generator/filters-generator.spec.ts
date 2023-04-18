import * as _ from "lodash";

import {
  DemandSource,
  Order,
  Product,
  ProductMetadata,
  SupplyNetwork,
  createSequelizeInstance,
} from "./fixtures/models";
import { Op, Sequelize } from "sequelize";

import { ApplicationError } from "../../../../src/common/errors/application-error.class";
import { AuthContextMetadata } from "../../../../src/common/context/auth-context-metadata.class";
import { ContextRequest } from "../../../../src/common/context/context-request.class";
import { FiltersGenerator } from "../../../../src/common/generator/filters-generator";
import { TimestampsManager } from "../../../../src/common/generator/timestamps-manager";
import { expect } from "chai";

describe("FiltersGenerator", () => {
  let generator: FiltersGenerator<Product>;

  before(() => {
    createSequelizeInstance();
  });

  beforeEach(() => {
    generator = new (class extends FiltersGenerator<Product> {
      model = Product;
      pathMap = {
        "contacts.email": "contacts.address.email",
        "contacts.phone": "contacts.address.phone",
        status: Sequelize.literal("test query"),
      };
    })();
  });

  describe("#generateCondition", () => {
    it("should early return if request is undefined", () => {
      const state = new AuthContextMetadata({});

      // arrange & act & assert
      expect(generator.generateCondition(state)).to.eq(undefined);
    });

    it("should return an empty object if filters is an empty array", () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({ filter: [] });

      // act & assert
      expect(generator.generateCondition(state, request)).to.deep.eq({});
    });

    it("should throw if an invalid operator is provided", () => {
      // arrange
      const request = new ContextRequest({
        filter: "contacts.first_name woo john",
      });
      const state = new AuthContextMetadata({});

      try {
        // act
        generator.generateCondition(state, request);
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq("Provided filter operator 'woo' is invalid.");
        expect(err.code).to.eq(400);
      }
    });

    it("should throw if 'is' operator is not used with 'null' / 'empty'", () => {
      // arrange
      const request = new ContextRequest({ filter: "contacts.email is cool" });
      const state = new AuthContextMetadata({});

      try {
        // act
        generator.generateCondition(state, request);
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          "Provided filter operator 'is' can only have 'null' value."
        );
        expect(err.code).to.eq(400);
      }
    });

    it("should throw if the requested filter path is invalid", () => {
      // arrange
      const request = new ContextRequest({
        filter: "contacts.invalid_field eq cool",
      });
      const state = new AuthContextMetadata({});

      try {
        // act
        generator.generateCondition(state, request);
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(generator["associationError"].message);
        expect(err.code).to.eq(generator["associationError"].code);
      }
    });

    it("should build a proper filter map for single filters", () => {
      // arrange
      const request = new ContextRequest({ filter: "contacts.email ct cool" });
      const state = new AuthContextMetadata({});
      const expected = {
        where: {
          [Op.and]: [{ "$contacts.address.email$": { [Op.like]: "%cool%" } }],
        },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly handle boolean filters", () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({ filter: "available eq true" });
      const expected = {
        where: { [Op.and]: [{ available: { [Op.eq]: true } }] },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly handle ct operator", () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({ filter: "name ct moo" });
      const expected = {
        where: { [Op.and]: [{ name: { [Op.like]: "%moo%" } }] },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly handle is null operator", () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({ filter: "geo_restriction is null" });
      const expected = {
        where: { [Op.and]: [{ geo_restriction: { [Op.is]: null as any } }] },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly handle isNot null operator", () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({
        filter: "geo_restriction isNot null",
      });
      const expected = {
        where: { [Op.and]: [{ geo_restriction: { [Op.not]: null as any } }] },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly handle is empty operator", () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({
        filter: "geo_restriction is empty",
      });
      const expected = {
        where: { [Op.and]: [{ geo_restriction: { [Op.eq]: "" as any } }] },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly handle isNot empty operator", () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({
        filter: "geo_restriction isNot empty",
      });
      const expected = {
        where: { [Op.and]: [{ geo_restriction: { [Op.not]: "" as any } }] },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly generate conditions for the search query parameter", () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({ q: "moo" });
      const expected = {
        where: {
          [Op.and]: [
            {
              [Op.or]: [
                { id: { [Op.like]: "%moo%" } },
                { name: { [Op.like]: "%moo%" } },
              ],
            },
          ],
        },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly handle in operator", () => {
      // arrange
      const request = new ContextRequest({
        filter: "market_place.id in 1,2 ,3, 4 , 5",
      });
      const state = new AuthContextMetadata({});

      const expected = {
        where: {
          [Op.and]: [
            {
              "$market_place.id$": { [Op.in]: ["1", "2", "3", "4", "5"] },
            },
          ],
        },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly handle notIn operator", () => {
      // arrange
      const request = new ContextRequest({
        filter: "market_place.id notIn 1,2 ,3, 4 , 5",
      });
      const state = new AuthContextMetadata({});

      const expected = {
        where: {
          [Op.and]: [
            {
              "$market_place.id$": { [Op.notIn]: ["1", "2", "3", "4", "5"] },
            },
          ],
        },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should build a proper filter condition for multiple nested, overlapping filters and a search query", () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({
        filter: [
          "delivery_start_date ge 2020-10-21",
          "delivery_start_date le 2021-11-05",
          "available eq false",
          "contacts.first_name eq john",
          "contacts.email eq cool@email.com",
          "contacts.phone ct +336",
          "market_place.id eq 321",
          "market_place.id in 123, 456",
        ],
        q: "rusty kettle",
      });
      const expected = {
        where: {
          [Op.and]: [
            { delivery_start_date: { [Op.gte]: "2020-10-21" } },
            { delivery_start_date: { [Op.lte]: "2021-11-05" } },
            { available: { [Op.eq]: false } },
            { "$contacts.first_name$": { [Op.eq]: "john" } },
            { "$contacts.address.email$": { [Op.eq]: "cool@email.com" } },
            { "$contacts.address.phone$": { [Op.like]: "%+336%" } },
            { "$market_place.id$": { [Op.eq]: "321" } },
            { "$market_place.id$": { [Op.in]: ["123", "456"] } },
            {
              [Op.or]: [
                { id: { [Op.like]: "%rusty kettle%" } },
                { name: { [Op.like]: "%rusty kettle%" } },
              ],
            },
          ],
        },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    describe("updated_since logic", () => {
      const sampleDate = new Date().toISOString();

      afterEach(() => {
        Order.options.timestamps = false;
        Product.options.timestamps = true;
        DemandSource.options.timestamps = true;
        ProductMetadata.options.timestamps = false;
        SupplyNetwork.options.timestamps = false;
      });

      it("should build a proper filter condition for updated_since filter", () => {
        Order.options.timestamps = true;
        Product.options.timestamps = true;
        DemandSource.options.timestamps = true;
        ProductMetadata.options.timestamps = true;
        SupplyNetwork.options.timestamps = false;

        const timestampsManager = new (class extends TimestampsManager<Order> {
          model = Order;
          updatedAtHierarchy = [
            {
              model: Product,
              include: [
                { model: DemandSource },
                { model: SupplyNetwork },
                { model: ProductMetadata },
              ],
            },
          ];
        })();

        const generator = new (class extends FiltersGenerator<Order> {
          model = Order;
          pathMap = {};
        })(timestampsManager);

        // arrange
        const state = new AuthContextMetadata({});
        const request = new ContextRequest({
          filter: [`updated_since gte ${sampleDate}`, "name eq Name"],
          q: "rusty kettle",
        });

        const expected = {
          where: {
            [Op.and]: [
              {
                [Op.or]: [
                  { "$Order.updated_at$": { [Op.gte]: sampleDate } },
                  { "$product.updated_at$": { [Op.gte]: sampleDate } },
                  {
                    "$product.demand_source.last_change_date$": {
                      [Op.gte]: sampleDate,
                    },
                  },
                  { "$product.metadata.updated_at$": { [Op.gte]: sampleDate } },
                ],
              },
              { name: { [Op.eq]: "Name" } },
              {
                [Op.or]: [
                  { id: { [Op.like]: "%rusty kettle%" } },
                  { name: { [Op.like]: "%rusty kettle%" } },
                ],
              },
            ],
          },
        };

        // act
        const result = generator.generateCondition(state, request);

        // assert
        expect(_.isEqual(result, expected)).to.be.true;
      });

      it("should build a proper filter condition for updated_since filter (for single includeables)", () => {
        Order.options.timestamps = false;
        Product.options.timestamps = true;

        const timestampsManager = new (class extends TimestampsManager<Order> {
          model = Order;
          updatedAtHierarchy = [{ model: Product }];
        })();

        const generator = new (class extends FiltersGenerator<Order> {
          model = Order;
          pathMap = {};
        })(timestampsManager);

        // arrange
        const state = new AuthContextMetadata({});
        const request = new ContextRequest({
          filter: [`updated_since gte ${sampleDate}`, "name eq Name"],
          q: "rusty kettle",
        });
        const expected = {
          where: {
            [Op.and]: [
              {
                [Op.or]: [{ "$product.updated_at$": { [Op.gte]: sampleDate } }],
              },
              { name: { [Op.eq]: "Name" } },
              {
                [Op.or]: [
                  { id: { [Op.like]: "%rusty kettle%" } },
                  { name: { [Op.like]: "%rusty kettle%" } },
                ],
              },
            ],
          },
        };

        // act
        const result = generator.generateCondition(state, request);

        // assert
        expect(_.isEqual(result, expected)).to.be.true;
      });

      it("should build a proper filter condition for 'updated_since' filter for just the main model", () => {
        // arrange: set timestamps just for main model
        Order.options.timestamps = true;

        const state = new AuthContextMetadata({});

        [
          sampleDate,
          "2020-10-10",
          "2018-12-24T12:24:44Z",
          "2018-12-24T12:24:44.000-00:00",
          "2018-12-24T12:24:44.000+00:00",
        ].forEach((date) => {
          const timestampsManager =
            new (class extends TimestampsManager<Order> {
              model = Order;
            })();
          const generator = new (class extends FiltersGenerator<Order> {
            model = Order;
            pathMap = {};
          })(timestampsManager);

          // arrange
          const request = new ContextRequest({
            filter: [`updated_since gte ${date}`, "name eq Name"],
            q: "rusty kettle",
          });
          const expected = {
            where: {
              [Op.and]: [
                {
                  [Op.or]: [{ "$Order.updated_at$": { [Op.gte]: date } }],
                },
                { name: { [Op.eq]: "Name" } },
                {
                  [Op.or]: [
                    { id: { [Op.like]: "%rusty kettle%" } },
                    { name: { [Op.like]: "%rusty kettle%" } },
                  ],
                },
              ],
            },
          };

          // act
          const result = generator.generateCondition(state, request);

          // assert
          expect(_.isEqual(result, expected)).to.be.true;
        });
      });

      it("should throw an error if date format is wrong", () => {
        // arrange: set timestamps just for main model
        Order.options.timestamps = true;

        const state = new AuthContextMetadata({});

        [
          "2018-18-24T12:24:44.000Z",
          "2020-13-10",
          "2018-12-24T12:24:44.000+Z",
          "2018-12-24T38:24:44.000Z",
        ].forEach((date) => {
          const timestampsManager =
            new (class extends TimestampsManager<Order> {
              model = Order;
            })();

          const generator = new (class extends FiltersGenerator<Order> {
            model = Order;
            pathMap = {};
          })(timestampsManager);

          const request = new ContextRequest({
            filter: [`updated_since gte ${date}`, "name eq Name"],
            q: "rusty kettle",
          });

          try {
            // act
            generator.generateCondition(state, request);
            throw new Error("Validation should have failed!");
          } catch (err) {
            // assert
            expect(err).instanceof(ApplicationError);
            expect(err.message).to.eq(
              "Provided 'updated_since' property should be in ISO format: YYYY-MM-DDTHH:MM:SSZ."
            );
            expect(err.code).to.eq(400);
          }
        });
      });

      it("should throw an error if no timestamp fields are set in the model or connected relations", () => {
        // arrange: no relations have a timestamp field
        Order.options.timestamps = false;
        Product.options.timestamps = false;
        DemandSource.options.timestamps = false;
        ProductMetadata.options.timestamps = false;
        SupplyNetwork.options.timestamps = false;

        const timestampsManager = new (class extends TimestampsManager<Order> {
          model = Order;
          updatedAtHierarchy = [
            {
              model: Product,
              include: [
                { model: DemandSource },
                { model: SupplyNetwork },
                { model: ProductMetadata },
              ],
            },
          ];
        })();

        const generator = new (class extends FiltersGenerator<Order> {
          model = Order;
          pathMap = {};
        })(timestampsManager);

        // arrange
        const state = new AuthContextMetadata({});
        const request = new ContextRequest({
          filter: [`updated_since gte ${sampleDate}`, "name eq Name"],
          q: "rusty kettle",
        });

        try {
          // act
          generator.generateCondition(state, request);
          throw new Error("Validation should have failed!");
        } catch (err) {
          // assert
          expect(err).instanceof(ApplicationError);
          expect(err.message).to.eq(
            `The asked entity (or it\'s relations) do not contain any timestamp fields. \'updated_since\' filter is therefore invalid.`
          );
          expect(err.code).to.eq(400);
        }
      });
    });

    it("should properly handle columns with aliased property name", () => {
      // arrange
      const request = new ContextRequest({ filter: "metadata.data ct test" });
      const state = new AuthContextMetadata({});
      const expected = {
        where: { [Op.and]: [{ "$metadata.value$": { [Op.like]: "%test%" } }] },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert: the database column name is 'value', but the value exposed to users is 'data'.
      // this alias is defined in the 'ProductMetadata' model and the filter should use the
      // correct database name for the field.
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should properly handle sequelize literal fields", () => {
      // arrange
      const request = new ContextRequest({ filter: "status ct test" });
      const state = new AuthContextMetadata({});
      const expected = {
        where: {
          [Op.and]: [
            Sequelize.where(Sequelize.literal("test query"), {
              [Op.like]: "%test%",
            }),
          ],
        },
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should return stored includes when defined", () => {
      // arrange
      const request = new ContextRequest({ filter: "market_place.id eq 159" });
      const state = new AuthContextMetadata({});

      generator["includes"] = [{ model: DemandSource, as: "demand_source" }];

      const expected = {
        where: {
          [Op.and]: [{ "$market_place.id$": { [Op.eq]: "159" } }],
        },
        include: [{ model: DemandSource, as: "demand_source" }],
      };

      // act
      const result = generator.generateCondition(state, request);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should throw a proper error if the provided filter key is invalid", () => {
      // arrange
      const request = new ContextRequest({
        filter: "invalid.filter.id eq 123",
      });
      const state = new AuthContextMetadata({});

      try {
        // act
        generator.generateCondition(state, request);
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          "Provided value for 'filter' parameter is invalid."
        );
        expect(err.code).to.eq(400);
      }
    });
  });

  describe("#generateFilter", () => {
    it("should handle string typed fieldType properly", () => {
      // arrange & act
      const filterValue = generator["generateFilter"](
        "email",
        "true",
        "eq",
        "BOOLEAN"
      );

      // assert
      expect(_.isEqual(filterValue, { email: { [Op.eq]: true } })).to.be.true;
    });
  });
});
