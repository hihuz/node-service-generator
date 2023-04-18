import * as _ from "lodash";
import * as sinon from "sinon";

import {
  Address,
  Contact,
  DemandSource,
  Order,
  Product,
  ProductContact,
  ProductMetadata,
  SupplyNetwork,
  createSequelizeInstance,
} from "./fixtures/models";
import { Association, FindOptions, Transaction } from "sequelize";
import {
  PermissionsDefinitions,
  PermissionsManager,
} from "../../../../src/common/generator/permissions-manager";

import { ApplicationError } from "../../../../src/common/errors/application-error.class";
import { AssociationType } from "../../../../src/common/generator/types/sequelize";
import { AuthContextMetadata } from "../../../../src/common/context/auth-context-metadata.class";
import { ClientError } from "../../../../src/common/errors/client-error.config";
import { ContextRequest } from "../../../../src/common/context/context-request.class";
import { EntityStatus } from "../../../../src/common/models/status.model";
import { FiltersGenerator } from "../../../../src/common/generator/filters-generator";
import Info from "../../../../src/common/models/info.model";
import { Op } from "sequelize";
import { OrderGenerator } from "../../../../src/common/generator/order-generator";
import { Sequelize } from "sequelize-typescript";
import { SequelizeRepository } from "../../../../src/common/generator/repository";
import { TimestampsManager } from "../../../../src/common/generator/timestamps-manager";
import { expect } from "chai";

const fetchCondition: FindOptions = {
  include: [
    { model: SupplyNetwork },
    { model: DemandSource },
    {
      model: Contact,
      through: { attributes: [] },
      required: false,
      include: [{ model: Address }],
    },
  ],
  where: {
    demand_source_id: 28,
  },
};
const permissionsDefinitions = [
  { key: "market_place" },
  {
    key: "demand_source_id",
    shouldApply: (state: AuthContextMetadata) => {
      const metadata = state.getMetadata();

      return !!metadata.demand_source_id;
    },
  },
  {
    key: "address",
    shouldApply: (state: AuthContextMetadata) => {
      const metadata = state.getMetadata();

      return !!metadata.address;
    },
  },
];

const updatedAtSubQuery =
  "CAST(MAX(GREATEST(COALESCE(`Product`.updated_at,DATE('1970-1-1')),COALESCE(`contacts`.updated_at,DATE('1970-1-1')),COALESCE(`contacts->address`.updated_at,DATE('1970-1-1')),COALESCE(`demand_source`.last_change_date,DATE('1970-1-1')))) OVER (PARTITION BY Product.id) AS DATETIME)";

