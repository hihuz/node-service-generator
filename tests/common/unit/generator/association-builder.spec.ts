import {
  Address,
  Contact,
  Product,
  createSequelizeInstance,
} from "./fixtures/models";

import { ApplicationError } from "../../../../src/common/errors/application-error.class";
import { Association } from "sequelize";
import { AssociationBuilder } from "../../../../src/common/generator/association-builder";
import { expect } from "chai";

describe("AssociationBuilder", () => {
  let builder: AssociationBuilder<Product>;

  before(() => {
    createSequelizeInstance();
    builder = new (class extends AssociationBuilder<Product> {
      pathMap = {
        "contacts.email": "contacts.address.email",
      };
      associationError = {
        code: 400,
        error: "Bad Request",
        message: `Error message`,
      };
      model = Product;
    })();
  });

  describe("#getLastAssociationModel", () => {
    it("should return the last association's model if the list is not empty", () => {
      // arrange
      const associations = [
        { target: Contact },
        { target: Address },
      ] as unknown as Association[];

      // act & assert
      expect(builder["getLastAssociationModel"](associations)).to.eql(Address);
    });

    it("should return the internal model if the list is empty", () => {
      // arrange
      const associations: Association[] = [];

      // act & assert
      expect(builder["getLastAssociationModel"](associations)).to.eql(Product);
    });
  });

  describe("#validateAssociations", () => {
    it("should throw if some associations are not defined", () => {
      // arrange
      const associations = [
        undefined,
        { target: Address },
      ] as unknown as Association[];

      try {
        // act
        builder["validateAssociations"](associations, "email");
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(builder["associationError"].message);
        expect(err.code).to.eq(builder["associationError"].code);
      }
    });

    it("should throw if the provided field does not exist in the last model", () => {
      // arrange
      const associations = [
        { target: Contact },
        { target: Address },
      ] as unknown as Association[];

      try {
        // act
        builder["validateAssociations"](associations, "invalidField");
        throw new Error("Validation should have failed!");
      } catch (err) {
        // assert
        expect(err).instanceof(ApplicationError);
        expect(err.message).to.eq(builder["associationError"].message);
        expect(err.code).to.eq(builder["associationError"].code);
      }
    });

    it("should not throw if the associations and field are valid", () => {
      // arrange
      const associations = [
        { target: Contact },
        { target: Address },
      ] as unknown as Association[];

      // act & assert
      builder["validateAssociations"](associations, "email");
    });
  });

  describe("#extractAndValidatePathData", () => {
    it("should return proper association chain and field name from path", () => {
      // arrange
      const { associations, field } = builder["extractAndValidatePathData"](
        "contacts.address.email"
      );

      // act & assert
      expect(field).to.eq("email");
      expect(associations).to.deep.eq([
        Product.associations.contacts,
        Contact.associations.address,
      ]);
    });

    it("should use pathMap to infer proper association chain and field name when appropriate", () => {
      // arrange
      const { associations, field } =
        builder["extractAndValidatePathData"]("contacts.email");

      // act & assert
      expect(field).to.eq("email");
      expect(associations).to.deep.eq([
        Product.associations.contacts,
        Contact.associations.address,
      ]);
    });
  });
});
