import { Column, Model, Sequelize, Table } from "sequelize-typescript";

import { AuthContextMetadata } from "../../../../src/common/context/auth-context-metadata.class";
import { Serializer } from "../../../../src/common/generator/serializer";
import { expect } from "chai";

describe("Serializer", () => {
  let serializer: Serializer<SourceModel>;

  @Table
  class SourceModel extends Model {
    @Column({ primaryKey: true })
    id: number;

    @Column
    field: string;
  }

  before(() => {
    new Sequelize({ models: [SourceModel], dialect: "postgres" });
    serializer = new (class extends Serializer<SourceModel> {})();
  });

  describe("#deserialize", () => {
    it("should return input as is", async () => {
      // arrange
      const input = { field: "hello", id: 1 };
      const state = new AuthContextMetadata({});

      // act
      const deserialized = await serializer.deserialize(input, state);

      // assert
      expect(deserialized).to.deep.eq(input);
    });
  });

  describe("#serialize", () => {
    it("should return instance fields", () => {
      // arrange
      const input = { field: "olleh", id: 1 };
      const state = new AuthContextMetadata({});
      const source = SourceModel.build(input);

      // act & assert
      expect(serializer.serialize(source, state)).to.deep.eq(input);
    });
  });
});