describe("SequelizeRepository", () => {
  let repository: SequelizeRepository<Product>;
  let permissionsManager: PermissionsManager<Product>;
  let filtersGenerator: FiltersGenerator<Product>;
  let orderGenerator: OrderGenerator<Product>;
  let sandbox: sinon.SinonSandbox;
  let findAllProductStub: sinon.SinonStub;
  let findAndCountAllProductStub: sinon.SinonStub;
  let upsertInfoStub: sinon.SinonStub;
  let createProductStub: sinon.SinonStub;
  let updateProductStub: sinon.SinonStub;
  let createContactStub: sinon.SinonStub;
  let createProductContactStub: sinon.SinonStub;
  let destroyProductContactStub: sinon.SinonStub;
  let createAddressStub: sinon.SinonStub;
  let createMetadataStub: sinon.SinonStub;
  let findByPkProductStub: sinon.SinonStub;
  let updateOrderStub: sinon.SinonStub;
  let createOrderStub: sinon.SinonStub;

  before(() => {
    createSequelizeInstance();
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox
      .stub(Sequelize.prototype, "transaction" as any)
      .callsFake(async (fn: any) => {
        const results = await fn({ fake: "transaction" });

        return results;
      });
    findAndCountAllProductStub = sandbox
      .stub(Product, "findAndCountAll")
      .resolves();
    findAllProductStub = sandbox.stub(Product, "findAll").resolves();
    createProductStub = sandbox.stub(Product, "create").resolves();
    updateProductStub = sandbox.stub(Product.prototype, "update").resolves();
    findByPkProductStub = sandbox.stub(Product, "findByPk").resolves();
    createContactStub = sandbox.stub(Contact, "create").resolves();
    createAddressStub = sandbox.stub(Address, "create").resolves();
    createMetadataStub = sandbox.stub(ProductMetadata, "create").resolves();
    createProductContactStub = sandbox
      .stub(ProductContact, "create")
      .resolves();
    destroyProductContactStub = sandbox
      .stub(ProductContact, "destroy")
      .resolves();
    createOrderStub = sandbox.stub(Order, "create").resolves();
    sandbox.stub(Order, "findByPk").resolves();
    updateOrderStub = sandbox.stub(Order, "update").resolves();
    sandbox.stub(Order.prototype, "update").resolves();
    upsertInfoStub = sandbox.stub(Info, "upsert").resolves([] as any);

    permissionsManager = new (class extends PermissionsManager<Product> {
      model = Product;
      definitions = permissionsDefinitions;
      pathMap = {
        address: "contacts.address.id",
      };
    })();

    orderGenerator = new (class extends OrderGenerator<Product> {
      model = Product;
      pathMap = {
        "contacts.email": "contacts.address.email",
        "contacts.phone": "contacts.address.phone",
      };
    })();
    filtersGenerator = new (class extends FiltersGenerator<Product> {
      model = Product;
      pathMap = {
        "contacts.email": "contacts.address.email",
        "contacts.phone": "contacts.address.phone",
      };
    })();

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

    repository = new (class extends SequelizeRepository<Product> {
      model = Product;
      fetchCondition = fetchCondition;
    })(permissionsManager, filtersGenerator, orderGenerator, timestampsManager);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("#getItem", () => {
    it("should fetch one item with properly generated options", async () => {
      // arrange
      const state = new AuthContextMetadata({
        market_place: [17, 37],
        address: 43,
      });
      const expectedOptions: FindOptions = {
        include: fetchCondition.include,
        where: {
          [Op.and]: [
            {
              [Op.and]: [
                { demand_source_id: 28 },
                {
                  [Op.and]: [
                    { "$market_place.id$": { [Op.in]: [17, 37] } },
                    { "$contacts.address.id$": { [Op.in]: [43] } },
                  ],
                },
              ],
            },
            { id: 1 },
          ],
        },
        attributes: {
          include: [[Sequelize.literal(updatedAtSubQuery), "updated_at"]],
        },
      };
      findAllProductStub.resolves([{ id: 123 }]);

      // act
      const result = await repository.getItem(state, 1);

      // assert
      expect(result).to.deep.eq({ id: 123 });
      expect(findAllProductStub.callCount).to.eq(1);
      expect(_.isEqual(findAllProductStub.getCall(0).args[0], expectedOptions))
        .to.be.true;
    });

    it("should throw an ITEM_NOT_FOUND error if item is not found", async () => {
      // arrange
      const state = new AuthContextMetadata({
        market_place: [17, 37],
        address: 43,
      });
      findAllProductStub.resolves([]);

      try {
        // act
        await repository.getItem(state, 1);
        throw new Error("Request should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          ClientError.CRUD.NOT_FOUND.ITEM_NOT_FOUND.message
        );
        expect(err.code).to.eq(ClientError.CRUD.NOT_FOUND.ITEM_NOT_FOUND.code);
      }
    });
  });

  describe("#getList", () => {
    it("should fetch a list of items with properly generated options", async () => {
      // arrange
      const state = new AuthContextMetadata({
        market_place: [54, 96],
        address: 2,
      });
      const request = new ContextRequest({
        filter: [
          "delivery_start_date ge 2020-10-22",
          "delivery_start_date le 2021-12-05",
          "available eq true",
          "contacts.first_name eq john",
          "contacts.email eq cool@email.com",
          "contacts.phone ct +336",
          "market_place.id in 123, 96",
        ],
        sort_by: "contacts.first_name, -market_place.id",
        page_size: 45,
        page: 3,
      });
      const where = {
        [Op.and]: [
          { demand_source_id: 28 },
          {
            [Op.and]: [
              { "$market_place.id$": { [Op.in]: [54, 96] } },
              { "$contacts.address.id$": { [Op.in]: [2] } },
            ],
          },
          {
            [Op.and]: [
              { delivery_start_date: { [Op.gte]: "2020-10-22" } },
              { delivery_start_date: { [Op.lte]: "2021-12-05" } },
              { available: { [Op.eq]: true } },
              { "$contacts.first_name$": { [Op.eq]: "john" } },
              { "$contacts.address.email$": { [Op.eq]: "cool@email.com" } },
              { "$contacts.address.phone$": { [Op.like]: "%+336%" } },
              { "$market_place.id$": { [Op.in]: ["123", "96"] } },
            ],
          },
        ],
      };
      const order = [
        [Product.associations.contacts, "first_name", "ASC"],
        [Product.associations.market_place, "id", "DESC"],
        ["id", "ASC"],
      ];
      const attributes = {
        include: [[Sequelize.literal(updatedAtSubQuery), "updated_at"]],
      };
      const findAllResponse = [
        { id: 21, name: "Product 21" },
        { id: 43, name: "Product 43" },
      ];
      findAndCountAllProductStub.resolves({
        rows: [{ id: 21 }, { id: 43 }],
        count: [{ count: 1 }, { count: 1 }],
      });
      findAllProductStub.resolves(findAllResponse);

      // act
      const result = await repository.getList(state, request);

      // assert
      expect(result).to.deep.eq([findAllResponse, 2]);
      expect(findAndCountAllProductStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAndCountAllProductStub.getCall(0).args[0], {
          include: fetchCondition.include,
          where,
          order,
          limit: 45,
          offset: 90,
          group: "Product.id",
          attributes,
        })
      ).to.be.true;
      expect(findAllProductStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAllProductStub.getCall(0).args[0], {
          include: fetchCondition.include,
          where: {
            [Op.and]: [{ id: { [Op.in]: [21, 43] } }, { demand_source_id: 28 }],
          },
          order,
          attributes,
        })
      ).to.be.true;
    });

    it("should properly handle empty filters and permissions conditions", async () => {
      // arrange
      permissionsManager["definitions"] = [];

      const state = new AuthContextMetadata({});
      const request = new ContextRequest({});
      const findAllResponse = [
        { id: 12, name: "Product 12" },
        { id: 34, name: "Product 34" },
      ];
      findAndCountAllProductStub.resolves({
        rows: [{ id: 12 }, { id: 34 }],
        count: [{ count: 1 }, { count: 1 }],
      });
      findAllProductStub.resolves(findAllResponse);

      const order = [["id", "ASC"]];
      const attributes = {
        include: [[Sequelize.literal(updatedAtSubQuery), "updated_at"]],
      };

      // act
      const result = await repository.getList(state, request);

      // assert
      expect(result).to.deep.eq([findAllResponse, 2]);
      expect(findAndCountAllProductStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAndCountAllProductStub.getCall(0).args[0], {
          include: fetchCondition.include,
          where: {
            demand_source_id: 28,
          },
          order,
          limit: 25,
          offset: 0,
          group: "Product.id",
          attributes,
        })
      ).to.be.true;
      expect(findAllProductStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAllProductStub.getCall(0).args[0], {
          include: fetchCondition.include,
          order,
          where: {
            [Op.and]: [{ id: { [Op.in]: [12, 34] } }, { demand_source_id: 28 }],
          },
          attributes,
        })
      ).to.be.true;

      permissionsManager["definitions"] = permissionsDefinitions;
    });

    it("should handle non-array include", async () => {
      // arrange
      repository = new (class extends SequelizeRepository<Product> {
        model = Product;
        fetchCondition = { include: { model: SupplyNetwork } };
      })(permissionsManager, filtersGenerator, orderGenerator);

      const state = new AuthContextMetadata({
        market_place: [54, 96],
      });
      const request = new ContextRequest({});
      const findAllResponse = [
        { id: 21, name: "Product 21" },
        { id: 43, name: "Product 43" },
      ];
      findAndCountAllProductStub.resolves({
        rows: [{ id: 21 }, { id: 43 }],
        count: [{ count: 1 }, { count: 1 }],
      });
      findAllProductStub.resolves(findAllResponse);

      const order = [["id", "ASC"]];

      // act
      const result = await repository.getList(state, request);

      // assert
      expect(result).to.deep.eq([findAllResponse, 2]);
      expect(findAndCountAllProductStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAndCountAllProductStub.getCall(0).args[0], {
          include: [{ model: SupplyNetwork }],
          order,
          where: {
            [Op.and]: [{ "$market_place.id$": { [Op.in]: [54, 96] } }],
          },
          limit: 25,
          offset: 0,
          group: "Product.id",
        })
      ).to.be.true;
      expect(findAllProductStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAllProductStub.getCall(0).args[0], {
          include: { model: SupplyNetwork },
          order,
          where: { [Op.and]: [{ id: { [Op.in]: [21, 43] } }, undefined] },
        })
      ).to.be.true;
    });
  });

  describe("#createItem", () => {
    it("should properly create all relevant entities", async () => {
      // arrange
      const state = new AuthContextMetadata({
        internal: { id: 987 },
      });
      const input = {
        supply_network_id: 17,
        demand_source_id: 28,
        name: "product name",
        geo_restriction: 2,
        available: true,
        metadata: {
          data: "sample",
        },
        contacts: [
          {
            first_name: "John",
            last_name: "Doe",
            address: {
              email: "john@doe.com",
              phone: "+3367890",
            },
          },
          {
            first_name: "Jane",
            last_name: "Doe",
            address: {
              email: "jane@doe.com",
              phone: "+3309876",
            },
          },
        ],
      };
      const item = {
        id: 357,
        ...input,
      };

      findAllProductStub.resolves([item]);
      createProductStub.resolves({ id: 357 });
      createContactStub.onFirstCall().resolves({ id: 1 });
      createContactStub.onSecondCall().resolves({ id: 2 });
      createAddressStub.onFirstCall().resolves({ id: 4 });
      createAddressStub.onSecondCall().resolves({ id: 5 });
      createMetadataStub.resolves({ id: 468 });
      createProductContactStub.resolves();
      upsertInfoStub.onFirstCall().resolves([Info.build({ id: 23 })]);
      upsertInfoStub.onSecondCall().resolves([Info.build({ id: 45 })]);
      upsertInfoStub.onThirdCall().resolves([Info.build({ id: 67 })]);

      // act
      const result = await repository.createItem(state, input);

      // assert: three Info should be created:
      // one for the Product and one for each Contact
      expect(upsertInfoStub.callCount).to.eq(3);

      const createInfoArgs = upsertInfoStub
        .getCalls()
        .map(({ args }) => args[0]);

      for (const arg of createInfoArgs) {
        expect(arg).to.deep.eq({
          created_at: {
            args: [],
            fn: "NOW",
          },
          created_by_id: 987,
        });
      }

      // assert: one Product should be created with proper attributes and FKs
      expect(createProductStub.callCount).to.eq(1);
      expect(createProductStub.getCall(0).args[0]).to.deep.eq({
        supply_network_id: 17,
        demand_source_id: 28,
        name: "product name",
        geo_restriction: 2,
        available: true,
        info_id: 23,
      });
      // assert: two Address should be created (one for each contact)
      expect(createAddressStub.callCount).to.eq(2);
      expect(createAddressStub.getCall(0).args[0]).to.deep.eq({
        email: "john@doe.com",
        phone: "+3367890",
      });
      expect(createAddressStub.getCall(1).args[0]).to.deep.eq({
        email: "jane@doe.com",
        phone: "+3309876",
      });
      // assert: two Contacts should be created, with proper attributes and FKs
      expect(createContactStub.callCount).to.eq(2);
      expect(createContactStub.getCall(0).args[0]).to.deep.eq({
        first_name: "John",
        last_name: "Doe",
        address_id: 4,
        info_id: 45,
      });
      expect(createContactStub.getCall(1).args[0]).to.deep.eq({
        first_name: "Jane",
        last_name: "Doe",
        address_id: 5,
        info_id: 67,
      });
      // assert: two ProductContact should be created to link Product with its Contacts
      expect(createProductContactStub.callCount).to.eq(2);
      expect(createProductContactStub.getCall(0).args[0]).to.deep.eq({
        product_id: 357,
        contact_id: 1,
      });
      expect(createProductContactStub.getCall(1).args[0]).to.deep.eq({
        product_id: 357,
        contact_id: 2,
      });
      // assert: one Metadata should be created, with proper attributes and FKs
      expect(createMetadataStub.callCount).to.eq(1);
      expect(createMetadataStub.getCall(0).args[0]).to.deep.eq({
        product_id: 357,
        data: "sample",
      });

      expect(result).to.deep.eq(item);

      // assert: all write operations should be performed within the same transaction
      const createProductTransaction =
        createProductStub.getCall(0).args[1].transaction;
      const transactions = [
        ...createMetadataStub.getCalls(),
        ...createProductContactStub.getCalls(),
        ...createContactStub.getCalls(),
        ...createAddressStub.getCalls(),
        ...upsertInfoStub.getCalls(),
      ].map(({ args }) => args[1].transaction);

      for (const transaction of transactions) {
        expect(transaction).to.eq(createProductTransaction);
      }
    });
  });

  describe("#updateItem", () => {
    it("should properly update all relevant entities", async () => {
      // arrange
      const state = new AuthContextMetadata({
        internal: { id: 987 },
      });
      const input = {
        demand_source_id: 25,
        name: "updated product name",
        geo_restriction: 1,
        orders: [{ name: "some order" }],
        contacts: [
          {
            first_name: "Bunk",
            last_name: "Moreland",
            address: {
              email: "bunk@moreland.com",
              phone: "+12345678",
            },
          },
        ],
      };
      const item = Product.build({
        id: 357,
        info_id: 23,
        ...input,
      });

      findByPkProductStub.resolves(item);
      findAllProductStub.resolves([item]);
      createContactStub.resolves({ id: 7 });
      createAddressStub.resolves({ id: 8 });
      createOrderStub.resolves({ id: 876 });
      createProductContactStub.resolves();
      upsertInfoStub.onFirstCall().resolves([Info.build({ id: 23 })]);
      upsertInfoStub.onSecondCall().resolves([Info.build({ id: 45 })]);

      // act
      const result = await repository.updateItem(state, 357, input);

      // assert
      expect(upsertInfoStub.callCount).to.eq(2);
      // assert: the Product Info should be updated
      expect(upsertInfoStub.getCall(0).args[0]).to.deep.eq({
        modified_at: {
          args: [] as any,
          fn: "NOW",
        },
        modified_by_id: 987,
        id: 23,
      });
      // assert: one Info should be created for the new Contact
      expect(upsertInfoStub.getCall(1).args[0]).to.deep.eq({
        created_at: {
          args: [] as any,
          fn: "NOW",
        },
        created_by_id: 987,
      });

      // assert: one Product should be updated with proper attributes and FKs
      expect(updateProductStub.callCount).to.eq(1);
      expect(updateProductStub.getCall(0).args[0]).to.deep.eq({
        id: 357,
        demand_source_id: 25,
        name: "updated product name",
        geo_restriction: 1,
      });

      // assert: one Address should be created for the new contact
      expect(createAddressStub.callCount).to.eq(1);
      expect(createAddressStub.getCall(0).args[0]).to.deep.eq({
        email: "bunk@moreland.com",
        phone: "+12345678",
      });
      // assert: one new Contact should be created, with proper attributes and FKs
      expect(createContactStub.callCount).to.eq(1);
      expect(createContactStub.getCall(0).args[0]).to.deep.eq({
        first_name: "Bunk",
        last_name: "Moreland",
        address_id: 8,
        info_id: 45,
      });

      // assert: existing ProductContact entries for the Product should be destroyed
      expect(destroyProductContactStub.callCount).to.eq(1);
      expect(destroyProductContactStub.getCall(0).args[0]).to.deep.eq({
        where: {
          product_id: 357,
        },
        transaction: { fake: "transaction" },
      });
      // assert: one ProductContact should be created to link Product with its new Contact
      expect(createProductContactStub.callCount).to.eq(1);
      expect(createProductContactStub.getCall(0).args[0]).to.deep.eq({
        product_id: 357,
        contact_id: 7,
      });

      // assert: existing Order entries for the Product should be marked as deleted
      expect(updateOrderStub.callCount).to.eq(1);
      expect(updateOrderStub.getCall(0).args).to.deep.eq([
        { status_id: EntityStatus.DELETED },
        {
          where: {
            product_id: 357,
          },
          transaction: { fake: "transaction" },
        },
      ]);

      // assert: one Order should be created with proper attributes and FK
      expect(createOrderStub.callCount).to.eq(1);
      expect(createOrderStub.getCall(0).args[0]).to.deep.eq({
        product_id: 357,
        name: "some order",
      });

      expect(result).to.deep.eq(item);

      // assert: Product is fetched with all associations to ensure all relevant data is returned
      expect(findAllProductStub.callCount).to.eq(1);
    });
  });

  describe("#deleteItem", () => {
    describe("when softDeleteStatus is ARCHIVED (default)", () => {
      describe("when entity has status_id and info_id fields", () => {
        it("should set status as ARCHIVED", async () => {
          // arrange
          const state = new AuthContextMetadata({
            internal: { id: 987 },
          });
          const item = {
            id: 123,
            status_id: EntityStatus.REGULAR,
            info_id: 456,
            destroy: sandbox.stub(),
            update: sandbox.stub(),
          };
          findAllProductStub.resolves([item]);

          // act
          await repository.deleteItem(state, 123);

          // assert
          expect(findAllProductStub.callCount).to.eq(1);
          // assert: item should not be destroyed
          expect(item.destroy.callCount).to.eq(0);
          // assert: item should be updated with archived status
          expect(item.update.callCount).to.eq(1);
          expect(item.update.getCall(0).args[0]).to.deep.eq({
            status_id: EntityStatus.ARCHIVED,
          });
          // assert: info should not be updated
          expect(upsertInfoStub.callCount).to.eq(0);
        });

        describe("when entity has no status_id and no info_id fields", () => {
          it("should not destroy the entity and not attempt to upsert info", async () => {
            // arrange
            const state = new AuthContextMetadata({
              internal: { id: 987 },
            });
            const item = {
              id: 123,
              status_id: EntityStatus.REGULAR,
              info_id: 456,
              destroy: sandbox.stub(),
              update: sandbox.stub(),
            };
            findAllProductStub.resolves([item]);

            // act
            await repository.deleteItem(state, 123);

            // assert: item should not be destroyed
            expect(item.destroy.callCount).to.eq(0);
            // assert: info should not be updated
            expect(upsertInfoStub.callCount).to.eq(0);
          });
        });
      });

      describe("when softDeleteStatus is DELETED", () => {
        beforeEach(() => {
          repository = new (class extends SequelizeRepository<Product> {
            model = Product;
            fetchCondition = {};
            softDeleteStatus = EntityStatus.DELETED;
          })(permissionsManager, filtersGenerator, orderGenerator);
        });

        describe("when entity has status_id and info_id fields", () => {
          it("should set status as DELETED and properly update info entry", async () => {
            // arrange
            const state = new AuthContextMetadata({
              internal: { id: 987 },
            });
            const item = {
              id: 123,
              status_id: EntityStatus.REGULAR,
              info_id: 456,
              destroy: sandbox.stub(),
              update: sandbox.stub(),
            };
            findAllProductStub.resolves([item]);

            // act
            await repository.deleteItem(state, 123);

            // assert
            expect(findAllProductStub.callCount).to.eq(1);
            // assert: item should not be destroyed
            expect(item.destroy.callCount).to.eq(0);
            // assert: item should be updated with deleted status
            expect(item.update.callCount).to.eq(1);
            expect(item.update.getCall(0).args[0]).to.deep.eq({
              status_id: EntityStatus.DELETED,
            });
            // assert: info should be updated properly
            expect(upsertInfoStub.callCount).to.eq(1);
            expect(upsertInfoStub.getCall(0).args[0]).to.deep.eq({
              id: 456,
              deleted_at: { args: [], fn: "NOW" },
              deleted_by_id: 987,
            });

            const { transaction } = item.update.getCall(0).args[1];
            const { transaction: infoTransaction } =
              upsertInfoStub.getCall(0).args[1];

            // assert: updates should be made within the same transaction
            expect(transaction).to.eq(infoTransaction);
          });
        });

        describe("when entity has no status id and no info_id fields", () => {
          it("should destroy the entity and not attempt to upsert info", async () => {
            // arrange
            const state = new AuthContextMetadata({
              internal: { id: 987 },
            });
            const item = {
              id: 123,
              destroy: sandbox.stub(),
              update: sandbox.stub(),
            };
            findAllProductStub.resolves([item]);

            // act
            await repository.deleteItem(state, 123);

            // assert
            expect(findAllProductStub.callCount).to.eq(1);
            // assert: item should not be updated
            expect(item.update.callCount).to.eq(0);
            // assert: item should be destroyed
            expect(item.destroy.callCount).to.eq(1);
            // assert: info should not be updated
            expect(upsertInfoStub.callCount).to.eq(0);
          });
        });
        describe("when user has no internal id", () => {
          it("should upsert info without specifying user id", async () => {
            // arrange
            const state = new AuthContextMetadata({});
            const item = {
              id: 123,
              info_id: 456,
              destroy: sandbox.stub(),
              update: sandbox.stub(),
            };
            findAllProductStub.resolves([item]);

            // act
            await repository.deleteItem(state, 123);

            // assert
            expect(upsertInfoStub.callCount).to.eq(1);
            expect(upsertInfoStub.getCall(0).args[0]).to.deep.eq({
              id: 456,
              deleted_at: { args: [], fn: "NOW" },
            });
          });
        });
      });
    });
  });

  describe("#upsertEntity", () => {
    it("should throw if an entity to update cannot be found", async () => {
      // arrange
      findByPkProductStub.resolves(null);

      const transaction = { fake: "transaction" } as unknown as Transaction;
      const state = new AuthContextMetadata({});

      try {
        // act
        await repository["upsertEntity"](
          state,
          Product,
          { name: "some name", id: 123 },
          transaction
        );
        throw new Error("Request should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.code).to.eq(500);
        expect(err.message).to.eq("Unable to find entity to update: 123");
      }
    });
  });

  describe("#removeRelations", () => {
    it("should set foreign key to null when it is nullable", async () => {
      // arrange
      const updateStub = sandbox.stub().resolves();
      const association = {
        associationType: AssociationType.BELONGS_TO,
        target: {
          update: updateStub,
          rawAttributes: {
            product_id: {
              allowNull: true,
            },
          },
        },
        foreignKey: "product_id",
      } as unknown as Association;
      const transaction = { fake: "transaction" } as unknown as Transaction;

      // act
      await repository["removeRelations"]("pk", association, transaction);

      // assert
      expect(updateStub.callCount).to.eq(1);
      expect(updateStub.getCall(0).args).to.deep.eq([
        { product_id: null },
        { where: { product_id: "pk" }, transaction },
      ]);
    });
  });

  describe("#generateIncludeClause", () => {
    it("should remove duplicated includes when exist", () => {
      // arrange
      const baseCondition: FindOptions = {
        include: [
          { model: SupplyNetwork },
          { model: DemandSource },
          {
            model: Contact,
            through: { attributes: [] },
            required: false,
            include: [{ model: Address }],
          },
        ],
      };
      const permissionsCondition: FindOptions = {
        include: [],
        where: {
          demand_source_id: 28,
        },
      };
      const filterCondition: FindOptions = {
        include: [
          { model: DemandSource },
          {
            model: Contact,
            through: { attributes: [] },
            required: false,
          },
        ],
      };
      repository["fetchCondition"] = baseCondition;

      // act
      const result = repository["generateIncludeClause"](
        permissionsCondition,
        filterCondition
      );

      // assert
      expect(result).to.deep.eq({
        include: [
          { model: SupplyNetwork },
          { model: DemandSource },
          {
            model: Contact,
            through: { attributes: [] },
            required: false,
            include: [{ model: Address }],
          },
          {
            model: Contact,
            through: { attributes: [] },
            required: false,
          },
        ],
      });
    });
  });
});

