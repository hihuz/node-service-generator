import * as sinon from "sinon";

import { ApplicationError } from "../../../../src/common/errors/application-error.class";
import { AuthContextMetadata } from "../../../../src/common/context/auth-context-metadata.class";
import { ClientError } from "../../../../src/common/errors/client-error.config";
import { ContextRequest } from "../../../../src/common/context/context-request.class";
import { Validator } from "../../../../src/common/generator/validator";
import { Serializer } from "../../../../src/common/generator/serializer";
import { PermissionsManager } from "../../../../src/common/generator/permissions-manager";
import { Product } from "./fixtures/models";
import { SequelizeDataProvider } from "../../../../src/common/generator/dataprovider";
import { SequelizeRepository } from "../../../../src/common/generator/repository";
import { expect } from "chai";

describe("SequelizeDataProvider", () => {
  const repository = {} as SequelizeRepository<any>;
  const serializer = {} as Serializer<any>;
  const validator = {} as Validator<any>;
  const permissionsManager = {} as PermissionsManager<any>;
  const state = new AuthContextMetadata({});
  const request = new ContextRequest({});
  let sandbox: sinon.SinonSandbox;
  let provider: SequelizeDataProvider<Product>;
  let serializeStub: sinon.SinonStub;
  let deserializeStub: sinon.SinonStub;
  let validateReadPermissionsStub: sinon.SinonStub;
  let validateCreatePermissionsStub: sinon.SinonStub;
  let validateUpdatePermissionsStub: sinon.SinonStub;
  let validateDeletePermissionsStub: sinon.SinonStub;
  let validateRelationsStub: sinon.SinonStub;
  let validateImmutableFieldsStub: sinon.SinonStub;
  let validateInputStub: sinon.SinonStub;
  let getListStub: sinon.SinonStub;
  let getItemStub: sinon.SinonStub;
  let createItemStub: sinon.SinonStub;
  let updateItemStub: sinon.SinonStub;
  let deleteItemStub: sinon.SinonStub;
  let beforeCreateStub: sinon.SinonStub;
  let afterCreateStub: sinon.SinonStub;
  let beforeUpdateStub: sinon.SinonStub;
  let afterUpdateStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    getListStub = sandbox.stub().resolves();
    getItemStub = sandbox.stub().resolves();
    createItemStub = sandbox.stub().resolves();
    updateItemStub = sandbox.stub().resolves();
    deleteItemStub = sandbox.stub().resolves();
    serializeStub = sandbox
      .stub()
      .callsFake((item) => ({ ...item, serialize: "response" }));
    deserializeStub = sandbox
      .stub()
      .callsFake((item) => ({ ...item, deserialize: "input" }));
    validateReadPermissionsStub = sandbox.stub().resolves();
    validateCreatePermissionsStub = sandbox.stub().resolves();
    validateUpdatePermissionsStub = sandbox.stub().resolves();
    validateDeletePermissionsStub = sandbox.stub().resolves();
    validateRelationsStub = sandbox.stub().resolves();
    validateImmutableFieldsStub = sandbox.stub().resolves();
    validateInputStub = sandbox.stub().resolves();
    beforeCreateStub = sandbox.stub();
    afterCreateStub = sandbox.stub();
    beforeUpdateStub = sandbox.stub();
    afterUpdateStub = sandbox.stub();

    repository.getList = getListStub;
    repository.getItem = getItemStub;
    repository.createItem = createItemStub;
    repository.updateItem = updateItemStub;
    repository.deleteItem = deleteItemStub;
    serializer.deserialize = deserializeStub;
    serializer.serialize = serializeStub;
    permissionsManager.validateReadPermissions = validateReadPermissionsStub;
    permissionsManager.validateCreatePermissions =
      validateCreatePermissionsStub;
    permissionsManager.validateUpdatePermissions =
      validateUpdatePermissionsStub;
    permissionsManager.validateDeletePermissions =
      validateDeletePermissionsStub;
    validator.validateRelations = validateRelationsStub;
    validator.validateImmutableFields = validateImmutableFieldsStub;
    validator.validateInput = validateInputStub;

    provider = new (class extends SequelizeDataProvider<Product> {
      async beforeCreate(options: { input: any; state: AuthContextMetadata }) {
        beforeCreateStub(options);

        return super.beforeCreate(options);
      }

      async afterCreate(options: {
        createdItem: Product;
        input: any;
        state: AuthContextMetadata;
      }) {
        afterCreateStub(options);

        return super.afterCreate(options);
      }

      async beforeUpdate(options: {
        input: any;
        id: number;
        existingItem: any;
        state: AuthContextMetadata;
      }) {
        beforeUpdateStub(options);

        return super.beforeUpdate(options);
      }

      async afterUpdate(options: {
        updatedItem: Product;
        input: any;
        id: number;
        itemBeforeUpdate: any;
        state: AuthContextMetadata;
      }) {
        afterUpdateStub(options);

        return super.afterUpdate(options);
      }
    })(repository, serializer, validator, permissionsManager);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("#getList", () => {
    it("should validate permissions, get list, normalize results and return response", async () => {
      // arrange
      const results = [{ id: 123 }, { id: 456 }];
      getListStub.resolves([results, 2]);

      // act
      const [response, count] = await provider.getList(state, request);

      // assert
      expect(validateReadPermissionsStub.callCount).to.eq(1);
      expect(validateReadPermissionsStub.getCall(0).args).to.deep.eq([state]);
      expect(getListStub.callCount).to.eq(1);
      expect(getListStub.getCall(0).args).to.deep.eq([state, request]);
      expect(serializeStub.callCount).to.eq(2); // one call for each result
      expect(serializeStub.getCall(0).args[0]).to.eq(results[0]);
      expect(serializeStub.getCall(1).args[0]).to.eq(results[1]);
      expect(response).to.deep.eq([
        { id: 123, serialize: "response" },
        { id: 456, serialize: "response" },
      ]);
      expect(count).to.eq(2);
    });

    it("should throw an UNABLE_TO_LIST error if repository.getList throws an error", async () => {
      // arrange
      getListStub.rejects();

      try {
        // act
        await provider.getList(state, request);
        throw new Error("Request should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          ClientError.CRUD.BAD_REQUEST.UNABLE_TO_LIST.message
        );
        expect(err.code).to.eq(
          ClientError.CRUD.BAD_REQUEST.UNABLE_TO_LIST.code
        );
      }
    });
  });

  describe("#getItem", () => {
    it("should validate permissions, get item, normalize result and return response", async () => {
      // arrange
      const result = { id: 789 };
      getItemStub.resolves(result);

      // act
      const response = await provider.getItem(state, 789);

      // assert
      expect(validateReadPermissionsStub.callCount).to.eq(1);
      expect(validateReadPermissionsStub.getCall(0).args).to.deep.eq([
        state,
        789,
      ]);
      expect(getItemStub.callCount).to.eq(1);
      expect(getItemStub.getCall(0).args).to.deep.eq([state, 789]);
      expect(serializeStub.callCount).to.eq(1);
      expect(serializeStub.getCall(0).args).to.deep.eq([result, state]);
      expect(response).to.deep.eq({ id: 789, serialize: "response" });
    });

    it("should throw an UNABLE_TO_GET error if repository.getItem throws an error", async () => {
      // arrange
      getItemStub.rejects();

      try {
        // act
        await provider.getItem(state, 1);
        throw new Error("Request should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          ClientError.CRUD.BAD_REQUEST.UNABLE_TO_GET.message
        );
        expect(err.code).to.eq(ClientError.CRUD.BAD_REQUEST.UNABLE_TO_GET.code);
      }
    });
  });

  describe("#createItem", () => {
    const input = { name: "item name" };

    it("should validate permissions, validate input, create item, normalize result and return response", async () => {
      // arrange
      const result = { id: 123, ...input };
      createItemStub.resolves(result);

      // act
      const response = await provider.createItem(state, input);

      // assert
      expect(validateCreatePermissionsStub.callCount).to.eq(1);
      expect(validateCreatePermissionsStub.getCall(0).args).to.deep.eq([
        state,
        input,
      ]);
      expect(validateInputStub.callCount).to.eq(1);
      expect(validateInputStub.getCall(0).args).to.deep.eq([
        {
          completeInput: input,
          state,
        },
      ]);
      expect(validateRelationsStub.callCount).to.eq(1);
      expect(validateRelationsStub.getCall(0).args).to.deep.eq([input]);
      expect(deserializeStub.callCount).to.eq(1);
      expect(deserializeStub.getCall(0).args).to.deep.eq([input, state]);
      expect(createItemStub.callCount).to.eq(1);
      expect(createItemStub.getCall(0).args).to.deep.eq([
        state,
        { ...input, deserialize: "input" },
      ]);
      expect(serializeStub.callCount).to.eq(1);
      expect(serializeStub.getCall(0).args).to.deep.eq([result, state]);
      expect(response).to.deep.eq({
        id: 123,
        name: "item name",
        serialize: "response",
      });
    });

    it("should throw if UNABLE_TO_CREATE error if repository.createItem throws an error", async () => {
      // arrange
      createItemStub.rejects();

      try {
        // act
        await provider.createItem(state, input);
        throw new Error("Request should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          ClientError.CRUD.BAD_REQUEST.UNABLE_TO_CREATE.message
        );
        expect(err.code).to.eq(
          ClientError.CRUD.BAD_REQUEST.UNABLE_TO_CREATE.code
        );
      }
    });

    it("should properly call beforeCreate and afterCreate hooks", async () => {
      // arrange
      const result = { id: 123, ...input };
      createItemStub.resolves(result);

      // act
      await provider.createItem(state, input);

      // assert
      expect(beforeCreateStub.callCount).to.eq(1);
      expect(beforeCreateStub.getCall(0).args).to.deep.eq([{ input, state }]);

      expect(afterCreateStub.callCount).to.eq(1);
      expect(afterCreateStub.getCall(0).args).to.deep.eq([
        {
          createdItem: { id: 123, name: "item name" },
          input,
          state,
        },
      ]);
    });
  });

  describe("#updateItem", () => {
    const input = {
      name: "updated name",
      contacts: [{ email: "john@doe.com" }],
      description: "some description",
    };
    const partialInput = {
      name: "updated name",
      contacts: [{ email: "john@doe.com" }],
    };
    const fetchResult = {
      id: 123,
      name: "item name",
      description: "some description",
      virtual: "field",
      contacts: [{ email: "jean@dupont.com" }],
    };

    describe("when performing a partial update", () => {
      it("should validate permissions, update item, normalize result and return response ", async () => {
        // arrange
        getItemStub.resolves(fetchResult);

        const updateResult = {
          id: 123,
          name: "updated name",
          description: "some description",
          virtual: "updated field",
          contacts: [{ email: "john@doe.com" }],
        };
        updateItemStub.resolves(updateResult);

        // act
        const response = await provider.updateItem(
          state,
          123,
          partialInput,
          true
        );

        // assert
        expect(validateUpdatePermissionsStub.callCount).to.eq(1);
        expect(validateUpdatePermissionsStub.getCall(0).args).to.deep.eq([
          state,
          123,
        ]);
        expect(validateRelationsStub.callCount).to.eq(1);
        expect(validateRelationsStub.getCall(0).args).to.deep.eq([
          partialInput,
        ]);
        expect(validateImmutableFieldsStub.callCount).to.eq(1);
        expect(validateImmutableFieldsStub.getCall(0).args).to.deep.eq([
          partialInput,
          { ...fetchResult, serialize: "response" },
        ]);
        expect(validateInputStub.callCount).to.eq(1);
        // assert: input validation must be done on the resulting merge of input and getItem result
        expect(validateInputStub.getCall(0).args).to.deep.eq([
          {
            completeInput: {
              id: 123,
              name: "updated name",
              description: "some description",
              virtual: "field",
              contacts: [{ email: "john@doe.com" }],
              serialize: "response",
            },
            state,
            existingItem: { ...fetchResult, serialize: "response" },
            userInput: partialInput,
          },
        ]);
        expect(deserializeStub.callCount).to.eq(1);
        expect(deserializeStub.getCall(0).args).to.deep.eq([
          partialInput,
          state,
          { ...fetchResult, serialize: "response" },
        ]);
        expect(getItemStub.callCount).to.eq(1);
        expect(getItemStub.getCall(0).args).to.deep.eq([state, 123]);
        expect(updateItemStub.callCount).to.eq(1);
        expect(updateItemStub.getCall(0).args).to.deep.eq([
          state,
          123,
          { ...partialInput, deserialize: "input" },
        ]);
        expect(serializeStub.callCount).to.eq(2);
        expect(serializeStub.getCall(0).args).to.deep.eq([fetchResult, state]);
        expect(serializeStub.getCall(1).args).to.deep.eq([updateResult, state]);
        // assert: response should be the serialized resulting merge of input, getItem result and updated item result
        expect(response).to.deep.eq({
          id: 123,
          name: "updated name",
          description: "some description",
          contacts: [{ email: "john@doe.com" }],
          virtual: "updated field",
          serialize: "response",
        });
      });
    });

    describe("when performing a complete update", () => {
      it("should validate permissions, update item, normalize result and return response ", async () => {
        // arrange
        const fetchResult = {
          id: 123,
          name: "item name",
          description: "some description",
          virtual: "field",
          contacts: [{ email: "jean@dupont.com" }],
        };
        getItemStub.resolves(fetchResult);

        const updateResult = {
          id: 123,
          name: "updated name",
          description: "some description",
          virtual: "updated field",
          contacts: [{ email: "john@doe.com" }],
        };
        updateItemStub.resolves(updateResult);

        // act
        const response = await provider.updateItem(state, 123, input, false);

        // assert
        expect(validateUpdatePermissionsStub.callCount).to.eq(1);
        expect(validateUpdatePermissionsStub.getCall(0).args).to.deep.eq([
          state,
          123,
        ]);
        expect(validateRelationsStub.callCount).to.eq(1);
        expect(validateRelationsStub.getCall(0).args).to.deep.eq([input]);
        expect(validateImmutableFieldsStub.callCount).to.eq(1);
        expect(validateImmutableFieldsStub.getCall(0).args).to.deep.eq([
          input,
          { ...fetchResult, serialize: "response" },
        ]);
        expect(validateInputStub.callCount).to.eq(1);
        expect(validateInputStub.getCall(0).args).to.deep.eq([
          {
            completeInput: { ...input, id: 123 },
            state,
            existingItem: { ...fetchResult, serialize: "response" },
            userInput: input,
          },
        ]);
        expect(deserializeStub.callCount).to.eq(1);
        expect(deserializeStub.getCall(0).args).to.deep.eq([
          input,
          state,
          { ...fetchResult, serialize: "response" },
        ]);
        expect(getItemStub.callCount).to.eq(1);
        expect(getItemStub.getCall(0).args).to.deep.eq([state, 123]);
        expect(updateItemStub.callCount).to.eq(1);
        expect(updateItemStub.getCall(0).args).to.deep.eq([
          state,
          123,
          { ...input, deserialize: "input" },
        ]);
        expect(serializeStub.callCount).to.eq(2);
        expect(serializeStub.getCall(0).args).to.deep.eq([fetchResult, state]);
        expect(serializeStub.getCall(1).args).to.deep.eq([updateResult, state]);
        expect(response).to.deep.eq({
          id: 123,
          name: "updated name",
          description: "some description",
          serialize: "response",
          virtual: "updated field",
          contacts: [{ email: "john@doe.com" }],
        });
      });
    });

    it("should properly call beforeUpdate and afterUpdate hooks", async () => {
      // arrange
      const updatedItem = {
        id: 123,
        name: "updated name",
        description: "some description",
        contacts: [{ email: "john@doe.com" }],
        virtual: "updated field",
      };
      getItemStub.resolves(fetchResult);
      updateItemStub.resolves(updatedItem);

      // act
      await provider.updateItem(state, 123, partialInput, true);

      // assert
      expect(beforeUpdateStub.callCount).to.eq(1);
      expect(beforeUpdateStub.getCall(0).args).to.deep.eq([
        {
          input: partialInput,
          id: 123,
          existingItem: { ...fetchResult, serialize: "response" },
          state,
        },
      ]);

      expect(afterUpdateStub.callCount).to.eq(1);
      expect(afterUpdateStub.getCall(0).args).to.deep.eq([
        {
          updatedItem,
          input: partialInput,
          id: 123,
          itemBeforeUpdate: { ...fetchResult, serialize: "response" },
          state,
        },
      ]);
    });

    it("should throw if UNABLE_TO_UPDATE error if repository.updateItem throws an error", async () => {
      // arrange
      updateItemStub.rejects();

      try {
        // act
        await provider.updateItem(state, 123, input, true);
        throw new Error("Request should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          ClientError.CRUD.BAD_REQUEST.UNABLE_TO_UPDATE.message
        );
        expect(err.code).to.eq(
          ClientError.CRUD.BAD_REQUEST.UNABLE_TO_UPDATE.code
        );
      }
    });
  });

  describe("#deleteItem", () => {
    it("should validate permissions, delete item, normalize result and return response", async () => {
      // arrange
      const result = { id: 1 };
      deleteItemStub.resolves(result);

      // act
      const response = await provider.deleteItem(state, 1);

      // assert
      expect(validateDeletePermissionsStub.callCount).to.eq(1);
      expect(validateDeletePermissionsStub.getCall(0).args).to.deep.eq([
        state,
        1,
      ]);
      expect(deleteItemStub.callCount).to.eq(1);
      expect(deleteItemStub.getCall(0).args).to.deep.eq([state, 1]);
      expect(serializeStub.callCount).to.eq(1);
      expect(serializeStub.getCall(0).args).to.deep.eq([result, state]);
      expect(response).to.deep.eq({ id: 1, serialize: "response" });
    });

    it("should throw an UNABLE_TO_DELETE error if repository.deleteItem throws an error", async () => {
      // arrange
      deleteItemStub.rejects();

      try {
        // act
        await provider.deleteItem(state, 1);
        throw new Error("Request should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(
          ClientError.CRUD.BAD_REQUEST.UNABLE_TO_DELETE.message
        );
        expect(err.code).to.eq(
          ClientError.CRUD.BAD_REQUEST.UNABLE_TO_DELETE.code
        );
      }
    });
  });
});
