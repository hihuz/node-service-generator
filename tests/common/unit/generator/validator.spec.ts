import * as _ from "lodash";
import * as sinon from "sinon";

import {
  Contact,
  DemandSource,
  Order,
  Product,
  ProductMetadata,
  SupplyNetwork,
  createSequelizeInstance,
} from "./fixtures/models";

import { ApplicationError } from "../../../../src/common/errors/application-error.class";
import { AuthContextMetadata } from "../../../../src/common/context/auth-context-metadata.class";
import { Validator } from "../../../../src/common/generator/validator";
import { Op } from "sequelize";
import { expect } from "chai";

describe("Validator", () => {
  let validator: Validator<Product>;
  let sandbox: sinon.SinonSandbox;
  let findAllContactStub: sinon.SinonStub;
  let findSupplyNetworkByPkStub: sinon.SinonStub;
  let findAllOrderStub: sinon.SinonStub;
  let findDemandSourceByPkStub: sinon.SinonStub;
  let findMetadataByPkStub: sinon.SinonStub;

  before(() => {
    createSequelizeInstance();
    validator = new (class extends Validator<Product> {
      model = Product;
      immutablePaths = [
        "market_place.id",
        "demand_source.id",
        "seat.id",
        "creative_approval_required",
      ];
      associationModelMapping = {};
    })();
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    findAllContactStub = sandbox.stub(Contact, "findAll");
    findSupplyNetworkByPkStub = sandbox.stub(SupplyNetwork, "findByPk");
    findAllOrderStub = sandbox.stub(Order, "findAll");
    findDemandSourceByPkStub = sandbox.stub(DemandSource, "findByPk");
    findMetadataByPkStub = sandbox.stub(ProductMetadata, "findByPk");
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("#validateImmutablePaths", () => {
    const input = {
      name: "John",
      market_place: {
        id: 123,
      },
      seat: {
        id: 1,
      },
    };
    const record = {
      name: "Doe",
      market_place: {
        id: 321,
      },
      demand_source: {
        id: 456,
      },
      seat: {
        id: 1,
      },
    };

    it("should throw if an input value is different from an existing record value for an immutable property", () => {
      try {
        // arrange & act
        validator.validateImmutableFields(input, record);
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq("Field 'market_place.id' cannot be updated.");
        expect(err.code).to.eq(400);
      }
    });

    it("should pass if no input values are different from existing record values for immutable properties", () => {
      // arrange & act & assert
      validator.validateImmutableFields(input, {
        ...record,
        market_place: { id: 123 },
      });
    });

    it("should pass if an existing record's value is null", () => {
      // arrange & act & assert
      validator.validateImmutableFields({ seat: { id: 123 } }, { seat: null });
    });

    it("should throw if an immutable input value is false", () => {
      // arrange & act & assert
      try {
        validator.validateImmutableFields(
          { creative_approval_required: false },
          { creative_approval_required: true }
        );
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          "Field 'creative_approval_required' cannot be updated."
        );
        expect(err.code).to.eq(400);
      }
    });
  });

  describe("#validateInput", () => {
    it("should not throw", async () => {
      // arrange
      const state = new AuthContextMetadata({});

      // act & assert
      await validator.validateInput({ completeInput: {}, state });
    });
  });

  describe("#validateRelations", () => {
    it("should not validate associations when corresponding payload has no primary key", async () => {
      // arrange
      const input: Record<string, any> = {
        name: "product",
        market_place: {
          name: "Some marketplace",
        },
        contacts: [
          { first_name: "John", email: "john@doe.com" },
          { first_name: "Jane", email: "jane@doe.com" },
        ],
        demand_source: "some string",
        orders: null,
        metadata: {
          // id is *not* the primary key for 'ProductMetadata'
          id: "123",
        },
      };

      // act
      await validator.validateRelations(input);

      // assert
      expect(findAllContactStub.callCount).to.eq(0);
      expect(findSupplyNetworkByPkStub.callCount).to.eq(0);
      expect(findAllOrderStub.callCount).to.eq(0);
      expect(findDemandSourceByPkStub.callCount).to.eq(0);
      expect(findMetadataByPkStub.callCount).to.eq(0);
    });

    it("should not throw when proper relations are found", async () => {
      // arrange
      findAllContactStub.resolves([{ id: 2 }, { id: 3 }]);
      findSupplyNetworkByPkStub.resolves({ id: 1 });
      findMetadataByPkStub.resolves({ id: 1 });

      const input = {
        name: "product",
        market_place: {
          id: 1,
        },
        contacts: [{ id: 2 }, { id: 3 }],
        metadata: { pk: 123 },
      };

      // act
      await validator.validateRelations(input);

      // assert
      expect(findAllContactStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAllContactStub.getCall(0).args, [
          { where: { id: { [Op.in]: [2, 3] } } },
        ])
      ).to.be.true;
      expect(findSupplyNetworkByPkStub.callCount).to.eq(1);
      expect(findSupplyNetworkByPkStub.getCall(0).args).to.deep.eq([1]);
      expect(findMetadataByPkStub.callCount).to.eq(1);
      expect(findMetadataByPkStub.getCall(0).args).to.deep.eq([123]);
    });

    it("should throw if has one relation is not found", async () => {
      // arrange
      findSupplyNetworkByPkStub.resolves(null);

      const input = {
        market_place: {
          id: 1,
        },
      };

      try {
        // act
        await validator.validateRelations(input);
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          "Provided id for field 'market_place' is invalid."
        );
        expect(err.code).to.eq(400);
      }
    });

    it("should throw if has many relation is not found", async () => {
      // arrange
      findAllContactStub.resolves([{ id: 3 }]);

      const input = {
        contacts: [{ id: 2 }, { id: 3 }],
      };

      try {
        // act
        await validator.validateRelations(input);
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert: entity with id 2 was not found, an error should have been thrown
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          "Provided id for field 'contacts' is invalid."
        );
        expect(err.code).to.eq(400);
      }
    });
  });
});