describe("SequelizeRepository: Custom Primary Keys", () => {
  let repository: SequelizeRepository<ProductMetadata>;
  let permissionsManager: PermissionsManager<ProductMetadata>;
  let filtersGenerator: FiltersGenerator<ProductMetadata>;
  let orderGenerator: OrderGenerator<ProductMetadata>;
  let sandbox: sinon.SinonSandbox;
  let findAndCountAllMetadataStub: sinon.SinonStub;
  let findAllMetadataStub: sinon.SinonStub;
  let createMetadataStub: sinon.SinonStub;
  let updateMetadataStub: sinon.SinonStub;
  let findByPkMetadataStub: sinon.SinonStub;

  before(() => {
    createSequelizeInstance();
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sandbox
      .stub(Sequelize.prototype, "transaction" as any)
      .callsFake(async (fn: any) => {
        const results = await fn({ fake: "transaction" });

        return results;
      });
    findAndCountAllMetadataStub = sandbox
      .stub(ProductMetadata, "findAndCountAll")
      .resolves();
    findAllMetadataStub = sandbox.stub(ProductMetadata, "findAll").resolves();
    createMetadataStub = sandbox.stub(ProductMetadata, "create").resolves();
    updateMetadataStub = sandbox
      .stub(ProductMetadata.prototype, "update")
      .resolves();
    findByPkMetadataStub = sandbox.stub(ProductMetadata, "findByPk").resolves();

    permissionsManager =
      new (class extends PermissionsManager<ProductMetadata> {
        model = ProductMetadata;
        definitions: PermissionsDefinitions = [];
        pathMap = {};
      })();

    orderGenerator = new (class extends OrderGenerator<ProductMetadata> {
      model = ProductMetadata;
      pathMap = {};
    })();
    filtersGenerator = new (class extends FiltersGenerator<ProductMetadata> {
      model = ProductMetadata;
      pathMap = {};
    })();

    repository = new (class extends SequelizeRepository<ProductMetadata> {
      model = ProductMetadata;
      fetchCondition = {};
    })(permissionsManager, filtersGenerator, orderGenerator);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("#getItem", () => {
    it("should fetch one item with proper primary key", async () => {
      // arrange
      const state = new AuthContextMetadata({});
      const expectedOptions: FindOptions = {
        include: [],
        where: {
          [Op.and]: [undefined, { pk: 1 }],
        },
      };
      findAllMetadataStub.resolves([{ pk: 123 }]);

      // act
      const result = await repository.getItem(state, 1);

      // assert
      expect(result).to.deep.eq({ pk: 123 });
      expect(findAllMetadataStub.callCount).to.eq(1);
      expect(_.isEqual(findAllMetadataStub.getCall(0).args[0], expectedOptions))
        .to.be.true;
    });
  });

  describe("#getList", () => {
    it("should fetch a list of items with proper primary key", async () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({});
      const findAllResponse = [
        { pk: 12, name: "Metadata 12" },
        { pk: 34, name: "Metadata 34" },
      ];
      findAndCountAllMetadataStub.resolves({
        rows: [{ pk: 12 }, { pk: 34 }],
        count: [{ count: 1 }, { count: 1 }],
      });
      findAllMetadataStub.resolves(findAllResponse);

      const order = [["pk", "ASC"]];

      // act
      const result = await repository.getList(state, request);

      // assert
      expect(result).to.deep.eq([findAllResponse, 2]);
      expect(findAndCountAllMetadataStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAndCountAllMetadataStub.getCall(0).args[0], {
          include: [],
          order,
          limit: 25,
          offset: 0,
          group: "ProductMetadata.pk",
        })
      ).to.be.true;
      expect(findAllMetadataStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAllMetadataStub.getCall(0).args[0], {
          order,
          where: {
            [Op.and]: [{ pk: { [Op.in]: [12, 34] } }, undefined],
          },
        })
      ).to.be.true;
    });
  });

  describe("#createItem", () => {
    it("should fetch and create item with proper primary key", async () => {
      // arrange
      const state = new AuthContextMetadata({});
      const input = {
        data: "some data",
      };
      const item = {
        pk: 357,
        ...input,
      };

      findAllMetadataStub.resolves([item]);
      createMetadataStub.resolves({ id: 357 });

      // act
      const result = await repository.createItem(state, input);

      // assert
      expect(createMetadataStub.callCount).to.eq(1);
      expect(createMetadataStub.getCall(0).args[0]).to.deep.eq({
        data: "some data",
      });

      expect(result).to.deep.eq(item);
    });
  });

  describe("#updateItem", () => {
    it("should properly update all relevant entities", async () => {
      // arrange
      const state = new AuthContextMetadata({});
      const input = {
        data: "some updated data",
      };
      const item = ProductMetadata.build({
        pk: 357,
        ...input,
      });

      findByPkMetadataStub.resolves(item);
      findAllMetadataStub.resolves([item]);

      // act
      const result = await repository.updateItem(state, 357, input);

      // assert
      expect(updateMetadataStub.callCount).to.eq(1);
      expect(updateMetadataStub.getCall(0).args[0]).to.deep.eq({
        pk: 357,
        data: "some updated data",
      });

      expect(result).to.deep.eq(item);
    });
  });
});

