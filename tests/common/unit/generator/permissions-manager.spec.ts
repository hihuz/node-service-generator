import * as _ from "lodash";
import * as sinon from "sinon";

import {
  Address,
  Contact,
  Product,
  SupplyNetwork,
  createSequelizeInstance,
} from "./fixtures/models";
import { Op, Sequelize } from "sequelize";

import { ApplicationError } from "../../../../src/common/errors/application-error.class";
import { AuthContextMetadata } from "../../../../src/common/context/auth-context-metadata.class";
import { ClientError } from "../../../../src/common/errors/client-error.config";
import { PermissionsManager } from "../../../../src/common/generator/permissions-manager";
import { expect } from "chai";

describe("PermissionsManager", () => {
  let sandbox: sinon.SinonSandbox;
  let findOneProductStub: sinon.SinonStub;
  let findOneSupplyNetworkStub: sinon.SinonStub;
  let findOneContactStub: sinon.SinonStub;
  let logErrorStub: sinon.SinonStub;
  let manager: PermissionsManager<Product>;
  let traceLevel: string;

  const permissionsDefinitions = [
    "market_place",
    "demand_source_id",
    "address",
    "seat_id",
    "status",
    "metadata",
  ].map((key) => ({
    key,
    shouldApply: (state: AuthContextMetadata) => {
      const metadata = state.getMetadata();

      return !!metadata[key];
    },
  }));

  before(() => {
    traceLevel = process.env.TRACE_LEVEL;
    sandbox = sinon.createSandbox();
    createSequelizeInstance();
    findOneProductStub = sandbox.stub(Product, "findOne");
    findOneSupplyNetworkStub = sandbox.stub(SupplyNetwork, "findOne");
    findOneContactStub = sandbox.stub(Contact, "findOne");
    logErrorStub = sandbox.stub(console, "error");
    sandbox.stub(Address, "unscoped").returns(Address);
    sandbox.stub(Contact, "unscoped").returns(Contact);
    sandbox.stub(SupplyNetwork, "unscoped").returns(SupplyNetwork);
  });

  beforeEach(() => {
    manager = new (class extends PermissionsManager<Product> {
      model = Product;
      definitions = permissionsDefinitions;
      pathMap = {
        address: "contacts.address.id",
        status: Sequelize.literal("test query"),
      };
    })();
  });

  afterEach(() => {
    sandbox.resetHistory();
  });

  after(() => {
    sandbox.restore();
    process.env.TRACE_LEVEL = traceLevel;
  });

  describe("#generateCondition", () => {
    it("should return an empty object if no definition applies to the state metadata", () => {
      // arrange
      const state = new AuthContextMetadata({
        some: "data",
      });

      //  act & assert
      expect(manager.generateCondition(state)).to.deep.eq({});
    });

    it("should return correct condition when the permission key is a direct association of the base entity", () => {
      // arrange
      const state = new AuthContextMetadata({
        market_place: [1, 2, 3],
      });

      // act
      const condition = manager.generateCondition(state);
      const expected = {
        where: { [Op.and]: [{ "$market_place.id$": { [Op.in]: [1, 2, 3] } }] },
      };

      // assert
      expect(_.isEqual(condition, expected)).to.be.true;
    });

    it("should return correct condition when the permission key is an attribute of the base entity", () => {
      // arrange
      const state = new AuthContextMetadata({
        demand_source_id: 321,
      });

      // act
      const condition = manager.generateCondition(state);
      const expected = {
        where: { [Op.and]: [{ demand_source_id: { [Op.in]: [321] } }] },
      };

      // assert
      expect(_.isEqual(condition, expected)).to.be.true;
    });

    it("should return correct condition when the permission key is a nested association resolved with the pathMap", () => {
      // arrange
      const state = new AuthContextMetadata({
        address: [4, 5, 6],
      });

      // act
      const condition = manager.generateCondition(state);
      const expected = {
        where: {
          [Op.and]: [{ "$contacts.address.id$": { [Op.in]: [4, 5, 6] } }],
        },
      };

      // assert
      expect(_.isEqual(condition, expected)).to.be.true;
    });

    it("should properly handle sequelize literal values in pathMap", () => {
      // arrange
      const state = new AuthContextMetadata({
        status: 321,
      });

      // act
      const result = manager.generateCondition(state);

      const expected = {
        where: {
          [Op.and]: [
            Sequelize.where(Sequelize.literal("test query"), {
              [Op.in]: [321],
            }),
          ],
        },
      };

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should return stored includes when defined", () => {
      // arrange
      const state = new AuthContextMetadata({
        market_place: [331],
      });

      manager["includes"] = [{ model: SupplyNetwork, as: "market_place" }];

      const expected = {
        where: { [Op.and]: [{ "$market_place.id$": { [Op.in]: [331] } }] },
        include: [{ model: SupplyNetwork, as: "market_place" }],
      };

      // act
      const result = manager.generateCondition(state);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });

    it("should infer path using model primary key when applicable", () => {
      // arrange
      const state = new AuthContextMetadata({
        metadata: [331],
      });

      const expected = {
        where: { [Op.and]: [{ "$metadata.pk$": { [Op.in]: [331] } }] },
      };

      // act
      const result = manager.generateCondition(state);

      // assert
      expect(_.isEqual(result, expected)).to.be.true;
    });
  });

  describe("#validateReadPermissions", () => {
    it("should not throw", async () => {
      // arrange
      const state = new AuthContextMetadata({});

      // act & assert
      await manager.validateReadPermissions(state);
    });
  });

  describe("#validateCreatePermissions", () => {
    const marketplaceCondition = {
      where: { [Op.and]: [{ id: 2 }, { id: { [Op.in]: [1, 2, 3] } }] },
    };
    const contactCondition = {
      where: { id: 3 },
      include: [
        { model: Address, where: { id: { [Op.in]: [4] } }, required: true },
      ],
    };

    describe("when the user has all permissions for the entity to create", () => {
      it("should fetch the entity with generated permissions restrictions and not throw an error", async () => {
        // arrange
        findOneSupplyNetworkStub.resolves({ id: 2 });
        findOneContactStub.resolves({ id: 3 });

        const state = new AuthContextMetadata({
          market_place: [1, 2, 3],
          address: 4,
        });

        // act
        await manager.validateCreatePermissions(state, {
          market_place: { id: 2 },
          contacts: { first_name: "John", id: 3 },
        });

        // assert
        expect(findOneSupplyNetworkStub.callCount).to.eq(1);
        expect(
          _.isEqual(
            findOneSupplyNetworkStub.getCall(0).args[0],
            marketplaceCondition
          )
        ).to.be.true;
        expect(findOneContactStub.callCount).to.eq(1);
        expect(
          _.isEqual(findOneContactStub.getCall(0).args[0], contactCondition)
        ).to.be.true;
      });
    });

    describe("when the user is missing some permissions for the entity to create", () => {
      it("should fetch the entity with generated permissions restrictions and throw an error", async () => {
        // arrange
        findOneSupplyNetworkStub.resolves(null);

        const state = new AuthContextMetadata({
          market_place: [1, 2, 3],
          address: 4,
        });

        try {
          // act
          await manager.validateCreatePermissions(state, {
            market_place: { id: 2 },
            contacts: { first_name: "John", id: 3 },
          });
          throw new Error("Validation should have failed!");
        } catch (err) {
          // assert
          expect(findOneSupplyNetworkStub.callCount).to.eq(1);
          expect(
            _.isEqual(
              findOneSupplyNetworkStub.getCall(0).args[0],
              marketplaceCondition
            )
          ).to.be.true;

          expect(err).instanceof(ApplicationError);
          expect(err.message).to.eq(
            "You do not have access to market_place '2'."
          );
          expect(err.code).to.eq(
            ClientError.AUTH.FORBIDDEN.NO_PERMISSIONS.code
          );
        }
      });
    });

    describe("when a direct association can't be found for a permission key", () => {
      it("should early return and log a warning", async () => {
        // arrange
        const state = new AuthContextMetadata({
          seat_id: 456,
        });

        // act
        await manager.validateCreatePermissions(state, {});

        // assert
        expect(logErrorStub.callCount).to.eq(1);
        expect(logErrorStub.getCall(0).args[0]).to.eq(
          `[validateCreatePermissions] No direct association was found for seat_id permission definition of Product.
                    Consider double checking your paths or overriding this method.`
        );
      });
    });

    describe("when the primary key of an entity to validate can't be found in the input payload", () => {
      it("should early return and log a warning", async () => {
        // arrange
        const state = new AuthContextMetadata({
          market_place: [456],
        });

        // act
        await manager.validateCreatePermissions(state, {
          market_place: { name: "marketplace" },
        });

        // assert
        expect(logErrorStub.callCount).to.eq(1);
        expect(logErrorStub.getCall(0).args[0]).to.eq(
          `[validateCreatePermissions] No id could be extracted from input for market_place permission definition of Product.
                    Consider double checking your paths or overriding this method.`
        );
      });
    });
  });

  const methods = [
    "validateUpdatePermissions",
    "validateDeletePermissions",
  ] as const;

  for (const method of methods) {
    describe(`#${method}`, () => {
      const marketplaceCondition = {
        where: { id: 123 },
        include: [
          {
            model: SupplyNetwork,
            where: { id: { [Op.in]: [1, 2, 3] } },
            required: true,
          },
        ],
      };
      const demandSourceCondition = {
        where: {
          [Op.and]: [{ id: 123 }, { demand_source_id: { [Op.in]: [321] } }],
        },
      };

      const addressCondition = {
        where: { id: 123 },
        include: [
          {
            model: Contact,
            required: true,
            include: [
              {
                model: Address,
                where: { id: { [Op.in]: [4, 5] } },
                required: true,
              },
            ],
          },
        ],
      };

      const statusCondition = {
        where: {
          [Op.and]: [
            { id: 123 },
            Sequelize.where(Sequelize.literal("test query"), {
              [Op.in]: [456],
            }),
          ],
        },
      };

      describe("when the user has all permissions for the requested entity", () => {
        it("should fetch the entity with generated permissions restrictions and not throw an error", async () => {
          // arrange
          findOneProductStub.resolves({ id: 123 });

          const state = new AuthContextMetadata({
            market_place: [1, 2, 3],
            demand_source_id: 321,
            address: [4, 5],
            status: 456,
          });

          // act
          await manager[method](state, 123);

          // assert
          expect(findOneProductStub.callCount).to.eq(4);
          // assert: findOne called with the correct condition
          expect(
            _.isEqual(
              findOneProductStub.getCall(0).args[0],
              marketplaceCondition
            )
          ).to.be.true;
          expect(
            _.isEqual(
              findOneProductStub.getCall(1).args[0],
              demandSourceCondition
            )
          ).to.be.true;
          expect(
            _.isEqual(findOneProductStub.getCall(2).args[0], addressCondition)
          ).to.be.true;
          expect(
            _.isEqual(findOneProductStub.getCall(3).args[0], statusCondition)
          ).to.be.true;
        });
      });

      describe("when the user is missing some permissions for the requested entity", () => {
        it("should fetch the entity with generated permissions restrictions and throw an error", async () => {
          // arrange
          findOneProductStub.resolves(null);

          const state = new AuthContextMetadata({
            demand_source_id: 321,
          });

          try {
            // act
            await manager[method](state, 123);
            throw new Error("Validation should have failed!");
          } catch (err) {
            // assert
            expect(findOneProductStub.callCount).to.eq(1);
            // assert: findOne called with the correct condition
            expect(
              _.isEqual(
                findOneProductStub.getCall(0).args[0],
                demandSourceCondition
              )
            ).to.be.true;

            expect(err).instanceof(ApplicationError);
            expect(err.message).to.eq(
              ClientError.AUTH.FORBIDDEN.NO_PERMISSIONS.message
            );
            expect(err.code).to.eq(
              ClientError.AUTH.FORBIDDEN.NO_PERMISSIONS.code
            );
          }
        });
      });
    });
  }
});