describe("SequelizeRepository: Aliased Primary Keys", () => {
  let repository: SequelizeRepository<DemandSource>;
  let permissionsManager: PermissionsManager<DemandSource>;
  let filtersGenerator: FiltersGenerator<DemandSource>;
  let orderGenerator: OrderGenerator<DemandSource>;
  let sandbox: sinon.SinonSandbox;
  let findAndCountAllDemandSourceStub: sinon.SinonStub;
  let findAllDemandSourceStub: sinon.SinonStub;

  before(() => {
    createSequelizeInstance();
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    findAndCountAllDemandSourceStub = sandbox
      .stub(DemandSource, "findAndCountAll")
      .resolves();
    findAllDemandSourceStub = sandbox.stub(DemandSource, "findAll").resolves();

    permissionsManager = new (class extends PermissionsManager<DemandSource> {
      model = DemandSource;
      definitions: PermissionsDefinitions = [];
      pathMap = {};
    })();

    orderGenerator = new (class extends OrderGenerator<DemandSource> {
      model = DemandSource;
      pathMap = {};
    })();
    filtersGenerator = new (class extends FiltersGenerator<DemandSource> {
      model = DemandSource;
      pathMap = {};
    })();

    repository = new (class extends SequelizeRepository<DemandSource> {
      model = DemandSource;
      fetchCondition = {};
    })(permissionsManager, filtersGenerator, orderGenerator);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("#getList", () => {
    it("should fetch a list of items with proper primary key", async () => {
      // arrange
      const state = new AuthContextMetadata({});
      const request = new ContextRequest({});
      const findAllResponse = [
        { id: 12, name: "DemandSource 12" },
        { id: 34, name: "DemandSource 34" },
      ];
      findAndCountAllDemandSourceStub.resolves({
        rows: [{ id: 12 }, { id: 34 }],
        count: [{ count: 1 }, { count: 1 }],
      });
      findAllDemandSourceStub.resolves(findAllResponse);

      const order = [["id", "ASC"]];

      // act
      const result = await repository.getList(state, request);

      // assert
      expect(result).to.deep.eq([findAllResponse, 2]);
      expect(findAndCountAllDemandSourceStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAndCountAllDemandSourceStub.getCall(0).args[0], {
          include: [],
          order,
          limit: 25,
          offset: 0,
          // assert: correct field name is used for PK
          group: "DemandSource.numeric_code",
        })
      ).to.be.true;
      expect(findAllDemandSourceStub.callCount).to.eq(1);
      expect(
        _.isEqual(findAllDemandSourceStub.getCall(0).args[0], {
          order,
          where: {
            [Op.and]: [{ id: { [Op.in]: [12, 34] } }, undefined],
          },
        })
      ).to.be.true;
    });
  });
});
